// Lee insights reales de Meta para piezas publicadas, en checkpoints
// razonables (primeras horas, 24h, 72h) — no polling constante. Nunca
// inventa una métrica que Meta no soporte (ej. impressions para FEED,
// ver docs/motor-marketing.md).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getInstagramToken } from "../_shared/instagram_token_store.ts";
import { getMediaInsights } from "../_shared/publishers/instagram_graph.ts";
import { isPastLastCheckpoint, nextMetricsCheckpointDue } from "../_shared/metrics_checkpoint_policy.ts";

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

  const { data: rows, error: rowsError } = await supabase
    .from("content_pieces")
    .select("id, slug, published_media_id, published_at, metrics_last_checked_at, status")
    .in("status", ["publicado", "medido"])
    .not("published_at", "is", null)
    .not("published_media_id", "is", null);
  if (rowsError) {
    return jsonResponse({ error: `Error leyendo piezas publicadas: ${rowsError.message}` }, 500);
  }

  const now = Date.now();
  const due = (rows ?? []).filter((r) => {
    const publishedAtMs = new Date(r.published_at).getTime();
    const lastCheckedMs = r.metrics_last_checked_at ? new Date(r.metrics_last_checked_at).getTime() : null;
    return nextMetricsCheckpointDue(now, publishedAtMs, lastCheckedMs);
  });

  if (due.length === 0) {
    return jsonResponse({ ok: true, action: "none", checked: 0 });
  }

  const token = await getInstagramToken(supabase);
  if (!token || new Date(token.expires_at) <= new Date()) {
    return jsonResponse({
      ok: true,
      action: "blocked",
      reason: "No hay un token de Instagram vigente para leer insights.",
      pending: due.length,
    });
  }

  const results: { slug: string; status: string; detail?: string }[] = [];
  for (const piece of due) {
    const insightsResult = await getMediaInsights(piece.published_media_id, token.access_token);
    if (!insightsResult.ok) {
      results.push({ slug: piece.slug, status: "error", detail: insightsResult.error });
      continue;
    }

    const publishedAtMs = new Date(piece.published_at).getTime();
    const newStatus = isPastLastCheckpoint(now, publishedAtMs) ? "medido" : piece.status;

    await supabase
      .from("content_pieces")
      .update({
        reach: insightsResult.insights.reach ?? null,
        saves: insightsResult.insights.saved ?? null,
        likes: insightsResult.insights.likes ?? null,
        comments: insightsResult.insights.comments ?? null,
        shares: insightsResult.insights.shares ?? null,
        metrics_last_checked_at: new Date().toISOString(),
        status: newStatus,
      })
      .eq("id", piece.id);

    results.push({ slug: piece.slug, status: "actualizado" });
  }

  return jsonResponse({ ok: true, action: "synced", checked: results.length, results });
});
