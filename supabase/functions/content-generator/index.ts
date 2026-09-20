// Job de generación de contenido EN BATCH (Bloque 4). No es un agente
// corriendo todo el tiempo: se invoca periódicamente (cron externo a este
// archivo — ver docs/motor-marketing.md) y en cada corrida:
//   1. mide cuántos días de contenido futuro ya están en cola;
//   2. si alcanza min_days_buffer, no hace nada;
//   3. si no alcanza y hay ANTHROPIC_API_KEY + presupuesto disponible,
//      genera una tanda nueva con Claude, la filtra con las reglas de
//      variedad (novelty.ts) y la guarda en content_pieces;
//   4. si falta la API key o el presupuesto, lo dice explícitamente y no
//      inventa contenido ni gasta nada.
//
// IMPORTANTE (nunca inventar que una integración funciona): el camino que
// llama a la API de Anthropic todavía NO se probó en producción porque no
// hay ANTHROPIC_API_KEY configurada. El camino de "no hace falta generar"
// y el de "bloqueado por falta de API key" sí están probados de verdad.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { canSpend } from "../_shared/ai_budget.ts";
import { checkNovelty, type RecentPieceForNovelty } from "../_shared/novelty.ts";
import { scheduledAtFor, type ContentFormat, type SlotTimes } from "../_shared/scheduling.ts";

const LANDING_BASE_URL = Deno.env.get("LANDING_BASE_URL") ??
  "https://simonhaddadfederada.github.io/federada-inbound-engine/";

const CAPTURE_MECHANISM_BY_FORMAT: Record<ContentFormat, string> = {
  story: "Link directo en el sticker de la historia (atribución automática)",
  reel: "Palabra clave por DM → Simón responde personalmente y comparte el link atribuido",
  carousel: "Palabra clave por comentario → Simón responde por DM y comparte el link atribuido",
  post: "Palabra clave por comentario/DM → Simón responde y comparte el link atribuido",
};

interface ContentConfigRow {
  reels_per_day: number;
  stories_per_day: number;
  carousels_per_week: number;
  posts_per_week: number;
  min_days_buffer: number;
  slot_times: SlotTimes;
  ai_daily_budget_usd: number;
}

interface GeneratedPieceCandidate {
  format: ContentFormat;
  theme: string;
  hook_type: string;
  hook: string;
  script: string;
  cta: string;
  keyword: string | null;
  audience: string;
  hypothesis: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// El slug se usa en la URL de la landing (?content=<slug>) — tiene que ser
// ASCII simple, sin tildes ni espacios, o el link queda frágil.
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function todayIsoMendoza(): string {
  // Mendoza es UTC-3 fijo: restamos 3hs a "ahora UTC" para obtener la fecha local.
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
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
    .select("*")
    .eq("id", 1)
    .single<ContentConfigRow>();
  if (configError || !config) {
    return jsonResponse({ error: `No se pudo leer content_config: ${configError?.message}` }, 500);
  }

  const today = todayIsoMendoza();
  const { data: futurePieces, error: futureError } = await supabase
    .from("content_pieces")
    .select("scheduled_at")
    .in("status", ["borrador", "listo", "programado"])
    .gte("scheduled_at", `${today}T00:00:00Z`)
    .not("scheduled_at", "is", null);
  if (futureError) {
    return jsonResponse({ error: `Error leyendo la cola: ${futureError.message}` }, 500);
  }

  const distinctDays = new Set(
    (futurePieces ?? []).map((p: { scheduled_at: string }) => p.scheduled_at.slice(0, 10)),
  );
  const bufferDays = distinctDays.size;

  if (bufferDays >= config.min_days_buffer) {
    return jsonResponse({ ok: true, action: "none", bufferDays, minDaysBuffer: config.min_days_buffer });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({
      ok: true,
      action: "blocked",
      reason: "Falta ANTHROPIC_API_KEY: la cola está corta pero no hay forma de generar contenido nuevo en automático todavía. Generación manual por ahora.",
      bufferDays,
      minDaysBuffer: config.min_days_buffer,
    });
  }

  // Presupuesto: sumar el gasto de IA de hoy y verificar contra ai_daily_budget_usd.
  const { data: usageToday, error: usageError } = await supabase
    .from("ai_usage_log")
    .select("cost_usd")
    .gte("created_at", `${today}T00:00:00Z`);
  if (usageError) {
    return jsonResponse({ error: `Error leyendo ai_usage_log: ${usageError.message}` }, 500);
  }
  const spentToday = (usageToday ?? []).reduce((sum: number, r: { cost_usd: number }) => sum + r.cost_usd, 0);
  const ESTIMATED_BATCH_COST_USD = 0.10; // estimación conservadora para un batch chico con un modelo económico
  if (!canSpend(spentToday, ESTIMATED_BATCH_COST_USD, config.ai_daily_budget_usd)) {
    return jsonResponse({
      ok: true,
      action: "blocked",
      reason: `Presupuesto diario de IA alcanzado (gastado hoy: USD ${spentToday.toFixed(2)} de USD ${config.ai_daily_budget_usd}).`,
      bufferDays,
    });
  }

  // Contexto reciente para evitar repetición (novelty.ts) — últimas 15 piezas.
  const { data: recentRows, error: recentError } = await supabase
    .from("content_pieces")
    .select("theme, hook, cta")
    .order("created_at", { ascending: false })
    .limit(15);
  if (recentError) {
    return jsonResponse({ error: `Error leyendo piezas recientes: ${recentError.message}` }, 500);
  }
  const recent: RecentPieceForNovelty[] = (recentRows ?? []) as RecentPieceForNovelty[];

  const daysNeeded = config.min_days_buffer - bufferDays;
  const prompt = buildGenerationPrompt(config, recent, daysNeeded);

  // NOTA: este llamado no se probó en producción todavía (no hay
  // ANTHROPIC_API_KEY real configurada en este entorno al momento de
  // escribir esto). Queda implementado siguiendo la Messages API oficial
  // de Anthropic, listo para activarse en cuanto se confirme la clave y
  // el presupuesto con Simón.
  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text();
    return jsonResponse({ error: `Anthropic respondió ${anthropicRes.status}: ${detail}` }, 502);
  }

  const anthropicJson = await anthropicRes.json();
  const inputTokens = anthropicJson.usage?.input_tokens ?? 0;
  const outputTokens = anthropicJson.usage?.output_tokens ?? 0;
  // Precios de referencia de Claude Haiku: ajustar si el modelo/precio cambia.
  const costUsd = (inputTokens / 1_000_000) * 1.0 + (outputTokens / 1_000_000) * 5.0;

  await supabase.from("ai_usage_log").insert({
    purpose: "content-generator",
    model: "claude-haiku-4-5-20251001",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
  });

  const textBlock = anthropicJson.content?.find((c: { type: string }) => c.type === "text");
  // Claude a veces envuelve el JSON en un bloque ```json ... ``` aunque se le
  // pida "solo JSON" — se lo sacamos antes de parsear en vez de asumir texto plano.
  const rawText = (textBlock?.text ?? "[]").trim();
  const unfenced = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  let candidates: GeneratedPieceCandidate[] = [];
  try {
    candidates = JSON.parse(unfenced);
  } catch {
    return jsonResponse({ error: "La respuesta de Claude no fue JSON válido", raw: rawText }, 502);
  }

  const inserted: string[] = [];
  const rejected: { hook: string; reason: string }[] = [];
  const window = [...recent];
  const dayCounters: Record<string, number> = {};

  for (const candidate of candidates) {
    const novelty = checkNovelty({
      candidate: { theme: candidate.theme, hook: candidate.hook, cta: candidate.cta },
      recent: window,
    });
    if (!novelty.ok) {
      rejected.push({ hook: candidate.hook, reason: novelty.reason ?? "no pasó las reglas de variedad" });
      continue;
    }

    const dateIso = pickNextDate(today, daysNeeded, dayCounters, candidate.format, config);
    const slotIndex = dayCounters[`${dateIso}:${candidate.format}`] ?? 0;
    dayCounters[`${dateIso}:${candidate.format}`] = slotIndex + 1;
    const scheduledAt = scheduledAtFor(dateIso, candidate.format, slotIndex, config.slot_times);
    const slug = `${slugify(candidate.format)}-${slugify(candidate.theme)}-${crypto.randomUUID().slice(0, 8)}`;

    const { error: insertError } = await supabase.from("content_pieces").insert({
      slug,
      format: candidate.format,
      theme: candidate.theme,
      hook_type: candidate.hook_type,
      hook: candidate.hook,
      script: candidate.script,
      cta: candidate.cta,
      keyword: candidate.keyword,
      audience: candidate.audience,
      hypothesis: candidate.hypothesis,
      suggested_date: dateIso,
      scheduled_at: scheduledAt,
      status: "borrador",
      channel: "instagram",
      capture_mechanism: CAPTURE_MECHANISM_BY_FORMAT[candidate.format],
      landing_url: `${LANDING_BASE_URL}?source=instagram&content=${slug}`,
    });

    if (insertError) {
      rejected.push({ hook: candidate.hook, reason: `error al guardar: ${insertError.message}` });
      continue;
    }
    inserted.push(slug);
    window.unshift({ theme: candidate.theme, hook: candidate.hook, cta: candidate.cta });
  }

  return jsonResponse({ ok: true, action: "generated", inserted, rejected, costUsd });
});

function buildGenerationPrompt(
  config: ContentConfigRow,
  recent: RecentPieceForNovelty[],
  daysNeeded: number,
): string {
  const recentSummary = recent
    .map((p) => `- tema: ${p.theme ?? "sin tema"} | hook: "${p.hook}" | cta: "${p.cta}"`)
    .join("\n");

  return `Sos el redactor de contenido de un asesor de seguros de salud en Mendoza, Argentina (Federada Salud).
Generá contenido para Instagram en tono argentino, natural, directo, sin sonar corporativo ni escrito por IA.
NUNCA generes contenido genérico tipo "Tu salud es lo más importante". Cada pieza debe apuntar a una duda,
objeción o situación real (aportes, monotributo, cartilla, mitos, errores comunes, familia, jóvenes, etc.).

Contenido ya usado recientemente (NO repitas hooks, y evitá repetir el mismo tema más de 2 veces):
${recentSummary || "(sin piezas previas)"}

Necesito cubrir ${daysNeeded} día(s) más de contenido con esta cadencia diaria/semanal:
- ${config.reels_per_day} reel(s) por día
- ${config.stories_per_day} story(s) por día
- ${config.carousels_per_week} carrusel(es) por semana
- ${config.posts_per_week} post(s) por semana

Reglas de CTA por formato (importante, no las mezcles):
- "story": el CTA SIEMPRE tiene que invitar a deslizar/tocar el link de la
  historia (ej: "Deslizá el link de esta historia..."), NUNCA pedir que
  escriban una palabra por DM — el campo "keyword" va en null.
- "reel"/"carousel"/"post": Instagram no permite links en el texto, así que
  el CTA pide una palabra clave por DM o comentario (ej: "Escribime PLAN",
  "Comentá CARTILLA"). El campo "keyword" tiene que ser EXACTAMENTE esa
  palabra, en MAYÚSCULAS y sin tildes, igual a como aparece en el texto
  del CTA — nunca una palabra distinta ni en minúsculas.

"theme" tiene que ser snake_case simple, sin tildes ni espacios (se usa en una URL).

Devolvé SOLO un array JSON (sin texto alrededor, SIN bloque de código markdown \`\`\`, arrancando directo con "[") de objetos con esta forma exacta:
[{"format":"reel|carousel|story|post","theme":"tema_en_snake_case","hook_type":"dinero|miedo|curiosidad|educativo|faq|mito","hook":"...","script":"...","cta":"...","keyword":"PALABRA o null","audience":"...","hypothesis":"..."}]`;
}

function pickNextDate(
  today: string,
  daysNeeded: number,
  _dayCounters: Record<string, number>,
  _format: ContentFormat,
  _config: ContentConfigRow,
): string {
  // V1: reparte round-robin simple sobre los próximos daysNeeded días a
  // partir de hoy. No intenta optimizar por horario "ideal" — eso es
  // trabajo del analizador más adelante, con datos reales.
  const base = new Date(`${today}T00:00:00Z`);
  const offset = Math.floor(Math.random() * Math.max(daysNeeded, 1));
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}
