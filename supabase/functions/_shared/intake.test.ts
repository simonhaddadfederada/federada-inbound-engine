import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  countAnswers,
  scoreLandingPayload,
  validateLandingPayload,
  ValidationError,
} from "./intake.ts";

Deno.test("rechaza sin consentimiento", () => {
  assertThrows(
    () => validateLandingPayload({ name: "Ana", consent: false }),
    ValidationError,
  );
});

Deno.test("rechaza sin nombre ni telefono", () => {
  assertThrows(
    () => validateLandingPayload({ consent: true }),
    ValidationError,
  );
});

Deno.test("rechaza employmentType invalido", () => {
  assertThrows(
    () =>
      validateLandingPayload({
        name: "Ana",
        consent: true,
        employmentType: "jubilado", // no es un valor válido
      }),
    ValidationError,
  );
});

Deno.test("acepta payload minimo valido (solo nombre + consentimiento)", () => {
  const payload = validateLandingPayload({ name: "Ana", consent: true });
  assertEquals(payload.name, "Ana");
  assertEquals(payload.consent, true);
  assertEquals(countAnswers(payload), 0);
});

Deno.test("payload completo calcula CONTACTAR AHORA", () => {
  const payload = validateLandingPayload({
    name: "Marcos",
    locality: "Mendoza Capital",
    employmentType: "dependencia",
    contributionApprox: "sí, tengo aportes",
    coverageFor: "grupo_familiar",
    intentTimeframe: "inmediato",
    phone: "261-555-0000",
    consent: true,
  });

  assertEquals(countAnswers(payload), 6);

  const { score, band } = scoreLandingPayload(payload);
  // 10 (inicio) + 30 (6 respuestas) + 20 (dependencia) + 25 (inmediato) + 15 (telefono) + 10 (pidió info) = 110
  assertEquals(score, 110);
  assertEquals(band, "contactar_ahora");
});

Deno.test("payload con solo telefono y consentimiento es valido", () => {
  const payload = validateLandingPayload({ phone: "261-555-1111", consent: true });
  assertEquals(payload.phone, "261-555-1111");
});
