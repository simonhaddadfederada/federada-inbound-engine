// Edge Function: recibe el formulario de landing de fricción mínima
// (rango etario, cobertura actual sí/no, WhatsApp obligatorio).
//
// Flujo:
//   1. Valida el payload y el consentimiento (intake.ts).
//   2. Calcula el score con reglas fijas (scoring.ts) — sin IA. Con este
//      flujo mínimo, todo envío válido llega a "contactar_ahora" (ver
//      nota en intake.ts / scoring.ts): la fricción baja es el filtro.
//   3. Guarda/actualiza el lead en Postgres (upsert por teléfono).
//   4. Avisa por Telegram.
//
// Variables de entorno requeridas (se configuran como "secrets" en Supabase,
// nunca hardcodeadas): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { scoreLandingPayload, validateLandingPayload, ValidationError } from "../_shared/intake.ts";
import { formatLeadAlert, sendTelegramAlert } from "../_shared/telegram.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido" }, 405);
  }

  let payload;
  try {
    const body = await req.json();
    payload = validateLandingPayload(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      return jsonResponse({ error: err.message }, 400);
    }
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const { score, band } = scoreLandingPayload(payload);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { error: "Falta configuración del servidor (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
      500,
    );
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // El teléfono es obligatorio en este flujo: es el identificador natural
  // para no duplicar al mismo aspirante si vuelve a mandar el formulario.
  const threadId = payload.threadId ?? payload.phone;

  const { data: lead, error: upsertError } = await supabase
    .from("leads")
    .upsert(
      {
        source_channel: "landing",
        external_thread_id: threadId,
        campaign: payload.campaign ?? null,
        post_ref: payload.postRef ?? null,
        age_range: payload.ageRange ?? null,
        has_coverage: payload.hasCoverage ?? null,
        phone: payload.phone,
        explicit_info_request: true,
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
    return jsonResponse({ error: `Error guardando el lead: ${upsertError.message}` }, 500);
  }

  let notification: { attempted: boolean; success?: boolean; detail?: string } = {
    attempted: false,
  };

  if (band === "contactar_ahora") {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
    const text = formatLeadAlert(lead);
    const result = await sendTelegramAlert(botToken, chatId, text);
    notification = { attempted: true, success: result.success, detail: result.detail };

    await supabase.from("notifications_log").insert({
      lead_id: lead.id,
      channel: "telegram",
      success: result.success,
      detail: result.detail,
    });
  }

  return jsonResponse({ lead_id: lead.id, score, band, notification });
});
