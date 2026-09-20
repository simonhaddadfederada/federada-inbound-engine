// Valida y normaliza el payload del formulario de landing de fricción
// mínima (2 taps + teléfono), y arma el input para el scoring.
// Separado de index.ts para poder testearlo sin necesitar Supabase real.
import { computeScore, type ScoringInput } from "./scoring.ts";
import type { AgeRange, LandingFormPayload } from "./types.ts";

export class ValidationError extends Error {}

const VALID_AGE_RANGES: AgeRange[] = ["18_25", "26_35", "36_45", "46_mas"];

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

  if (!nonEmpty(b.phone)) {
    throw new ValidationError(
      "Falta el WhatsApp/teléfono — es el único dato de contacto de la landing",
    );
  }

  if (b.ageRange !== undefined && !VALID_AGE_RANGES.includes(b.ageRange as AgeRange)) {
    throw new ValidationError("ageRange inválido");
  }

  if (b.hasCoverage !== undefined && typeof b.hasCoverage !== "boolean") {
    throw new ValidationError("hasCoverage debe ser true o false");
  }

  return {
    phone: (b.phone as string).trim(),
    ageRange: b.ageRange as AgeRange | undefined,
    hasCoverage: b.hasCoverage as boolean | undefined,
    consent: true,
    campaign: nonEmpty(b.campaign) ? b.campaign.trim() : undefined,
    postRef: nonEmpty(b.postRef) ? b.postRef.trim() : undefined,
    threadId: nonEmpty(b.threadId) ? b.threadId.trim() : undefined,
    contentSlug: nonEmpty(b.contentSlug) ? b.contentSlug.trim() : undefined,
    originChannel: nonEmpty(b.originChannel) ? b.originChannel.trim() : undefined,
  };
}

// El flujo de landing exige teléfono para poder enviarse, y completar los
// 2 taps + el envío ya es en sí mismo un pedido explícito de contacto. Por
// diseño, todo envío válido de este formulario mínimo llega a la banda más
// alta: acá la fricción baja es lo que filtra la intención, no la cantidad
// de datos pedidos (ver nota en scoring.ts).
export function scoringInputFromPayload(
  _payload: LandingFormPayload,
): ScoringInput {
  return {
    startedConversation: true,
    explicitInfoRequest: true,
    hasPhone: true,
  };
}

export function scoreLandingPayload(payload: LandingFormPayload) {
  return computeScore(scoringInputFromPayload(payload));
}
