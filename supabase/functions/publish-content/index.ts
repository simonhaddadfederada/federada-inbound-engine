// Publicador (Bloque 4, Paso 7 — robustez agregada en Bloque 7).
//
// Con content_config.auto_publish = false (el default, y el único modo
// habilitado hoy): NUNCA llama a ningún adapter de Meta. Solo informa qué
// piezas están "programado" y vencidas, esperando que Simón las apruebe
// para publicar manualmente.
//
// Con auto_publish = true: llama al adapter de cada formato, que ya
// reintenta con backoff los errores transitorios (ver instagram_graph.ts,
// motivado por el HTTP 400 transitorio de la primera publicación real).
// Idempotencia: si un intento anterior ya creó el contenedor en Meta pero
// falló al publicarlo, pending_container_id lo reutiliza en vez de crear
// uno nuevo — nunca dos publicaciones del mismo content_piece. Si falla
// después de los reintentos, se guarda el error y se avisa por Telegram.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { publisherFor, type InstagramCredentials, type PublishablePiece } from "../_shared/publishers/instagram.ts";
import { getInstagramToken } from "../_shared/instagram_token_store.ts";
import { sendTelegramAlert } from "../_shared/telegram.ts";
import { getMediaDetails } from "../_shared/publishers/instagram_graph.ts";

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
    .select("id, slug, format, hook, cta, asset_ref, carousel_assets, video_ref, pending_container_id, publish_attempts")
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
    carousel_assets: string[] | null;
    video_ref: string | null;
    pending_container_id: string | null;
    publish_attempts: number;
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

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

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
        carouselAssets: piece.carousel_assets ?? null,
        videoRef: piece.video_ref ?? null,
        pendingContainerId: piece.pending_container_id ?? null,
      },
      getCredentials,
    );
    if (result.status === "published") {
      // externalRef es el media_id devuelto por media_publish. El permalink
      // (el link que de verdad sirve para abrir el post) es un dato aparte.
      let permalink = result.externalRef;
      let publishedAt = new Date().toISOString();
      const creds = await getCredentials();
      if (creds) {
        const details = await getMediaDetails(result.externalRef, creds.accessToken);
        if (details.ok) {
          permalink = details.details.permalink;
          publishedAt = details.details.timestamp;
        }
      }
      await supabase
        .from("content_pieces")
        .update({
          status: "publicado",
          published_ref: permalink,
          published_media_id: result.externalRef,
          published_at: publishedAt,
          pending_container_id: null,
          last_publish_error: null,
        })
        .eq("id", piece.id);
      results.push({ slug: piece.slug, status: "publicado", detail: permalink });
    } else if (result.status === "blocked") {
      results.push({ slug: piece.slug, status: "blocked", detail: result.reason });
    } else {
      // "error": falló incluso después de los reintentos con backoff.
      const attempts = (piece.publish_attempts ?? 0) + 1;
      await supabase
        .from("content_pieces")
        .update({
          pending_container_id: result.containerId ?? piece.pending_container_id ?? null,
          last_publish_error: result.detail,
          publish_attempts: attempts,
        })
        .eq("id", piece.id);

      await sendTelegramAlert(
        botToken,
        chatId,
        `⚠️ <b>Falló la publicación de "${piece.slug}"</b> (intento ${attempts})\nDetalle: ${result.detail}\nSe reintentará en la próxima corrida.`,
      );
      results.push({ slug: piece.slug, status: "error", detail: result.detail });
    }
  }

  return jsonResponse({ ok: true, action: "processed", autoPublish: true, results });
});
