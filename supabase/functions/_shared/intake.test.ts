import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  scoreLandingPayload,
  validateLandingPayload,
  ValidationError,
} from "./intake.ts";

Deno.test("rechaza sin consentimiento", () => {
  assertThrows(
    () => validateLandingPayload({ phone: "261-555-0000", consent: false }),
    ValidationError,
  );
});

Deno.test("rechaza sin telefono (es obligatorio en la landing minima)", () => {
  assertThrows(
    () => validateLandingPayload({ consent: true }),
    ValidationError,
  );
});

Deno.test("rechaza ageRange invalido", () => {
  assertThrows(
    () =>
      validateLandingPayload({
        phone: "261-555-0000",
        consent: true,
        ageRange: "50_60", // no es un valor válido
      }),
    ValidationError,
  );
});

Deno.test("rechaza hasCoverage que no sea booleano", () => {
  assertThrows(
    () =>
      validateLandingPayload({
        phone: "261-555-0000",
        consent: true,
        hasCoverage: "si",
      }),
    ValidationError,
  );
});

Deno.test("acepta el payload minimo: solo telefono + consentimiento", () => {
  const payload = validateLandingPayload({ phone: "261-555-0000", consent: true });
  assertEquals(payload.phone, "261-555-0000");
  assertEquals(payload.consent, true);
  assertEquals(payload.ageRange, undefined);
  assertEquals(payload.hasCoverage, undefined);
});

Deno.test("acepta el payload completo de los 3 pasos", () => {
  const payload = validateLandingPayload({
    phone: "261-555-0000",
    consent: true,
    ageRange: "26_35",
    hasCoverage: false,
    campaign: "reel_aportes",
  });
  assertEquals(payload.ageRange, "26_35");
  assertEquals(payload.hasCoverage, false);
  assertEquals(payload.campaign, "reel_aportes");
});

Deno.test("cualquier envio valido de la landing minima llega a CONTACTAR AHORA", () => {
  const payload = validateLandingPayload({ phone: "261-555-0000", consent: true });
  const { score, band } = scoreLandingPayload(payload);
  // 20 (inicio) + 20 (pidio contacto) + 40 (dejo telefono) = 80
  assertEquals(score, 80);
  assertEquals(band, "contactar_ahora");
});

Deno.test("acepta y normaliza contentSlug/originChannel cuando vienen en la URL", () => {
  const payload = validateLandingPayload({
    phone: "261-555-0000",
    consent: true,
    contentSlug: "  reel-aportes-dependencia  ",
    originChannel: "instagram",
  });
  assertEquals(payload.contentSlug, "reel-aportes-dependencia");
  assertEquals(payload.originChannel, "instagram");
});

Deno.test("contentSlug/originChannel son opcionales", () => {
  const payload = validateLandingPayload({ phone: "261-555-0000", consent: true });
  assertEquals(payload.contentSlug, undefined);
  assertEquals(payload.originChannel, undefined);
});

Deno.test("el score no cambia si el aspirante contesto ademas edad/cobertura", () => {
  const payload = validateLandingPayload({
    phone: "261-555-0000",
    consent: true,
    ageRange: "18_25",
    hasCoverage: true,
  });
  const { score } = scoreLandingPayload(payload);
  // edad y cobertura son informativas, no puntuan todavia (ver scoring.ts)
  assertEquals(score, 80);
});
