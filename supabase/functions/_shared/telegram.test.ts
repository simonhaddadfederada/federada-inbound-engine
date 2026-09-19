import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatLeadAlert, sendTelegramAlert } from "./telegram.ts";

Deno.test("formatLeadAlert incluye los datos clave del lead", () => {
  const text = formatLeadAlert({
    name: "Juana Pérez",
    locality: "Godoy Cruz",
    phone: "261...",
    score: 95,
    source_channel: "landing",
    employment_type: "dependencia",
    intent_timeframe: "inmediato",
  });
  assertStringIncludes(text, "Juana Pérez");
  assertStringIncludes(text, "Godoy Cruz");
  assertStringIncludes(text, "95");
  assertStringIncludes(text, "CONTACTAR AHORA");
});

Deno.test("sendTelegramAlert devuelve error claro si faltan credenciales", async () => {
  const result = await sendTelegramAlert("", "", "hola");
  assertEquals(result.success, false);
  assertStringIncludes(result.detail, "Falta");
});

Deno.test("sendTelegramAlert usa el fetch inyectado y reporta éxito", async () => {
  let calledUrl = "";
  let calledBody: unknown = null;
  const fakeFetch = ((url: string, init?: RequestInit) => {
    calledUrl = url;
    calledBody = JSON.parse(String(init?.body));
    return Promise.resolve(new Response("{}", { status: 200 }));
  }) as typeof fetch;

  const result = await sendTelegramAlert("TOKEN123", "CHAT456", "hola lead", fakeFetch);

  assertEquals(result.success, true);
  assertStringIncludes(calledUrl, "TOKEN123");
  assertEquals((calledBody as { chat_id: string }).chat_id, "CHAT456");
  assertEquals((calledBody as { text: string }).text, "hola lead");
});

Deno.test("sendTelegramAlert reporta el error cuando Telegram responde mal", async () => {
  const fakeFetch = (() =>
    Promise.resolve(new Response("bad request", { status: 400 }))) as typeof fetch;

  const result = await sendTelegramAlert("TOKEN123", "CHAT456", "hola", fakeFetch);

  assertEquals(result.success, false);
  assertStringIncludes(result.detail, "400");
});
