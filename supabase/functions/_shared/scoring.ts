// Puntaje de leads: reglas fijas, sin IA. Ver docs/scoring.md para la
// explicación en palabras de estos mismos números.
import type { EmploymentType, IntentTimeframe, ScoreBand } from "./types.ts";

export interface ScoringInput {
  startedConversation: boolean;
  answersCompleted: number;
  employmentType?: EmploymentType | null;
  intentTimeframe?: IntentTimeframe | null;
  hasPhone: boolean;
  explicitInfoRequest: boolean;
}

export const SCORE_WEIGHTS = {
  startedConversation: 10,
  perAnswerCompleted: 5,
  maxAnswersCounted: 6,
  employmentDependenciaOMonotributo: 20,
  intentInmediato: 25,
  intent1a3Meses: 15,
  hasPhone: 15,
  explicitInfoRequest: 10,
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

  score += Math.min(input.answersCompleted, SCORE_WEIGHTS.maxAnswersCounted) *
    SCORE_WEIGHTS.perAnswerCompleted;

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

  if (input.hasPhone) {
    score += SCORE_WEIGHTS.hasPhone;
  }

  if (input.explicitInfoRequest) {
    score += SCORE_WEIGHTS.explicitInfoRequest;
  }

  return { score, band: bandForScore(score) };
}
