import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { replyWithLandingLink } from "./instagram.ts";

Deno.test("replyWithLandingLink esta bloqueado hoy, con el motivo exacto", async () => {
  const result = await replyWithLandingLink("user123", "https://example.com/?content=x");
  assertEquals(result.status, "blocked");
  if (result.status === "blocked") {
    assertStringIncludes(result.reason, "instagram_business_manage_messages");
  }
});
