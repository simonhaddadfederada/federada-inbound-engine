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

export function formatLeadAlert(lead: {
  name: string | null;
  locality: string | null;
  phone: string | null;
  score: number;
  source_channel: string;
  employment_type: string | null;
  intent_timeframe: string | null;
}): string {
  const lines = [
    `🚨 <b>Lead CONTACTAR AHORA</b> (score ${lead.score})`,
    `Nombre: ${lead.name ? escapeHtml(lead.name) : "sin dato"}`,
    `Localidad: ${lead.locality ? escapeHtml(lead.locality) : "sin dato"}`,
    `Teléfono: ${lead.phone ? escapeHtml(lead.phone) : "no dejó teléfono"}`,
    `Situación: ${lead.employment_type ?? "sin dato"}`,
    `Plazo: ${lead.intent_timeframe ?? "sin dato"}`,
    `Canal: ${lead.source_channel}`,
  ];
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
