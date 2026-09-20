// Job periódico de análisis (Bloque 4, Paso 10). Primero calcula métricas
// con código/SQL (la vista content_performance, que usa la atribución real
// leads.content_piece_id) y SOLO si hay suficiente muestra le manda a
// Claude un resumen compacto para sacar una conclusión en palabras.
//
// IMPORTANTE: no se probó en producción todavía porque hoy no hay ninguna
// pieza en estado "publicado"/"medido" con métricas reales — no hay nada
// que analizar. El cálculo determinístico (sin IA) sí se puede probar en
// cuanto haya al menos una publicación real.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { canSpend } from "../_shared/ai_budget.ts";

const MIN_SAMPLE_SIZE = 3; // no declarar un patrón ganador con 1 sola publicación (Paso 11)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface PerformanceRow {
  content_piece_id: string;
  slug: string;
  format: string;
  theme: string | null;
  status: string;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  leads_total: number;
  leads_calificados: number;
}

// Tasa útil SOLO cuando hay denominador real — nunca se inventa un % con
// reach=0/null (evita un "100%" falso o una división por cero silenciosa).
function leadsPerReach(row: PerformanceRow): number | null {
  if (!row.reach || row.reach <= 0) return null;
  return Math.round((row.leads_total / row.reach) * 1000) / 1000;
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

  const { data: performance, error: perfError } = await supabase
    .from("content_performance")
    .select("*")
    .in("status", ["publicado", "medido"]);
  if (perfError) {
    return jsonResponse({ error: `Error leyendo content_performance: ${perfError.message}` }, 500);
  }

  const rows = (performance ?? []) as PerformanceRow[];
  if (rows.length < MIN_SAMPLE_SIZE) {
    return jsonResponse({
      ok: true,
      action: "none",
      reason: `Todavía hay muy pocas piezas publicadas y medidas (${rows.length}/${MIN_SAMPLE_SIZE} mínimo) para sacar conclusiones sin sobreajustar a un solo caso.`,
      sampleSize: rows.length,
    });
  }

  // KPI principal: LEADS_GENERADOS, no views/likes (ver principio central del bloque).
  // leads_per_reach es informativo (solo cuando reach > 0) — el orden sigue siendo por leads.
  const ranked = [...rows]
    .map((r) => ({ ...r, leads_per_reach: leadsPerReach(r) }))
    .sort((a, b) => b.leads_total - a.leads_total);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    // Guardamos igual la conclusión determinística (sin IA): cuál dio más leads.
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const { error: insertError } = await supabase.from("content_insights").insert({
      scope: "global",
      ref: null,
      conclusion:
        `Sin ANTHROPIC_API_KEY no se generó un análisis narrativo. Dato determinístico: ` +
        `"${best.slug}" (${best.format}) generó más leads (${best.leads_total}) que "${worst.slug}" (${worst.leads_total}).`,
      sample_size: rows.length,
      metrics: { ranked },
    });
    if (insertError) {
      return jsonResponse({ error: `Error guardando content_insights: ${insertError.message}` }, 500);
    }
    return jsonResponse({ ok: true, action: "insight_saved_without_ai", sampleSize: rows.length });
  }

  const { data: usageToday } = await supabase
    .from("ai_usage_log")
    .select("cost_usd")
    .gte("created_at", `${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const spentToday = (usageToday ?? []).reduce((sum: number, r: { cost_usd: number }) => sum + r.cost_usd, 0);
  const { data: config } = await supabase.from("content_config").select("ai_daily_budget_usd").eq("id", 1).single();
  const dailyBudget = config?.ai_daily_budget_usd ?? 0;
  const ESTIMATED_COST_USD = 0.05;
  if (!canSpend(spentToday, ESTIMATED_COST_USD, dailyBudget)) {
    return jsonResponse({
      ok: true,
      action: "blocked",
      reason: `Presupuesto diario de IA alcanzado (gastado hoy: USD ${spentToday.toFixed(2)} de USD ${dailyBudget}).`,
    });
  }

  const summary = ranked
    .map((r) => {
      const lines = [
        `PIEZA ${r.slug}`,
        `formato: ${r.format}`,
        `tema: ${r.theme ?? "sin tema"}`,
        `leads: ${r.leads_total}`,
        `leads_calificados: ${r.leads_calificados}`,
      ];
      if (r.reach !== null) lines.push(`reach: ${r.reach}`);
      if (r.leads_per_reach !== null) lines.push(`leads_por_reach: ${r.leads_per_reach}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content:
          `Analizá este resumen de rendimiento de contenido (el KPI principal es "leads", no views/likes). ` +
          `Decime en 3-4 oraciones, en español simple, qué patrón ves (formato/tema que mejor convierte) ` +
          `y qué probarías después. No declares un ganador definitivo con muestras chicas.\n\n${summary}`,
      }],
    }),
  });

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text();
    return jsonResponse({ error: `Anthropic respondió ${anthropicRes.status}: ${detail}` }, 502);
  }

  const anthropicJson = await anthropicRes.json();
  const inputTokens = anthropicJson.usage?.input_tokens ?? 0;
  const outputTokens = anthropicJson.usage?.output_tokens ?? 0;
  const costUsd = (inputTokens / 1_000_000) * 1.0 + (outputTokens / 1_000_000) * 5.0;
  await supabase.from("ai_usage_log").insert({
    purpose: "content-analyzer",
    model: "claude-haiku-4-5-20251001",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
  });

  const textBlock = anthropicJson.content?.find((c: { type: string }) => c.type === "text");
  const conclusion = textBlock?.text ?? "(sin respuesta de texto)";

  const { error: insertError } = await supabase.from("content_insights").insert({
    scope: "global",
    ref: null,
    conclusion,
    sample_size: rows.length,
    metrics: { ranked },
  });
  if (insertError) {
    return jsonResponse({ error: `Error guardando content_insights: ${insertError.message}` }, 500);
  }

  return jsonResponse({ ok: true, action: "insight_saved", sampleSize: rows.length, costUsd });
});
