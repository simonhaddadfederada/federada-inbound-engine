// Edge Function: recibe los webhooks de Instagram (comentarios y mensajes
// directos) de Meta.
//
// Flujo:
//   GET  -> handshake de verificación que pide Meta al configurar el webhook.
//   POST -> 1. verifica la firma (X-Hub-Signature-256) con el secreto de la app
//           2. interpreta el evento (comentario o DM) y busca palabras clave
//              (reglas fijas, sin IA)
//           3. evita procesar el mismo evento dos veces (Meta reintenta envíos)
//           4. guarda/actualiza el lead en la tabla `leads`
//           5. avisa por Telegram — en esta primera versión, SIEMPRE que
//              llega una interacción nueva, sin auto-responder en Instagram.
//
// Variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN, TELEGRAM_BOT_TOKEN,
// TELEGRAM_CHAT_ID.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { verifyMetaSignature } from "../_shared/meta_signature.ts";
import {
  extractEvents,
  type InstagramWebhookPayload,
} from "../_shared/instagram_events.ts";
import { formatInstagramAlert, sendTelegramAlert } from "../_shared/telegram.ts";
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

  // --- Verificación del webhook (handshake que hace Meta una sola vez) ---
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

  // Se necesita el body crudo (texto) para poder verificar la firma antes
  // de parsearlo como JSON.
  const rawBody = await req.text();

  const appSecret = Deno.env.get("META_APP_SECRET") ?? "";
  const signatureHeader = req.headers.get("x-hub-signature-256");
  const validSignature = await verifyMetaSignature(appSecret, rawBody, signatureHeader);

  if (!validSignature) {
    return jsonResponse({ error: "Firma inválida" }, 401);
  }

  let payload: InstagramWebhookPayload;
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

  const events = extractEvents(payload);
  const results = [];

  for (const event of events) {
    // Dedup: si ya procesamos este evento (Meta reintenta si no respondemos
    // rápido), lo saltamos sin volver a notificar ni duplicar el lead.
    const { error: insertLogError } = await supabase.from("events_log").insert({
      source: "instagram",
      event_key: event.eventKey,
      payload: event,
    });

    if (insertLogError) {
      // Violación de unique constraint = evento repetido, no es un error real.
      if (insertLogError.code === "23505") {
        results.push({ eventKey: event.eventKey, skipped: "duplicado" });
        continue;
      }
      results.push({ eventKey: event.eventKey, error: insertLogError.message });
      continue;
    }

    // Score real (antes esta función no lo calculaba, y el lead quedaba
    // con el score=0/frio por defecto sin importar la interacción real).
    const { score, band } = computeScore({
      startedConversation: true,
      explicitInfoRequest: event.matchesKeyword,
      hasPhone: false, // Instagram no entrega el teléfono del usuario
    });

    const { data: lead, error: upsertError } = await supabase
      .from("leads")
      .upsert(
        {
          source_channel: "instagram",
          external_thread_id: event.igUserId,
          name: event.username,
          explicit_info_request: event.matchesKeyword,
          notes: `[${event.type}] ${event.text}`,
          consent: true,
          consent_at: new Date().toISOString(),
          score,
          score_band: band,
          status: band === "contactar_ahora" ? "calificado" : "nuevo",
        },
        { onConflict: "source_channel,external_thread_id" },
      )
      .select()
      .single();

    if (upsertError) {
      results.push({ eventKey: event.eventKey, error: upsertError.message });
      continue;
    }

    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
    const text = formatInstagramAlert(event);
    const notification = await sendTelegramAlert(botToken, chatId, text);

    await supabase.from("notifications_log").insert({
      lead_id: lead.id,
      channel: "telegram",
      success: notification.success,
      detail: notification.detail,
    });

    results.push({ eventKey: event.eventKey, leadId: lead.id, notified: notification.success });
  }

  return jsonResponse({ processed: results.length, results });
});
