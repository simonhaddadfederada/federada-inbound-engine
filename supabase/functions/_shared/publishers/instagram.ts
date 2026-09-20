// Adapters de publicación en Instagram — uno por formato, todos usando
// exclusivamente la API oficial de Meta (Content Publishing API).
//
// Robustez (Bloque 7, Objetivo 1): la primera publicación real tuvo un
// HTTP 400 transitorio en media_publish — un reintento manual funcionó.
// Ahora publishContainerWithRetry reintenta con backoff antes de fallar
// de verdad. Además, si el contenedor ya se creó en un intento anterior
// (piece.pendingContainerId), se reutiliza en vez de crear uno nuevo —
// evita terminar con dos publicaciones del mismo content_piece si el
// primer intento creó el contenedor pero falló al publicarlo.
//
// El token viene de `platform_tokens` (tabla protegida por RLS, con
// refresh automático), inyectado via getCredentials().
//
// publishInstagramCarousel y publishInstagramReel siguen bloqueados solo
// si la pieza no tiene los assets que necesitan (varias imágenes / video)
// — ya no por permiso ni por token.

import {
  createImageContainer,
  createStoryContainer,
  createVideoContainer,
  publishContainerWithRetry,
  waitForContainerReady,
} from "./instagram_graph.ts";

export interface PublishablePiece {
  id: string;
  slug: string;
  format: "reel" | "carousel" | "story" | "post";
  hook: string;
  cta: string;
  // Caption real a publicar (content_pieces.script) — NO piece.cta, que es
  // solo el llamado a la acción corto usado para revisión/atribución. Bug
  // real encontrado el 20/09/2026 al preparar la publicación del segundo
  // Reel: publishInstagramPost usaba piece.cta como caption; la primera
  // publicación real (Bloque 10) sí había usado el texto completo de
  // script, a mano, fuera de este adapter — nunca se había corregido acá
  // porque nunca se había vuelto a publicar nada por este camino.
  caption: string;
  assetRef: string | null;
  carouselAssets?: string[] | null;
  videoRef?: string | null;
  pendingContainerId?: string | null;
}

export interface InstagramCredentials {
  igUserId: string;
  accessToken: string;
}

export type CredentialsProvider = () => Promise<InstagramCredentials | null>;

export type PublishResult =
  | { status: "published"; externalRef: string }
  | { status: "blocked"; reason: string }
  | { status: "error"; detail: string; containerId?: string };

const NO_TOKEN_REASON =
  "No hay un token de Instagram vigente en platform_tokens (venció o todavía no se cargó ninguno). " +
  "El refresh automático (instagram-token-refresh) debería evitar este caso — revisar last_refresh_error.";

export async function publishInstagramPost(
  piece: PublishablePiece,
  getCredentials: CredentialsProvider,
): Promise<PublishResult> {
  if (!piece.assetRef) {
    return { status: "blocked", reason: "Falta un asset (imagen) para esta pieza — no se generó todavía." };
  }
  const creds = await getCredentials();
  if (!creds) return { status: "blocked", reason: NO_TOKEN_REASON };

  let containerId = piece.pendingContainerId ?? null;
  if (!containerId) {
    const container = await createImageContainer(creds.igUserId, creds.accessToken, piece.assetRef, piece.caption);
    if (!container.ok) return { status: "error", detail: container.error };
    containerId = container.id;
  }

  const published = await publishContainerWithRetry(creds.igUserId, creds.accessToken, containerId);
  if (!published.ok) return { status: "error", detail: published.error, containerId };

  return { status: "published", externalRef: published.id };
}

export async function publishInstagramStory(
  piece: PublishablePiece,
  getCredentials: CredentialsProvider,
): Promise<PublishResult> {
  if (!piece.assetRef) {
    return { status: "blocked", reason: "Falta un asset (imagen) para esta pieza — no se generó todavía." };
  }
  const creds = await getCredentials();
  if (!creds) return { status: "blocked", reason: NO_TOKEN_REASON };

  let containerId = piece.pendingContainerId ?? null;
  if (!containerId) {
    const container = await createStoryContainer(creds.igUserId, creds.accessToken, piece.assetRef);
    if (!container.ok) return { status: "error", detail: container.error };
    containerId = container.id;
  }

  const published = await publishContainerWithRetry(creds.igUserId, creds.accessToken, containerId);
  if (!published.ok) return { status: "error", detail: published.error, containerId };

  return { status: "published", externalRef: published.id };
}

export async function publishInstagramCarousel(
  piece: PublishablePiece,
  _getCredentials: CredentialsProvider,
): Promise<PublishResult> {
  if (!piece.carouselAssets || piece.carouselAssets.length < 2) {
    return {
      status: "blocked",
      reason:
        "Falta el set de imágenes del carrusel (carousel_assets, mínimo 2) — no se generó todavía para esta pieza.",
    };
  }
  // El flujo real (crear N child containers -> contenedor padre con
  // children -> publish) queda para cuando se autorice probarlo con una
  // pieza real, igual que se hizo con el primer post.
  return {
    status: "blocked",
    reason: "Assets del carrusel listos, pero la publicación real todavía no se autorizó/probó en vivo.",
  };
}

export async function publishInstagramReel(
  piece: PublishablePiece,
  getCredentials: CredentialsProvider,
): Promise<PublishResult> {
  if (!piece.videoRef) {
    return {
      status: "blocked",
      reason: "Falta el video (videoRef) — no se generó todavía para esta pieza.",
    };
  }
  const creds = await getCredentials();
  if (!creds) return { status: "blocked", reason: NO_TOKEN_REASON };

  let containerId = piece.pendingContainerId ?? null;
  if (!containerId) {
    const container = await createVideoContainer(
      creds.igUserId,
      creds.accessToken,
      piece.videoRef,
      piece.caption,
      "REELS",
    );
    if (!container.ok) return { status: "error", detail: container.error };
    containerId = container.id;
  }

  // A diferencia de una imagen, el contenedor de un Reel se procesa de
  // forma asíncrona en Meta — hay que esperar a que quede FINISHED antes
  // de intentar publicarlo (containerId ya queda guardado como
  // pending_container_id por el llamador si esto tarda o falla, así el
  // próximo intento no vuelve a subir el video de nuevo).
  const ready = await waitForContainerReady(containerId, creds.accessToken);
  if (!ready.ok) return { status: "error", detail: ready.error, containerId };

  const published = await publishContainerWithRetry(creds.igUserId, creds.accessToken, containerId);
  if (!published.ok) return { status: "error", detail: published.error, containerId };

  return { status: "published", externalRef: published.id };
}

export function publisherFor(
  format: PublishablePiece["format"],
): (piece: PublishablePiece, getCredentials: CredentialsProvider) => Promise<PublishResult> {
  switch (format) {
    case "reel":
      return publishInstagramReel;
    case "story":
      return publishInstagramStory;
    case "carousel":
      return publishInstagramCarousel;
    case "post":
      return publishInstagramPost;
  }
}
