// Regla fija (sin IA) de CUÁNDO conviene volver a leer insights de una
// pieza publicada: primeras horas, 24h y 72h después de publicar — ni
// antes (Meta no tiene datos todavía) ni "todo el tiempo" (polling
// absurdo). Pura y testeable sin red ni base de datos.

const CHECKPOINTS_HOURS = [2, 24, 72];

export function nextMetricsCheckpointDue(
  nowMs: number,
  publishedAtMs: number,
  lastCheckedAtMs: number | null,
): boolean {
  const hoursSincePublish = (nowMs - publishedAtMs) / (60 * 60 * 1000);
  for (const checkpoint of CHECKPOINTS_HOURS) {
    if (hoursSincePublish < checkpoint) continue; // todavía no llegamos a este checkpoint
    // Si nunca se midió, "hace cuánto se midió en relación al checkpoint"
    // tiene que comportarse como "siempre antes de cualquier checkpoint"
    // (-Infinity), no como "ya la medimos hace una eternidad" (+Infinity).
    const hoursSinceLastCheck = lastCheckedAtMs === null
      ? -Infinity
      : (lastCheckedAtMs - publishedAtMs) / (60 * 60 * 1000);
    if (hoursSinceLastCheck < checkpoint) {
      // ya pasamos el checkpoint y todavía no lo medimos desde ahí
      return true;
    }
  }
  return false;
}

export function isPastLastCheckpoint(nowMs: number, publishedAtMs: number): boolean {
  const hoursSincePublish = (nowMs - publishedAtMs) / (60 * 60 * 1000);
  return hoursSincePublish >= CHECKPOINTS_HOURS[CHECKPOINTS_HOURS.length - 1];
}
