import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canSpend, remainingBudgetUsd } from "./ai_budget.ts";

Deno.test("permite gastar si queda presupuesto suficiente", () => {
  assertEquals(canSpend(0.5, 0.3, 2), true);
});

Deno.test("rechaza si se pasaria del presupuesto diario", () => {
  assertEquals(canSpend(1.8, 0.3, 2), false);
});

Deno.test("rechaza exactamente en el limite mas un centavo", () => {
  assertEquals(canSpend(1.99, 0.02, 2), false);
});

Deno.test("acepta justo en el limite exacto", () => {
  assertEquals(canSpend(1.5, 0.5, 2), true);
});

Deno.test("presupuesto en cero o negativo nunca permite gastar", () => {
  assertEquals(canSpend(0, 0.01, 0), false);
  assertEquals(canSpend(0, 0.01, -5), false);
});

Deno.test("remainingBudgetUsd nunca es negativo", () => {
  assertEquals(remainingBudgetUsd(3, 2), 0);
  assertEquals(remainingBudgetUsd(0.5, 2), 1.5);
});
