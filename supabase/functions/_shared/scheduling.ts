// Calcula horarios de publicación en America/Argentina/Mendoza (UTC-3 fijo,
// Argentina no usa horario de verano desde 2009) a partir de una
// configuración editable de horarios por formato. Sin IA: son reglas fijas,
// se ajustan a mano en content_config.slot_times cuando haga falta.
const MENDOZA_UTC_OFFSET_HOURS = 3;

export type ContentFormat = "reel" | "carousel" | "story" | "post";

export interface SlotTimes {
  reel: string[];
  carousel: string[];
  story: string[];
  post: string[];
}

// dateIso: "YYYY-MM-DD" en fecha local de Mendoza. timeHHmm: "HH:MM" en hora local.
export function scheduledAtUtc(dateIso: string, timeHHmm: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [hh, mm] = timeHHmm.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error(`Fecha u hora inválida: ${dateIso} ${timeHHmm}`);
  }
  const utcDate = new Date(Date.UTC(y, m - 1, d, hh + MENDOZA_UTC_OFFSET_HOURS, mm, 0));
  return utcDate.toISOString();
}

// slotIndex cicla sobre los horarios configurados: si stories_per_day pide
// más horarios de los que hay definidos, reutiliza los existentes en orden.
export function slotTimeFor(format: ContentFormat, slotIndex: number, slotTimes: SlotTimes): string {
  const times = slotTimes[format];
  if (!times || times.length === 0) {
    throw new Error(`No hay horarios configurados en slot_times para el formato "${format}"`);
  }
  return times[slotIndex % times.length];
}

export function scheduledAtFor(
  dateIso: string,
  format: ContentFormat,
  slotIndex: number,
  slotTimes: SlotTimes,
): string {
  return scheduledAtUtc(dateIso, slotTimeFor(format, slotIndex, slotTimes));
}
