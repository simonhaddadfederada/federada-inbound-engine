import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { formatInstagramAlert, formatLeadAlert, sendTelegramAlert } from "./telegram.ts";

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

Deno.test("formatLeadAlert muestra edad y cobertura cuando vienen del flujo minimo de landing", () => {
  const text = formatLeadAlert({
    name: null,
    locality: null,
    phone: "261-555-0000",
    score: 80,
    source_channel: "landing",
    employment_type: null,
    intent_timeframe: null,
    age_range: "26_35",
    has_coverage: false,
  });
  assertStringIncludes(text, "WhatsApp: 261-555-0000");
  assertStringIncludes(text, "Edad: 26 a 35");
  assertStringIncludes(text, "Cobertura actual: No");
});

Deno.test("formatLeadAlert no muestra lineas de datos que no vinieron", () => {
  const text = formatLeadAlert({
    name: null,
    locality: null,
    phone: "261-555-0000",
    score: 80,
    source_channel: "landing",
    employment_type: null,
    intent_timeframe: null,
  });
  assertEquals(text.includes("Edad:"), false);
  assertEquals(text.includes("Cobertura actual:"), false);
  assertEquals(text.includes("Localidad:"), false);
});

Deno.test("formatLeadAlert muestra origen y contenido cuando el lead viene de una pieza atribuida", () => {
  const text = formatLeadAlert(
    {
      name: null,
      locality: null,
      phone: "261-555-0000",
      score: 80,
      source_channel: "landing",
      employment_type: null,
      intent_timeframe: null,
      age_range: "26_35",
      has_coverage: true,
      origin_channel: "instagram",
    },
    {
      format: "reel",
      hook: "¿Sabías que una parte de tu sueldo YA la estás pagando para tu obra social, la uses o no?",
      keyword: "APORTES",
    },
  );
  assertStringIncludes(text, "Origen: Instagram");
  assertStringIncludes(text, "Contenido: Reel —");
  assertStringIncludes(text, "CTA: APORTES");
});

Deno.test("formatLeadAlert no muestra origen ni contenido cuando el lead no viene atribuido", () => {
  const text = formatLeadAlert({
    name: null,
    locality: null,
    phone: "261-555-0000",
    score: 80,
    source_channel: "landing",
    employment_type: null,
    intent_timeframe: null,
  });
  assertEquals(text.includes("Origen:"), false);
  assertEquals(text.includes("Contenido:"), false);
  assertEquals(text.includes("CTA:"), false);
});

Deno.test("formatLeadAlert muestra la referencia del anuncio cuando viene de Meta Ads", () => {
  const text = formatLeadAlert(
    {
      name: null,
      locality: null,
      phone: "261-555-0000",
      score: 80,
      source_channel: "meta_ads",
      employment_type: null,
      intent_timeframe: null,
      origin_channel: "meta_ads",
    },
    null,
    "Campaña camp1 / Anuncio ad1",
  );
  assertStringIncludes(text, "Anuncio: Campaña camp1 / Anuncio ad1");
});

Deno.test("formatLeadAlert no muestra linea de anuncio si no se pasa adRef", () => {
  const text = formatLeadAlert({
    name: null,
    locality: null,
    phone: "261-555-0000",
    score: 80,
    source_channel: "landing",
    employment_type: null,
    intent_timeframe: null,
  });
  assertEquals(text.includes("Anuncio:"), false);
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

Deno.test("formatLeadAlert escapa HTML en campos de texto libre", () => {
  const text = formatLeadAlert({
    name: "<script>alert(1)</script>",
    locality: "Mendoza & alrededores",
    phone: null,
    score: 10,
    source_channel: "landing",
    employment_type: null,
    intent_timeframe: null,
  });
  assertStringIncludes(text, "&lt;script&gt;");
  assertStringIncludes(text, "Mendoza &amp; alrededores");
});

Deno.test("formatInstagramAlert incluye usuario, texto y marca la palabra clave", () => {
  const text = formatInstagramAlert({
    type: "comment",
    username: "juanperez",
    igUserId: "ig123",
    text: "Quiero APORTES",
    matchesKeyword: true,
  });
  assertStringIncludes(text, "@juanperez");
  assertStringIncludes(text, "Quiero APORTES");
  assertStringIncludes(text, "palabra clave");
  assertStringIncludes(text, "Comentario nuevo");
});

Deno.test("formatInstagramAlert usa el id numerico si no hay username (DMs)", () => {
  const text = formatInstagramAlert({
    type: "message",
    username: null,
    igUserId: "17841400000",
    text: "hola",
    matchesKeyword: false,
  });
  assertStringIncludes(text, "usuario 17841400000");
  assertStringIncludes(text, "Mensaje directo");
});

Deno.test("formatInstagramAlert escapa HTML en el texto del mensaje", () => {
  const text = formatInstagramAlert({
    type: "message",
    username: null,
    igUserId: "1",
    text: "<b>hack</b>",
    matchesKeyword: false,
  });
  assertStringIncludes(text, "&lt;b&gt;hack&lt;/b&gt;");
});

Deno.test("sendTelegramAlert reporta el error cuando Telegram responde mal", async () => {
  const fakeFetch = (() =>
    Promise.resolve(new Response("bad request", { status: 400 }))) as typeof fetch;

  const result = await sendTelegramAlert("TOKEN123", "CHAT456", "hola", fakeFetch);

  assertEquals(result.success, false);
  assertStringIncludes(result.detail, "400");
});
