import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  publisherFor,
  publishInstagramCarousel,
  publishInstagramPost,
  publishInstagramReel,
  publishInstagramStory,
  type PublishablePiece,
} from "./instagram.ts";

const PIECE: PublishablePiece = {
  id: "00000000-0000-0000-0000-000000000000",
  slug: "reel-de-prueba",
  format: "reel",
  hook: "hook",
  cta: "cta",
  assetRef: null,
};

Deno.test("los 4 adapters devuelven blocked hoy, con el motivo exacto (permiso + App Review)", async () => {
  for (const fn of [publishInstagramReel, publishInstagramStory, publishInstagramCarousel, publishInstagramPost]) {
    const result = await fn(PIECE);
    assertEquals(result.status, "blocked");
    if (result.status === "blocked") {
      assertStringIncludes(result.reason, "instagram_business_content_publish");
      assertStringIncludes(result.reason, "App Review");
    }
  }
});

Deno.test("publisherFor devuelve el adapter correcto segun el formato", () => {
  assertEquals(publisherFor("reel"), publishInstagramReel);
  assertEquals(publisherFor("story"), publishInstagramStory);
  assertEquals(publisherFor("carousel"), publishInstagramCarousel);
  assertEquals(publisherFor("post"), publishInstagramPost);
});
