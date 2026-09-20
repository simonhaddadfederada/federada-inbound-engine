// Adapters de publicación en Instagram — uno por formato, todos usando
// exclusivamente la API oficial de Meta (Content Publishing API).
//
// ACTUALIZADO 20/09/2026: Standard Access (token de la propia cuenta, sin
// Advanced Access/App Review) SÍ alcanza para crear un contenedor de
// imagen y publicarlo — confirmado con una llamada real. Por eso
// publishInstagramPost y publishInstagramStory intentan publicar de
// verdad cuando se los invoca.
//
// El token ya NO se lee de una variable de entorno: viene de
// `platform_tokens` (tabla protegida por RLS, con refresh automático via
// instagram-token-refresh) porque necesita poder actualizarse solo. Por
// eso estas funciones reciben un `getCredentials()` inyectado en vez de
// leer Deno.env directamente — mantiene el código testeable sin Supabase.
//
// publishInstagramCarousel y publishInstagramReel siguen bloqueados, pero
// por falta de assets (varias imágenes / video), no por permiso ni por token.
//
// Esta función NUNCA se llama sola: publish-content.ts la invoca solo si
// content_config.auto_publish = true, que sigue en false por default.

import { createImageContainer, createStoryContainer, publishContainer } from "./instagram_graph.ts";

export interface PublishablePiece {
  id: string;
  slug: string;
  format: "reel" | "carousel" | "story" | "post";
  hook: string;
  cta: string;
  assetRef: string | null;
}

export interface InstagramCredentials {
  igUserId: string;
  accessToken: string;
}

export type CredentialsProvider = () => Promise<InstagramCredentials | null>;

export type PublishResult =
  | { status: "published"; externalRef: string }
  | { status: "blocked"; reason: string }
  | { status: "error"; detail: string };

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

  const container = await createImageContainer(creds.igUserId, creds.accessToken, piece.assetRef, piece.cta);
  if (!container.ok) return { status: "error", detail: container.error };

  const published = await publishContainer(creds.igUserId, creds.accessToken, container.id);
  if (!published.ok) return { status: "error", detail: published.error };

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

  const container = await createStoryContainer(creds.igUserId, creds.accessToken, piece.assetRef);
  if (!container.ok) return { status: "error", detail: container.error };

  const published = await publishContainer(creds.igUserId, creds.accessToken, container.id);
  if (!published.ok) return { status: "error", detail: published.error };

  return { status: "published", externalRef: published.id };
}

export async function publishInstagramCarousel(
  _piece: PublishablePiece,
  _getCredentials: CredentialsProvider,
): Promise<PublishResult> {
  return {
    status: "blocked",
    reason:
      "Un carrusel necesita varias imágenes y content_pieces hoy solo guarda un asset por pieza " +
      "(asset_ref). No es un problema de permiso ni de token — falta el diseño de assets múltiples.",
  };
}

export async function publishInstagramReel(
  _piece: PublishablePiece,
  _getCredentials: CredentialsProvider,
): Promise<PublishResult> {
  return {
    status: "blocked",
    reason:
      "Un reel necesita un video_url y todavía no generamos assets de video. No es un problema de " +
      "permiso ni de token — falta la producción del video.",
  };
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
