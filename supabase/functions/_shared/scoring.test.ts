import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bandForScore, computeScore, SCORE_WEIGHTS } from "./scoring.ts";

Deno.test("lead que solo llena el formulario sin nada más queda FRIO", () => {
  const { score, band } = computeScore({
    startedConversation: true,
    answersCompleted: 0,
    hasPhone: false,
    explicitInfoRequest: false,
  });
  // 10 (inicio) -> frio
  assertEquals(score, 10);
  assertEquals(band, "frio");
});

Deno.test("lead que contesta todo pero sin aportes ni plazo ni telefono llega a CALIENTE solo por completar respuestas", () => {
  const { score, band } = computeScore({
    startedConversation: true,
    answersCompleted: 6,
    employmentType: "particular",
    intentTimeframe: "sin_definir",
    hasPhone: false,
    explicitInfoRequest: true,
  });
  // 10 (inicio) + 30 (6 respuestas) + 0 + 0 + 0 + 10 (pidió info) = 50
  assertEquals(score, 50);
  assertEquals(band, "caliente");
});

Deno.test("lead con aportes e intencion inmediata y telefono es CONTACTAR AHORA", () => {
  const { score, band } = computeScore({
    startedConversation: true,
    answersCompleted: 6,
    employmentType: "dependencia",
    intentTimeframe: "inmediato",
    hasPhone: true,
    explicitInfoRequest: true,
  });
  // 10 + 30 + 20 + 25 + 15 + 10 = 110 (máximo posible)
  assertEquals(score, 110);
  assertEquals(band, "contactar_ahora");
});

Deno.test("lead con aportes e intencion 1 a 3 meses sin telefono queda CALIENTE", () => {
  const { score, band } = computeScore({
    startedConversation: true,
    answersCompleted: 4,
    employmentType: "monotributo",
    intentTimeframe: "1_3_meses",
    hasPhone: false,
    explicitInfoRequest: false,
  });
  // 10 + 20 (4*5) + 20 + 15 = 65
  assertEquals(score, 65);
  assertEquals(band, "caliente");
});

Deno.test("answersCompleted no suma mas alla del maximo contado", () => {
  const { score } = computeScore({
    startedConversation: false,
    answersCompleted: 999,
    hasPhone: false,
    explicitInfoRequest: false,
  });
  assertEquals(score, SCORE_WEIGHTS.maxAnswersCounted * SCORE_WEIGHTS.perAnswerCompleted);
});

Deno.test("bandForScore cubre los limites de cada banda sin huecos", () => {
  assertEquals(bandForScore(0), "frio");
  assertEquals(bandForScore(20), "frio");
  assertEquals(bandForScore(21), "tibio");
  assertEquals(bandForScore(45), "tibio");
  assertEquals(bandForScore(46), "caliente");
  assertEquals(bandForScore(70), "caliente");
  assertEquals(bandForScore(71), "contactar_ahora");
  assertEquals(bandForScore(500), "contactar_ahora");
});
