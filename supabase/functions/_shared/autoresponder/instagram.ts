// DEUDA TÉCNICA IDENTIFICADA (Bloque 5): hoy, cuando alguien comenta o
// escribe una palabra clave en un reel/carrusel/post, es SIMÓN quien tiene
// que responder manualmente por DM con el landing_url de la pieza
// (ver docs/revision-contenido.md). Eso lo convierte en community manager,
// que es exactamente lo que el proyecto quiere evitar.
//
// La automatización oficial (sin bots simulando humanos, con API oficial)
// es que el propio webhook responda automáticamente el link en cuanto
// detecta la palabra clave. Requiere el mismo permiso que ya tenemos
// pedido (`instagram_business_manage_messages`) aprobado en App Review
// para poder ENVIAR, no solo recibir — hoy solo recibimos.
//
// Estos adapters quedan preparados y bloqueados, igual que los de
// publicación (_shared/publishers/instagram.ts). Cuando se aprueben,
// instagram-webhook/index.ts llama a replyWithLandingLink() en vez de
// (o además de) avisarle a Simón, y esa intervención manual desaparece.

export type AutoreplyResult =
  | { status: "sent" }
  | { status: "blocked"; reason: string };

const BLOCK_REASON =
  "Requiere instagram_business_manage_messages aprobado en App Review para ENVIAR " +
  "mensajes (hoy solo tenemos permiso para recibirlos). Ver docs/checklist-app-review.md.";

export async function replyWithLandingLink(
  _recipientId: string,
  _landingUrl: string,
): Promise<AutoreplyResult> {
  return { status: "blocked", reason: BLOCK_REASON };
}
