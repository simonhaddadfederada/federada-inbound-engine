import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createImageContainer,
  createStoryContainer,
  createVideoContainer,
  getContainerStatus,
  publishContainer,
  publishContainerWithRetry,
  refreshLongLivedToken,
  waitForContainerReady,
} from "./instagram_graph.ts";

const noDelay = () => Promise.resolve();

function fakeFetch(response: unknown, ok = true, status = 200): typeof fetch {
  return (() => Promise.resolve(new Response(JSON.stringify(response), { status: ok ? status : 400 }))) as typeof fetch;
}

Deno.test("createImageContainer devuelve el id cuando la API responde bien", async () => {
  const result = await createImageContainer("ig1", "tok", "https://x/img.png", "hola", fakeFetch({ id: "container1" }));
  assertEquals(result, { ok: true, id: "container1" });
});

Deno.test("createStoryContainer arma el request con media_type STORIES", async () => {
  let capturedBody = "";
  const fetchImpl = ((url: string, init?: RequestInit) => {
    capturedBody = String(init?.body);
    return Promise.resolve(new Response(JSON.stringify({ id: "c1" }), { status: 200 }));
  }) as typeof fetch;
  await createStoryContainer("ig1", "tok", "https://x/img.png", fetchImpl);
  assertEquals(capturedBody.includes("media_type=STORIES"), true);
});

Deno.test("publishContainer devuelve el id publicado", async () => {
  const result = await publishContainer("ig1", "tok", "container1", fakeFetch({ id: "media1" }));
  assertEquals(result, { ok: true, id: "media1" });
});

Deno.test("devuelve error legible cuando Meta responde con un error de permisos", async () => {
  const result = await createImageContainer(
    "ig1",
    "tok",
    "https://x/img.png",
    "",
    fakeFetch({ error: { message: "Permisos insuficientes" } }, false),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.error, "Permisos insuficientes");
});

Deno.test("devuelve error legible si hay un problema de red", async () => {
  const brokenFetch = (() => Promise.reject(new Error("timeout"))) as typeof fetch;
  const result = await createImageContainer("ig1", "tok", "https://x/img.png", "", brokenFetch);
  assertEquals(result.ok, false);
});

Deno.test("refreshLongLivedToken devuelve el token nuevo y su duracion", async () => {
  const result = await refreshLongLivedToken(
    "old-token",
    fakeFetch({ access_token: "new-token", token_type: "bearer", expires_in: 5184000 }),
  );
  assertEquals(result, { ok: true, accessToken: "new-token", expiresInSeconds: 5184000 });
});

Deno.test("publishContainerWithRetry reintenta un error transitorio y termina publicando", async () => {
  let calls = 0;
  const flakyFetch = (() => {
    calls++;
    if (calls < 2) {
      return Promise.resolve(new Response(JSON.stringify({ error: { message: "transitorio" } }), { status: 400 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ id: "media1" }), { status: 200 }));
  }) as typeof fetch;

  const result = await publishContainerWithRetry("ig1", "tok", "container1", flakyFetch, 3, noDelay);
  assertEquals(result, { ok: true, id: "media1" });
  assertEquals(calls, 2);
});

Deno.test("publishContainerWithRetry se rinde despues de maxAttempts y devuelve el ultimo error", async () => {
  let calls = 0;
  const alwaysFails = (() => {
    calls++;
    return Promise.resolve(new Response(JSON.stringify({ error: { message: "sigue fallando" } }), { status: 400 }));
  }) as typeof fetch;

  const result = await publishContainerWithRetry("ig1", "tok", "container1", alwaysFails, 3, noDelay);
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.error, "sigue fallando");
  assertEquals(calls, 3);
});

Deno.test("createVideoContainer arma el request con media_type REELS", async () => {
  let capturedBody = "";
  const fetchImpl = ((url: string, init?: RequestInit) => {
    capturedBody = String(init?.body);
    return Promise.resolve(new Response(JSON.stringify({ id: "c1" }), { status: 200 }));
  }) as typeof fetch;
  await createVideoContainer("ig1", "tok", "https://x/reel.mp4", "hola", "REELS", fetchImpl);
  assertEquals(capturedBody.includes("media_type=REELS"), true);
  assertEquals(capturedBody.includes("video_url="), true);
});

Deno.test("getContainerStatus devuelve el status_code real", async () => {
  const result = await getContainerStatus("c1", "tok", fakeFetch({ status_code: "FINISHED" }));
  assertEquals(result, { ok: true, status: "FINISHED" });
});

Deno.test("waitForContainerReady devuelve ok apenas ve FINISHED, sin agotar los intentos", async () => {
  let calls = 0;
  const fetchImpl = (() => {
    calls++;
    const status = calls < 3 ? "IN_PROGRESS" : "FINISHED";
    return Promise.resolve(new Response(JSON.stringify({ status_code: status }), { status: 200 }));
  }) as typeof fetch;
  const result = await waitForContainerReady("c1", "tok", fetchImpl, 10, 0, noDelay);
  assertEquals(result, { ok: true });
  assertEquals(calls, 3);
});

Deno.test("waitForContainerReady devuelve error real si Meta marca ERROR", async () => {
  const result = await waitForContainerReady(
    "c1",
    "tok",
    fakeFetch({ status_code: "ERROR" }),
    10,
    0,
    noDelay,
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertStringIncludes(result.error, "ERROR");
});

Deno.test("waitForContainerReady se rinde con timeout si nunca llega a FINISHED", async () => {
  const result = await waitForContainerReady(
    "c1",
    "tok",
    fakeFetch({ status_code: "IN_PROGRESS" }),
    3,
    0,
    noDelay,
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertStringIncludes(result.error, "Timeout");
});

Deno.test("refreshLongLivedToken devuelve error legible si Meta lo rechaza", async () => {
  const result = await refreshLongLivedToken(
    "token-invalido",
    fakeFetch({ error: { message: "Session key invalid" } }, false),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.error, "Session key invalid");
});
