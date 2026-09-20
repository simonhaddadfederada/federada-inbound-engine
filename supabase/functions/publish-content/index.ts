// Publicador (Bloque 4, Paso 7 — robustez agregada en Bloque 7).
//
// Con content_config.auto_publish = false (el default, y el único modo
// habilitado hoy): NUNCA llama a ningún adapter de Meta por su cuenta.
// Solo informa qué piezas están "programado" y vencidas, esperando que
// Simón las apruebe para publicar manualmente.
//
// Con auto_publish = true: llama al adapter de cada formato, que ya
// reintenta con backoff los errores transitorios (ver instagram_graph.ts,
// motivado por el HTTP 400 transitorio de la primera publicación real).
// Idempotencia: si un intento anterior ya creó el contenedor en Meta pero
// falló al publicarlo, pending_container_id lo reutiliza en vez de crear
// uno nuevo — nunca dos publicaciones del mismo content_piece. Si falla
// después de los reintentos, se guarda el error y se avisa por Telegram.
//
// manualPieceId (Bloque 15, 20/09/2026): publicar UNA pieza específica ya
// autorizada explícitamente por Simón, sin esperar a auto_publish=true ni
// a que scheduled_at se cumpla — usa el mismo camino real (retry,
// idempotencia, guardado de published_ref/published_at/media_id) que el
// publicador automático, para no duplicar lógica ni comportarse distinto.
// Sigue exigiendo el secreto interno igual que cualquier otra llamada.

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

interface PieceRow {
  id: string;
  slug: string;
  status: string;
  format: PublishablePiece["format"];
  hook: string;
  cta: string;
  script: string;
  asset_ref: string | null;
  carousel_assets: string[] | null;
  video_ref: string | null;
  pending_container_id: string | null;
  publish_attempts: number;
}

// deno-lint-ignore no-explicit-any
async function publishAndPersist(
  supabase: any,
  piece: PieceRow,
  getCredentials: () => Promise<InstagramCredentials | null>,
  botToken: string,
  chatId: string,
): Promise<{ slug: string; status: string; detail: string }> {
  const publish = publisherFor(piece.format);
  const result = await publish(
    {
      id: piece.id,
      slug: piece.slug,
      format: piece.format,
      hook: piece.hook,
      cta: piece.cta,
      caption: piece.script,
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
    return { slug: piece.slug, status: "publicado", detail: permalink };
  }

  if (result.status === "blocked") {
    return { slug: piece.slug, status: "blocked", detail: result.reason };
  }

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
  return { slug: piece.slug, status: "error", detail: result.detail };
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

  // Bug real encontrado el 20/09/2026 al preparar la publicación del
  // Reel: esta función leía "INSTAGRAM_BUSINESS_USER_ID", una variable
  // que nunca existió como secret — el nombre real, usado en .env.example
  // desde Fase 2, es INSTAGRAM_BUSINESS_ACCOUNT_ID. Como auto_publish
  // siempre estuvo en false, getCredentials() nunca se había ejecutado de
  // verdad y nadie lo había notado: siempre iba a devolver null y bloquear
  // cualquier publicación real, incluso con un token válido en platform_tokens.
  const igUserId = Deno.env.get("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  const getCredentials = async (): Promise<InstagramCredentials | null> => {
    if (!igUserId) return null;
    const token = await getInstagramToken(supabase);
    if (!token || new Date(token.expires_at) <= new Date()) return null;
    return { igUserId, accessToken: token.access_token };
  };
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

  const PIECE_COLUMNS =
    "id, slug, status, format, hook, cta, script, asset_ref, carousel_assets, video_ref, pending_container_id, publish_attempts";

  let manualPieceId: string | undefined;
  try {
    const body = await req.json();
    manualPieceId = typeof body?.manualPieceId === "string" ? body.manualPieceId : undefined;
  } catch {
    // sin body (o no es JSON) = corrida normal del cron, no manual.
  }

  if (manualPieceId) {
    const { data: piece, error: pieceError } = await supabase
      .from("content_pieces")
      .select(PIECE_COLUMNS)
      .eq("id", manualPieceId)
      .single();
    if (pieceError || !piece) {
      return jsonResponse({ error: `No se encontró la pieza ${manualPieceId}: ${pieceError?.message}` }, 404);
    }
    const row = piece as unknown as PieceRow;
    if (row.status === "publicado") {
      return jsonResponse({
        ok: false,
        action: "already_published",
        slug: row.slug,
        detail: "Esta pieza ya está marcada como publicada — no se vuelve a publicar.",
      }, 409);
    }
    const outcome = await publishAndPersist(supabase, row, getCredentials, botToken, chatId);
    return jsonResponse({ ok: true, action: "manual_publish", result: outcome });
  }

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
    .select(PIECE_COLUMNS)
    .eq("status", "programado")
    .lte("scheduled_at", new Date().toISOString());
  if (dueError) {
    return jsonResponse({ error: `Error leyendo la cola: ${dueError.message}` }, 500);
  }
  const due = (dueRows ?? []) as unknown as PieceRow[];

  if (!config.auto_publish) {
    return jsonResponse({
      ok: true,
      action: "waiting_approval",
      autoPublish: false,
      duePieces: due.map((p) => p.slug),
    });
  }

  const results: { slug: string; status: string; detail: string }[] = [];
  for (const piece of due) {
    results.push(await publishAndPersist(supabase, piece, getCredentials, botToken, chatId));
  }

  return jsonResponse({ ok: true, action: "processed", autoPublish: true, results });
});
