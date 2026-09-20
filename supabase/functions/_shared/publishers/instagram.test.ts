import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  publisherFor,
  publishInstagramCarousel,
  publishInstagramPost,
  publishInstagramReel,
  publishInstagramStory,
  type PublishablePiece,
} from "./instagram.ts";

const BASE: PublishablePiece = {
  id: "00000000-0000-0000-0000-000000000000",
  slug: "post-de-prueba",
  format: "post",
  hook: "hook",
  cta: "cta",
  assetRef: null,
};

const noCredentials = () => Promise.resolve(null);

Deno.test("publishInstagramPost/Story sin asset quedan bloqueados por falta de asset, no de permiso", async () => {
  const post = await publishInstagramPost({ ...BASE, format: "post" }, noCredentials);
  const story = await publishInstagramStory({ ...BASE, format: "story" }, noCredentials);
  assertEquals(post.status, "blocked");
  assertEquals(story.status, "blocked");
  if (post.status === "blocked") assertStringIncludes(post.reason, "asset");
  if (story.status === "blocked") assertStringIncludes(story.reason, "asset");
});

Deno.test("publishInstagramPost/Story con asset pero sin credenciales quedan bloqueados por falta de token", async () => {
  const piece = { ...BASE, assetRef: "https://example.com/img.png" };
  const post = await publishInstagramPost(piece, noCredentials);
  assertEquals(post.status, "blocked");
  if (post.status === "blocked") assertStringIncludes(post.reason, "platform_tokens");
});

Deno.test("carousel bloqueado por falta de carousel_assets, no por permiso", async () => {
  const carousel = await publishInstagramCarousel(BASE, noCredentials);
  assertEquals(carousel.status, "blocked");
  if (carousel.status === "blocked") assertStringIncludes(carousel.reason, "carousel_assets");
});

Deno.test("reel bloqueado por falta de video, no por permiso", async () => {
  const reel = await publishInstagramReel(BASE, noCredentials);
  assertEquals(reel.status, "blocked");
  if (reel.status === "blocked") assertStringIncludes(reel.reason, "video");
});

Deno.test("carousel con assets pero sin autorizacion real queda bloqueado explicitamente", async () => {
  const result = await publishInstagramCarousel(
    { ...BASE, format: "carousel", carouselAssets: ["a", "b", "c"] },
    noCredentials,
  );
  assertEquals(result.status, "blocked");
  if (result.status === "blocked") assertStringIncludes(result.reason, "no se autorizó");
});

Deno.test("publisherFor devuelve el adapter correcto segun el formato", () => {
  assertEquals(publisherFor("reel"), publishInstagramReel);
  assertEquals(publisherFor("story"), publishInstagramStory);
  assertEquals(publisherFor("carousel"), publishInstagramCarousel);
  assertEquals(publisherFor("post"), publishInstagramPost);
});
