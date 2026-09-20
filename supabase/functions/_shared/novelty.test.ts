import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkNovelty } from "./novelty.ts";

const RECENT = [
  { theme: "aportes_recibo_sueldo", hook: "Hook reciente 1", cta: "Escribime APORTES" },
  { theme: "monotributo", hook: "Hook reciente 2", cta: "Mandame PLAN" },
  { theme: "aportes_recibo_sueldo", hook: "Hook reciente 3", cta: "Escribime APORTES" },
  { theme: "cartilla", hook: "Hook reciente 4", cta: "Escribime CARTILLA" },
  { theme: "cartilla", hook: "Hook reciente 5", cta: "Escribime CARTILLA" },
];

Deno.test("rechaza un hook identico a uno reciente", () => {
  const result = checkNovelty({
    candidate: { theme: "familia", hook: "Hook reciente 1", cta: "Escribime PLAN" },
    recent: RECENT,
  });
  assertEquals(result.ok, false);
});

Deno.test("rechaza un tema repetido mas de maxSameThemeInLookback veces", () => {
  const result = checkNovelty({
    candidate: { theme: "aportes_recibo_sueldo", hook: "Hook nuevo", cta: "Escribime PLAN" },
    recent: RECENT,
  });
  assertEquals(result.ok, false);
});

Deno.test("rechaza un CTA repetido demasiadas veces seguidas", () => {
  const result = checkNovelty({
    candidate: { theme: "familia", hook: "Hook nuevo", cta: "Escribime CARTILLA" },
    recent: [
      { theme: "a", hook: "h1", cta: "Escribime CARTILLA" },
      { theme: "b", hook: "h2", cta: "Escribime CARTILLA" },
      { theme: "c", hook: "h3", cta: "Escribime CARTILLA" },
    ],
  });
  assertEquals(result.ok, false);
});

Deno.test("acepta una pieza con tema/hook/cta con suficiente variedad", () => {
  const result = checkNovelty({
    candidate: { theme: "familia", hook: "Hook completamente nuevo", cta: "Escribime PLAN" },
    recent: RECENT,
  });
  assertEquals(result.ok, true);
});

Deno.test("no revienta si theme es null en el candidato", () => {
  const result = checkNovelty({
    candidate: { theme: null, hook: "Hook nuevo sin tema", cta: "Comentá INFO" },
    recent: RECENT,
  });
  assertEquals(result.ok, true);
});

Deno.test("respeta lookbackN mas chico", () => {
  const result = checkNovelty({
    candidate: { theme: "cartilla", hook: "Hook nuevo", cta: "Escribime PLAN" },
    recent: RECENT,
    lookbackN: 2, // solo mira los 2 mas recientes, ninguno es "cartilla"
  });
  assertEquals(result.ok, true);
});
