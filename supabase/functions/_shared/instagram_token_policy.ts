// Regla fija (sin IA) de CUÁNDO refrescar el token de Instagram. Separada
// del código que hace la llamada de red para poder testearla con
// fechas arbitrarias, sin mockear fetch ni la base de datos.
//
// Reglas de Meta: un token de larga duración dura 60 días y solo se puede
// refrescar si tiene al menos 24hs desde el último refresh y todavía no
// venció. Nunca queremos esperar al último día, así que refrescamos apenas
// falten <= 30 días para vencer (la mitad de la vida útil: mucho margen).

const MIN_AGE_MS = 24 * 60 * 60 * 1000;
const SAFETY_MARGIN_MS = 30 * 24 * 60 * 60 * 1000;

export function shouldRefreshInstagramToken(
  nowMs: number,
  expiresAtMs: number,
  lastRefreshedAtMs: number,
): boolean {
  const oldEnoughToRefresh = nowMs - lastRefreshedAtMs >= MIN_AGE_MS;
  const closeToExpiring = expiresAtMs - nowMs <= SAFETY_MARGIN_MS;
  return oldEnoughToRefresh && closeToExpiring;
}
