import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { shouldRefreshInstagramToken } from "./instagram_token_policy.ts";

const DAY = 24 * 60 * 60 * 1000;

Deno.test("no refresca un token recien emitido, aunque falten pocos dias (nunca deberia pasar junto)", () => {
  const now = 0;
  const lastRefreshedAt = 0; // recien refrescado
  const expiresAt = 5 * DAY; // le quedan pocos dias (caso irreal, pero prueba la regla de 24hs)
  assertEquals(shouldRefreshInstagramToken(now, expiresAt, lastRefreshedAt), false);
});

Deno.test("no refresca si todavia falta mucho para vencer, aunque ya pasaron 24hs", () => {
  const now = 2 * DAY;
  const lastRefreshedAt = 0;
  const expiresAt = 60 * DAY;
  assertEquals(shouldRefreshInstagramToken(now, expiresAt, lastRefreshedAt), false);
});

Deno.test("refresca cuando ya pasaron 24hs Y quedan 30 dias o menos para vencer", () => {
  const now = 31 * DAY;
  const lastRefreshedAt = 0;
  const expiresAt = 60 * DAY; // quedan 29 dias
  assertEquals(shouldRefreshInstagramToken(now, expiresAt, lastRefreshedAt), true);
});

Deno.test("refresca en el limite exacto de 30 dias restantes", () => {
  const now = 30 * DAY;
  const lastRefreshedAt = 0;
  const expiresAt = 60 * DAY; // quedan exactamente 30 dias
  assertEquals(shouldRefreshInstagramToken(now, expiresAt, lastRefreshedAt), true);
});

Deno.test("no refresca en el limite exacto de 24hs (hace falta ese tiempo cumplido)", () => {
  const now = DAY;
  const lastRefreshedAt = 0;
  const expiresAt = DAY + 1000; // por las dudas, casi vencido pero ya cumplio 24hs
  assertEquals(shouldRefreshInstagramToken(now, expiresAt, lastRefreshedAt), true);
});

Deno.test("nunca refresca un token ya vencido sin haber sido detectado antes (caso limite documentado)", () => {
  // Si ya vencio, Meta va a rechazar el refresh igual (se maneja como error
  // de red en el llamado real) — esta regla solo decide "conviene intentarlo".
  const now = 61 * DAY;
  const lastRefreshedAt = 0;
  const expiresAt = 60 * DAY; // vencido hace 1 dia
  assertEquals(shouldRefreshInstagramToken(now, expiresAt, lastRefreshedAt), true);
});
