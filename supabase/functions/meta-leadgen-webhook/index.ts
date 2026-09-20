// Edge Function: recibe el webhook "leadgen" de una Página de Meta (Lead
// Ads / formularios instantáneos). Infraestructura preparada para cuando
// se decida pautar — NO pauta nada ni gasta dinero por sí misma.
//
// Flujo:
//   GET  -> handshake de verificación (igual que instagram-webhook).
//   POST -> 1. verifica la firma (X-Hub-Signature-256).
//           2. el payload de Meta solo trae IDs (leadgen_id, campaign_id,
//              adset_id, ad_id, form_id) — NO las respuestas del
//              formulario. Hay que pedirlas aparte a la Graph API con un
//              Page Access Token (permiso leads_retrieval).
//           3. si no hay PAGE_ACCESS_TOKEN configurado, igual se guarda un
//              lead con la atribución del anuncio (para no perderla) y se
//              avisa por Telegram que hay que revisarlo a mano en Ads
//              Manager — no se inventa un teléfono que no tenemos.
//           4. si hay PAGE_ACCESS_TOKEN: trae el detalle real, mapea los
//              campos (meta_leadgen.ts), calcula el score y guarda todo.
//
// IMPORTANTE (nunca inventar que algo funciona): el paso 4 (llamada real a
// la Graph API) todavía NO se probó en producción porque no existe
// PAGE_ACCESS_TOKEN ni un formulario de Lead Ads real todavía — no se
// pauta nada. Se probó el parseo/firma con un payload simulado siguiendo
// el formato oficial documentado por Meta (marcado como tal, no como
// "real").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { verifyMetaSignature } from "../_shared/meta_signature.ts";
import { extractLeadgenEvents, mapLeadgenFields, type LeadgenWebhookPayload } from "../_shared/meta_leadgen.ts";
import { formatLeadAlert, sendTelegramAlert } from "../_shared/telegram.ts";
import { computeScore } from "../_shared/scoring.ts";

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expectedToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
      return textResponse(challenge ?? "");
    }
    return textResponse("Token de verificación inválido", 403);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  const rawBody = await req.text();
  const appSecret = Deno.env.get("META_APP_SECRET") ?? "";
  const signatureHeader = req.headers.get("x-hub-signature-256");
  const validSignature = await verifyMetaSignature(appSecret, rawBody, signatureHeader);
  if (!validSignature) {
    return jsonResponse({ error: "Firma inválida" }, 401);
  }

  let payload: LeadgenWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Falta configuración del servidor" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const pageAccessToken = Deno.env.get("META_PAGE_ACCESS_TOKEN");

  const events = extractLeadgenEvents(payload);
  const results = [];

  for (const event of events) {
    const { error: logError } = await supabase.from("events_log").insert({
      source: "meta_ads",
      event_key: event.leadgen_id,
      payload: event,
    });
    if (logError) {
      if (logError.code === "23505") {
        results.push({ leadgenId: event.leadgen_id, skipped: "duplicado" });
        continue;
      }
      results.push({ leadgenId: event.leadgen_id, error: logError.message });
      continue;
    }

    const adId = event.ad_id ?? event.adgroup_id ?? null;
    const adRefParts = [
      event.campaign_id ? `Campaña ${event.campaign_id}` : null,
      adId ? `Anuncio ${adId}` : null,
    ].filter(Boolean);
    const adRef = adRefParts.length ? adRefParts.join(" / ") : null;

    let phone: string | null = null;
    let ageRange: string | null = null;
    let hasCoverage: boolean | null = null;
    let retrievalNote = "";

    if (pageAccessToken) {
      try {
        const detailRes = await fetch(
          `https://graph.facebook.com/v19.0/${event.leadgen_id}?access_token=${pageAccessToken}`,
        );
        if (detailRes.ok) {
          const details = await detailRes.json();
          const mapped = mapLeadgenFields(details);
          phone = mapped.phone;
          ageRange = mapped.ageRange;
          hasCoverage = mapped.hasCoverage;
        } else {
          retrievalNote = `No se pudo traer el detalle del lead (Graph API respondió ${detailRes.status}). Revisar leadgen_id ${event.leadgen_id} en Ads Manager.`;
        }
      } catch (err) {
        retrievalNote = `Error de red pidiendo el detalle del lead: ${String(err)}. Revisar leadgen_id ${event.leadgen_id} en Ads Manager.`;
      }
    } else {
      retrievalNote = `Falta META_PAGE_ACCESS_TOKEN: se guardó la atribución del anuncio pero no el detalle. Revisar leadgen_id ${event.leadgen_id} en Ads Manager.`;
    }

    const { score, band } = computeScore({
      startedConversation: true,
      explicitInfoRequest: true, // completar y enviar el formulario ya es un pedido explícito
      hasPhone: !!phone,
    });

    const { data: lead, error: upsertError } = await supabase
      .from("leads")
      .upsert(
        {
          source_channel: "meta_ads",
          external_thread_id: event.leadgen_id,
          phone,
          age_range: ageRange,
          has_coverage: hasCoverage,
          ad_campaign_id: event.campaign_id ?? null,
          ad_set_id: event.adgroup_id ?? null,
          ad_id: adId,
          ad_form_id: event.form_id ?? null,
          explicit_info_request: true,
          consent: true,
          consent_at: new Date().toISOString(),
          notes: retrievalNote || null,
          score,
          score_band: band,
          status: band === "contactar_ahora" ? "calificado" : "nuevo",
        },
        { onConflict: "source_channel,external_thread_id" },
      )
      .select()
      .single();

    if (upsertError) {
      results.push({ leadgenId: event.leadgen_id, error: upsertError.message });
      continue;
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
    const text = formatLeadAlert({ ...lead, origin_channel: "meta_ads" }, null, adRef);
    const notification = await sendTelegramAlert(botToken, chatId, text);

    await supabase.from("notifications_log").insert({
      lead_id: lead.id,
      channel: "telegram",
      success: notification.success,
      detail: notification.detail,
    });

    results.push({ leadgenId: event.leadgen_id, leadId: lead.id, notified: notification.success });
  }

  return jsonResponse({ processed: results.length, results });
});
