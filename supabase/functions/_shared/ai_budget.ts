// Hace cumplir AI_DAILY_BUDGET_USD antes de permitir cualquier llamado a un
// modelo de lenguaje desde una ejecución autónoma (generador o analizador).
// La suma de gasto del día se calcula en el llamador (consulta a
// ai_usage_log); esta función es la regla pura, testeable sin Supabase.

export function canSpend(
  spentTodayUsd: number,
  estimatedCostUsd: number,
  dailyBudgetUsd: number,
): boolean {
  if (dailyBudgetUsd <= 0) return false;
  return spentTodayUsd + estimatedCostUsd <= dailyBudgetUsd;
}

export function remainingBudgetUsd(spentTodayUsd: number, dailyBudgetUsd: number): number {
  return Math.max(0, dailyBudgetUsd - spentTodayUsd);
}
