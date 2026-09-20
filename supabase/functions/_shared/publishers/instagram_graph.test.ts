import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createImageContainer, createStoryContainer, publishContainer, refreshLongLivedToken } from "./instagram_graph.ts";

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

Deno.test("refreshLongLivedToken devuelve error legible si Meta lo rechaza", async () => {
  const result = await refreshLongLivedToken(
    "token-invalido",
    fakeFetch({ error: { message: "Session key invalid" } }, false),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.error, "Session key invalid");
});
