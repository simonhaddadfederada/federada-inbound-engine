import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { bandForScore, computeScore, SCORE_WEIGHTS } from "./scoring.ts";

Deno.test("solo dar el primer paso, sin telefono ni pedido explicito, queda FRIO", () => {
  const { score, band } = computeScore({
    startedConversation: true,
    explicitInfoRequest: false,
    hasPhone: false,
  });
  assertEquals(score, 20);
  assertEquals(band, "frio");
});

Deno.test("dar el primer paso + pedir info sin dejar telefono queda TIBIO", () => {
  const { score, band } = computeScore({
    startedConversation: true,
    explicitInfoRequest: true,
    hasPhone: false,
  });
  // 20 (inicio) + 20 (pidio info) = 40
  assertEquals(score, 40);
  assertEquals(band, "tibio");
});

Deno.test("completar el mini-flujo de landing (siempre con telefono) es CONTACTAR AHORA", () => {
  const { score, band } = computeScore({
    startedConversation: true,
    explicitInfoRequest: true,
    hasPhone: true,
  });
  // 20 + 20 + 40 = 80 - el flujo de landing no pide mas que esto, y ya
  // alcanza para la banda mas alta: la friccion baja es la que filtra,
  // no la cantidad de datos.
  assertEquals(score, 80);
  assertEquals(band, "contactar_ahora");
});

Deno.test("dejar telefono sin pedir info explicitamente ya es CALIENTE", () => {
  const { score, band } = computeScore({
    startedConversation: true,
    explicitInfoRequest: false,
    hasPhone: true,
  });
  // 20 + 40 = 60
  assertEquals(score, 60);
  assertEquals(band, "caliente");
});

Deno.test("las senales opcionales (situacion laboral, plazo) suman como bonus", () => {
  const { score, band } = computeScore({
    startedConversation: true,
    explicitInfoRequest: true,
    hasPhone: true,
    employmentType: "monotributo",
    intentTimeframe: "inmediato",
  });
  // 20 + 20 + 40 + 10 + 10 = 100 (maximo posible)
  assertEquals(score, 100);
  assertEquals(band, "contactar_ahora");
});

Deno.test("empleo particular y plazo sin definir no suman bonus", () => {
  const { score } = computeScore({
    startedConversation: true,
    explicitInfoRequest: false,
    hasPhone: false,
    employmentType: "particular",
    intentTimeframe: "sin_definir",
  });
  assertEquals(score, SCORE_WEIGHTS.startedConversation);
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
