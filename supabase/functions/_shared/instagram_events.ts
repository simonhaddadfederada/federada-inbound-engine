// Interpreta el payload que manda Meta al webhook de Instagram (comentarios
// y mensajes directos) y decide, con reglas fijas (sin IA), si contiene una
// palabra clave de interés.

// Palabras clave que consideramos un pedido explícito de información.
// Todo en mayúsculas para comparar sin importar cómo lo haya escrito la
// persona. Editar esta lista no afecta ninguna otra parte del sistema.
export const TRIGGER_KEYWORDS = [
  "APORTES",
  "PLAN",
  "INFO",
  "INFORMACION",
  "INFORMACIÓN",
  "COTIZACION",
  "COTIZACIÓN",
  "PRECIO",
];

export function matchesTriggerKeyword(text: string | null | undefined): boolean {
  if (!text) return false;
  const upper = text.toUpperCase();
  return TRIGGER_KEYWORDS.some((keyword) => upper.includes(keyword));
}

export interface NormalizedInstagramEvent {
  type: "comment" | "message";
  eventKey: string; // para dedup en events_log
  igUserId: string; // id de la persona que comentó/escribió (IG-scoped id)
  username: string | null; // solo disponible en comentarios, no en DMs
  text: string;
  mediaId: string | null;
  matchesKeyword: boolean;
}

// Formas mínimas del payload de Meta que usamos (hay más campos, los
// ignoramos). Ver: https://developers.facebook.com/docs/messenger-platform/instagram/webhook-reference
interface CommentChange {
  field: string;
  value: {
    id: string;
    text?: string;
    from?: { id: string; username?: string };
    media?: { id: string };
  };
}

interface MessagingEvent {
  sender: { id: string };
  message?: { mid: string; text?: string };
  timestamp?: number;
}

interface InstagramWebhookEntry {
  id: string;
  time?: number;
  changes?: CommentChange[];
  messaging?: MessagingEvent[];
}

export interface InstagramWebhookPayload {
  object: string;
  entry: InstagramWebhookEntry[];
}

export function extractEvents(
  payload: InstagramWebhookPayload,
): NormalizedInstagramEvent[] {
  const events: NormalizedInstagramEvent[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments") continue;
      const text = change.value.text ?? "";
      events.push({
        type: "comment",
        eventKey: `comment:${change.value.id}`,
        igUserId: change.value.from?.id ?? "desconocido",
        username: change.value.from?.username ?? null,
        text,
        mediaId: change.value.media?.id ?? null,
        matchesKeyword: matchesTriggerKeyword(text),
      });
    }

    for (const messagingEvent of entry.messaging ?? []) {
      if (!messagingEvent.message) continue; // ignoramos "seen"/postbacks por ahora
      const text = messagingEvent.message.text ?? "";
      events.push({
        type: "message",
        eventKey: `message:${messagingEvent.message.mid}`,
        igUserId: messagingEvent.sender.id,
        username: null,
        text,
        mediaId: null,
        matchesKeyword: matchesTriggerKeyword(text),
      });
    }
  }

  return events;
}
