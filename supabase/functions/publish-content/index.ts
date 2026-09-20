// Publicador (Bloque 4, Paso 7). Separado del generador a propósito.
//
// Con content_config.auto_publish = false (el default, y el único modo
// habilitado hoy): NUNCA llama a ningún adapter de Meta. Solo informa qué
// piezas están "programado" y vencidas, esperando que Simón las apruebe
// para publicar manualmente. No hay forma de que este archivo publique
// nada sin que alguien primero cambie auto_publish a true a propósito.
//
// Con auto_publish = true: llama al adapter de cada formato. Hoy los 4
// adapters devuelven "blocked" (falta permiso + App Review, ver
// docs/capacidades-meta.md), así que en la práctica sigue sin publicar
// nada real todavía — pero el camino ya queda armado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { publisherFor, type InstagramCredentials, type PublishablePiece } from "../_shared/publishers/instagram.ts";
import { getInstagramToken } from "../_shared/instagram_token_store.ts";

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

  const { data: config, error: configError } = await supabase
    .from("content_config")
    .select("auto_publish")
    .eq("id", 1)
    .single();
  if (configError || !config) {
    return jsonResponse({ error: `No se pudo leer content_config: ${configError?.message}` }, 500);
  }

  const { data: dueRows, error: dueError } = await supabase
    .from("content_pieces")
    .select("id, slug, format, hook, cta, asset_ref")
    .eq("status", "programado")
    .lte("scheduled_at", new Date().toISOString());
  if (dueError) {
    return jsonResponse({ error: `Error leyendo la cola: ${dueError.message}` }, 500);
  }
  interface DueRow {
    id: string;
    slug: string;
    format: PublishablePiece["format"];
    hook: string;
    cta: string;
    asset_ref: string | null;
  }
  const due = (dueRows ?? []) as DueRow[];

  if (!config.auto_publish) {
    return jsonResponse({
      ok: true,
      action: "waiting_approval",
      autoPublish: false,
      duePieces: due.map((p) => p.slug),
    });
  }

  const igUserId = Deno.env.get("INSTAGRAM_BUSINESS_USER_ID");
  const getCredentials = async (): Promise<InstagramCredentials | null> => {
    if (!igUserId) return null;
    const token = await getInstagramToken(supabase);
    if (!token || new Date(token.expires_at) <= new Date()) return null;
    return { igUserId, accessToken: token.access_token };
  };

  const results: { slug: string; status: string; detail: string }[] = [];
  for (const piece of due) {
    const publish = publisherFor(piece.format);
    const result = await publish(
      {
        id: piece.id,
        slug: piece.slug,
        format: piece.format,
        hook: piece.hook,
        cta: piece.cta,
        assetRef: piece.asset_ref ?? null,
      },
      getCredentials,
    );
    if (result.status === "published") {
      await supabase
        .from("content_pieces")
        .update({ status: "publicado", published_ref: result.externalRef })
        .eq("id", piece.id);
      results.push({ slug: piece.slug, status: "publicado", detail: result.externalRef });
    } else if (result.status === "blocked") {
      results.push({ slug: piece.slug, status: "blocked", detail: result.reason });
    } else {
      // "error": la llamada real a Meta falló (no es un bloqueo esperado,
      // ej. token vencido, asset caído) — queda en su estado sin tocar,
      // para reintentar en la próxima corrida del cron.
      results.push({ slug: piece.slug, status: "error", detail: result.detail });
    }
  }

  return jsonResponse({ ok: true, action: "processed", autoPublish: true, results });
});
