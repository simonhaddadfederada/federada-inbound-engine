// Valida y normaliza el payload del formulario de la landing page, y arma
// el objeto listo para guardar en `leads` + el input para el scoring.
// Separado de index.ts para poder testearlo sin necesitar Supabase real.
import { computeScore, type ScoringInput } from "./scoring.ts";
import type { LandingFormPayload } from "./types.ts";

export class ValidationError extends Error {}

const VALID_EMPLOYMENT = ["dependencia", "monotributo", "particular"];
const VALID_COVERAGE = ["individual", "grupo_familiar"];
const VALID_TIMEFRAME = [
  "inmediato",
  "1_3_meses",
  "mas_de_3_meses",
  "sin_definir",
];

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateLandingPayload(
  body: unknown,
): LandingFormPayload {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Cuerpo de la solicitud inválido");
  }
  const b = body as Record<string, unknown>;

  if (b.consent !== true) {
    throw new ValidationError(
      "No se puede registrar el lead sin consentimiento explícito",
    );
  }

  if (!nonEmpty(b.name) && !nonEmpty(b.phone)) {
    throw new ValidationError(
      "Se necesita al menos un nombre o un teléfono para registrar el lead",
    );
  }

  if (b.employmentType !== undefined && !VALID_EMPLOYMENT.includes(String(b.employmentType))) {
    throw new ValidationError("employmentType inválido");
  }
  if (b.coverageFor !== undefined && !VALID_COVERAGE.includes(String(b.coverageFor))) {
    throw new ValidationError("coverageFor inválido");
  }
  if (b.intentTimeframe !== undefined && !VALID_TIMEFRAME.includes(String(b.intentTimeframe))) {
    throw new ValidationError("intentTimeframe inválido");
  }

  return {
    name: nonEmpty(b.name) ? b.name.trim() : undefined,
    locality: nonEmpty(b.locality) ? b.locality.trim() : undefined,
    employmentType: b.employmentType as LandingFormPayload["employmentType"],
    contributionApprox: nonEmpty(b.contributionApprox)
      ? b.contributionApprox.trim()
      : undefined,
    coverageFor: b.coverageFor as LandingFormPayload["coverageFor"],
    intentTimeframe: b.intentTimeframe as LandingFormPayload["intentTimeframe"],
    phone: nonEmpty(b.phone) ? b.phone.trim() : undefined,
    consent: true,
    campaign: nonEmpty(b.campaign) ? b.campaign.trim() : undefined,
    postRef: nonEmpty(b.postRef) ? b.postRef.trim() : undefined,
    threadId: nonEmpty(b.threadId) ? b.threadId.trim() : undefined,
  };
}

// Cuenta cuántos de los campos de calificación "opcionales" fueron
// contestados (además de nombre, que es obligatorio junto con teléfono).
export function countAnswers(payload: LandingFormPayload): number {
  const fields = [
    payload.locality,
    payload.employmentType,
    payload.contributionApprox,
    payload.coverageFor,
    payload.intentTimeframe,
    payload.phone,
  ];
  return fields.filter((f) => f !== undefined && f !== "").length;
}

export function scoringInputFromPayload(
  payload: LandingFormPayload,
): ScoringInput {
  return {
    startedConversation: true,
    answersCompleted: countAnswers(payload),
    employmentType: payload.employmentType ?? null,
    intentTimeframe: payload.intentTimeframe ?? null,
    hasPhone: nonEmpty(payload.phone),
    // llenar el formulario de la landing ya es, en sí mismo, un pedido
    // explícito de información/contacto.
    explicitInfoRequest: true,
  };
}

export function scoreLandingPayload(payload: LandingFormPayload) {
  return computeScore(scoringInputFromPayload(payload));
}
