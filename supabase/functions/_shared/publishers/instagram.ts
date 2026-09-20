// Adapters de publicación en Instagram — uno por formato, todos usando
// exclusivamente la API oficial de Meta (Content Publishing API).
//
// ACTUALIZADO 20/09/2026 tras una prueba real: Standard Access (el token
// de la propia cuenta, sin Advanced Access/App Review) SÍ alcanza para
// crear un contenedor de imagen y publicarlo — confirmado con una llamada
// real (no simulada). Por eso publishInstagramPost y publishInstagramStory
// ya no son un stub bloqueado: intentan publicar de verdad.
//
// publishInstagramCarousel y publishInstagramReel siguen bloqueados, pero
// AHORA por una razón distinta: no es un permiso lo que falta, es que
// content_pieces todavía guarda un solo asset por pieza (asset_ref), y
// un carrusel necesita varias imágenes y un reel necesita video — ninguno
// de los dos está generado todavía (ver docs/motor-marketing.md).
//
// Sigue habiendo un límite real de automatización: el token de Instagram
// es de corta duración y el intercambio a uno de 60 días falla ("Session
// key invalid", error reproducible) — hasta resolver eso, publicar
// depende de tener un token fresco cargado como secret.
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

export type PublishResult =
  | { status: "published"; externalRef: string }
  | { status: "blocked"; reason: string }
  | { status: "error"; detail: string };

function credentials(): { igUserId: string; accessToken: string } | null {
  const igUserId = Deno.env.get("INSTAGRAM_BUSINESS_USER_ID");
  const accessToken = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  if (!igUserId || !accessToken) return null;
  return { igUserId, accessToken };
}

const NO_TOKEN_REASON =
  "Falta INSTAGRAM_ACCESS_TOKEN/INSTAGRAM_BUSINESS_USER_ID (o el token venció — dura poco y hay " +
  "que renovarlo a mano hasta resolver el intercambio a token de larga duración).";

export async function publishInstagramPost(piece: PublishablePiece): Promise<PublishResult> {
  if (!piece.assetRef) {
    return { status: "blocked", reason: "Falta un asset (imagen) para esta pieza — no se generó todavía." };
  }
  const creds = credentials();
  if (!creds) return { status: "blocked", reason: NO_TOKEN_REASON };

  const container = await createImageContainer(creds.igUserId, creds.accessToken, piece.assetRef, piece.cta);
  if (!container.ok) return { status: "error", detail: container.error };

  const published = await publishContainer(creds.igUserId, creds.accessToken, container.id);
  if (!published.ok) return { status: "error", detail: published.error };

  return { status: "published", externalRef: published.id };
}

export async function publishInstagramStory(piece: PublishablePiece): Promise<PublishResult> {
  if (!piece.assetRef) {
    return { status: "blocked", reason: "Falta un asset (imagen) para esta pieza — no se generó todavía." };
  }
  const creds = credentials();
  if (!creds) return { status: "blocked", reason: NO_TOKEN_REASON };

  const container = await createStoryContainer(creds.igUserId, creds.accessToken, piece.assetRef);
  if (!container.ok) return { status: "error", detail: container.error };

  const published = await publishContainer(creds.igUserId, creds.accessToken, container.id);
  if (!published.ok) return { status: "error", detail: published.error };

  return { status: "published", externalRef: published.id };
}

export async function publishInstagramCarousel(_piece: PublishablePiece): Promise<PublishResult> {
  return {
    status: "blocked",
    reason:
      "Un carrusel necesita varias imágenes y content_pieces hoy solo guarda un asset por pieza " +
      "(asset_ref). No es un problema de permiso — Standard Access ya alcanza, falta el diseño de assets múltiples.",
  };
}

export async function publishInstagramReel(_piece: PublishablePiece): Promise<PublishResult> {
  return {
    status: "blocked",
    reason:
      "Un reel necesita un video_url y todavía no generamos assets de video. No es un problema de " +
      "permiso — Standard Access ya alcanza, falta la producción del video.",
  };
}

export function publisherFor(
  format: PublishablePiece["format"],
): (piece: PublishablePiece) => Promise<PublishResult> {
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
