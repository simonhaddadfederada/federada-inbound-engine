// Job periódico (cron diario) que mantiene vivo el token de Instagram sin
// intervención de Simón. Nunca expone el valor del token: ni en la
// respuesta HTTP, ni en el mensaje de Telegram, ni en ningún log.
//
// Lógica: platform_tokens guarda el token actual + su vencimiento. Si
// falta poco para vencer (<=30 días) y ya pasaron las 24hs mínimas desde
// el último refresh (regla de Meta), se llama al endpoint oficial de
// refresh y se guarda el token nuevo. Si falla, se registra el error (sin
// el token) y se avisa por Telegram — nunca se espera al último día
// porque el margen de 30 días da muchísimas corridas diarias de sobra
// para reintentar antes de que el token viejo deje de servir.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { refreshLongLivedToken } from "../_shared/publishers/instagram_graph.ts";
import { shouldRefreshInstagramToken } from "../_shared/instagram_token_policy.ts";
import { getInstagramToken, recordInstagramRefreshError, saveInstagramToken } from "../_shared/instagram_token_store.ts";
import { sendTelegramAlert } from "../_shared/telegram.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const expectedSecret = Deno.env.get("INTERNAL_FUNCTIONS_SECRET");
  if (!expectedSecret || req.headers.get("x-internal-secret") !== expectedSecret) {
    return jsonResponse({ error: "No autorizado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Falta configuración del servidor" }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const token = await getInstagramToken(supabase);
  if (!token) {
    return jsonResponse({
      ok: true,
      action: "sin_token",
      reason: "No hay ningún token de Instagram cargado en platform_tokens todavía.",
    });
  }

  const now = Date.now();
  const expiresAtMs = new Date(token.expires_at).getTime();
  const lastRefreshedAtMs = new Date(token.last_refreshed_at).getTime();
  const daysRemaining = Math.round((expiresAtMs - now) / (24 * 60 * 60 * 1000));

  if (!shouldRefreshInstagramToken(now, expiresAtMs, lastRefreshedAtMs)) {
    return jsonResponse({ ok: true, action: "none", daysRemaining });
  }

  const result = await refreshLongLivedToken(token.access_token);

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

  if (!result.ok) {
    await recordInstagramRefreshError(supabase, result.error);
    await sendTelegramAlert(
      botToken,
      chatId,
      `⚠️ <b>No se pudo renovar el token de Instagram</b>\nDetalle: ${result.error}\nQuedan ${daysRemaining} día(s) del token actual. Si esto se repite, hay que generar uno nuevo a mano.`,
    );
    return jsonResponse({ ok: false, action: "refresh_failed", error: result.error, daysRemaining });
  }

  const newExpiresAt = new Date(now + result.expiresInSeconds * 1000).toISOString();
  await saveInstagramToken(supabase, result.accessToken, newExpiresAt, token.refresh_count + 1);

  return jsonResponse({
    ok: true,
    action: "refreshed",
    newExpiresAt,
    refreshCount: token.refresh_count + 1,
  });
});
