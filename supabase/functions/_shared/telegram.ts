// Envía una alerta de Telegram cuando un lead es CONTACTAR AHORA.
// No lanza excepción si falla: el llamador decide si loguear y seguir.

export interface TelegramSendResult {
  success: boolean;
  detail: string;
}

export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TelegramSendResult> {
  if (!botToken || !chatId) {
    return { success: false, detail: "Falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID" };
  }

  try {
    const res = await fetchImpl(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      return { success: false, detail: `Telegram respondió ${res.status}: ${body}` };
    }

    return { success: true, detail: "ok" };
  } catch (err) {
    return { success: false, detail: `Error de red: ${String(err)}` };
  }
}

// Telegram usa parse_mode HTML: cualquier texto que venga de un usuario
// (nombre, comentario, mensaje) debe escaparse para que no rompa el
// formato ni sea interpretado como una etiqueta.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const AGE_RANGE_LABELS: Record<string, string> = {
  "18_25": "18 a 25",
  "26_35": "26 a 35",
  "36_45": "36 a 45",
  "46_mas": "46 o más",
};

const CONTENT_FORMAT_LABELS: Record<string, string> = {
  reel: "Reel",
  carousel: "Carrusel",
  story: "Historia",
  post: "Publicación",
};

function capitalize(text: string): string {
  return text.length ? text[0].toUpperCase() + text.slice(1) : text;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatLeadAlert(
  lead: {
    name: string | null;
    locality: string | null;
    phone: string | null;
    score: number;
    source_channel: string;
    employment_type: string | null;
    intent_timeframe: string | null;
    age_range?: string | null;
    has_coverage?: boolean | null;
    origin_channel?: string | null;
  },
  content?: { format: string; hook: string; keyword?: string | null } | null,
  adRef?: string | null,
): string {
  const lines = [
    `🚨 <b>Lead CONTACTAR AHORA</b> (score ${lead.score})`,
    `Nombre: ${lead.name ? escapeHtml(lead.name) : "sin dato"}`,
    `WhatsApp: ${lead.phone ? escapeHtml(lead.phone) : "no dejó teléfono"}`,
  ];
  if (lead.age_range) {
    lines.push(`Edad: ${AGE_RANGE_LABELS[lead.age_range] ?? lead.age_range}`);
  }
  if (lead.has_coverage !== undefined && lead.has_coverage !== null) {
    lines.push(`Cobertura actual: ${lead.has_coverage ? "Sí" : "No"}`);
  }
  if (lead.locality) lines.push(`Localidad: ${escapeHtml(lead.locality)}`);
  if (lead.employment_type) lines.push(`Situación: ${lead.employment_type}`);
  if (lead.intent_timeframe) lines.push(`Plazo: ${lead.intent_timeframe}`);
  if (lead.origin_channel) lines.push(`Origen: ${escapeHtml(capitalize(lead.origin_channel))}`);
  if (content) {
    const formatLabel = CONTENT_FORMAT_LABELS[content.format] ?? capitalize(content.format);
    lines.push(`Contenido: ${formatLabel} — "${escapeHtml(truncate(content.hook, 60))}"`);
    if (content.keyword) lines.push(`CTA: ${escapeHtml(content.keyword)}`);
  }
  if (adRef) lines.push(`Anuncio: ${escapeHtml(adRef)}`);
  lines.push(`Canal: ${lead.source_channel}`);
  return lines.join("\n");
}

export function formatInstagramAlert(event: {
  type: "comment" | "message";
  username: string | null;
  igUserId: string;
  text: string;
  matchesKeyword: boolean;
}): string {
  const who = event.username ? `@${event.username}` : `usuario ${event.igUserId}`;
  const kind = event.type === "comment" ? "Comentario" : "Mensaje directo";
  const flag = event.matchesKeyword ? " 🔑 (con palabra clave)" : "";
  const lines = [
    `📸 <b>${kind} nuevo en Instagram</b>${flag}`,
    `De: ${escapeHtml(who)}`,
    `Texto: "${escapeHtml(event.text)}"`,
  ];
  return lines.join("\n");
}
