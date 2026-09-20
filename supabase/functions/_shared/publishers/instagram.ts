// Adapters de publicación en Instagram — uno por formato, todos usando
// exclusivamente la API oficial de Meta (Content Publishing API).
//
// Estado real verificado contra la documentación oficial el 20/09/2026
// (ver docs/capacidades-meta.md): publicar CUALQUIER formato requiere el
// permiso `instagram_business_content_publish`, que todavía no está
// agregado a la app, y la app todavía no pasó App Review / no está "Live".
// Por eso los 4 adapters devuelven "blocked" con el motivo exacto — no se
// inventa que publican. Cuando el permiso y el App Review estén
// aprobados, se reemplaza el cuerpo de cada función por el flujo real de
// 2 pasos de Meta (crear media container -> publicar container) sin tocar
// la firma ni el resto del sistema.

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
  | { status: "blocked"; reason: string };

const BLOCK_REASON =
  "Requiere el permiso instagram_business_content_publish (Advanced Access) " +
  "y que la app pase App Review y quede en estado Live. Ver docs/capacidades-meta.md " +
  "y docs/setup-fase-2.md para el estado actual del trámite.";

export async function publishInstagramReel(_piece: PublishablePiece): Promise<PublishResult> {
  return { status: "blocked", reason: BLOCK_REASON };
}

export async function publishInstagramStory(_piece: PublishablePiece): Promise<PublishResult> {
  return { status: "blocked", reason: BLOCK_REASON };
}

export async function publishInstagramCarousel(_piece: PublishablePiece): Promise<PublishResult> {
  return { status: "blocked", reason: BLOCK_REASON };
}

export async function publishInstagramPost(_piece: PublishablePiece): Promise<PublishResult> {
  return { status: "blocked", reason: BLOCK_REASON };
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
