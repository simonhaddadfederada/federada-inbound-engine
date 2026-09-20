// Puntaje de leads: reglas fijas, sin IA. Ver docs/scoring.md para la
// explicación en palabras de estos mismos números.
//
// Principio de diseño (revisado): el score mide INTENCIÓN demostrada, no
// cantidad de campos de un formulario completados. Por eso no existe (ni
// debe volver a existir) un puntaje "por cada respuesta contestada" — eso
// penaliza artificialmente a un lead solo porque decidimos, a propósito,
// no hacerle muchas preguntas para no perderlo por fricción.
import type { EmploymentType, IntentTimeframe, ScoreBand } from "./types.ts";

export interface ScoringInput {
  startedConversation: boolean; // el aspirante dio el primer paso voluntariamente
  explicitInfoRequest: boolean; // pidió info / completó un CTA de captura
  hasPhone: boolean; // dejó un canal de contacto directo (WhatsApp/teléfono)
  // Señales opcionales "bonus": solo disponibles en canales/flujos que sí
  // llegan a conocer este detalle (ej. una conversación de Instagram ya
  // avanzada). La landing de fricción mínima no las pide.
  employmentType?: EmploymentType | null;
  intentTimeframe?: IntentTimeframe | null;
}

export const SCORE_WEIGHTS = {
  startedConversation: 20,
  explicitInfoRequest: 20,
  hasPhone: 40,
  employmentDependenciaOMonotributo: 10,
  intentInmediato: 10,
  intent1a3Meses: 5,
} as const;

// Rangos inclusivos [min, max].
export const SCORE_BANDS: Record<ScoreBand, [number, number]> = {
  frio: [0, 20],
  tibio: [21, 45],
  caliente: [46, 70],
  contactar_ahora: [71, Infinity],
};

export function bandForScore(score: number): ScoreBand {
  for (const [band, [min, max]] of Object.entries(SCORE_BANDS)) {
    if (score >= min && score <= max) return band as ScoreBand;
  }
  // No debería pasar: las bandas cubren [0, Infinity).
  return "frio";
}

export function computeScore(
  input: ScoringInput,
): { score: number; band: ScoreBand } {
  let score = 0;

  if (input.startedConversation) {
    score += SCORE_WEIGHTS.startedConversation;
  }

  if (input.explicitInfoRequest) {
    score += SCORE_WEIGHTS.explicitInfoRequest;
  }

  if (input.hasPhone) {
    score += SCORE_WEIGHTS.hasPhone;
  }

  if (
    input.employmentType === "dependencia" ||
    input.employmentType === "monotributo"
  ) {
    score += SCORE_WEIGHTS.employmentDependenciaOMonotributo;
  }

  if (input.intentTimeframe === "inmediato") {
    score += SCORE_WEIGHTS.intentInmediato;
  } else if (input.intentTimeframe === "1_3_meses") {
    score += SCORE_WEIGHTS.intent1a3Meses;
  }

  return { score, band: bandForScore(score) };
}
