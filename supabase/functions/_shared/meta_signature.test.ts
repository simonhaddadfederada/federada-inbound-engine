import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyMetaSignature } from "./meta_signature.ts";

// Vector de prueba conocido e independiente (HMAC-SHA256, RFC 4231 / de uso
// común para verificar implementaciones): clave "key", mensaje "The quick
// brown fox jumps over the lazy dog" -> este hash exacto.
const KNOWN_KEY = "key";
const KNOWN_MESSAGE = "The quick brown fox jumps over the lazy dog";
const KNOWN_HMAC_SHA256_HEX =
  "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";

Deno.test("verifica correctamente una firma válida (vector conocido)", async () => {
  const ok = await verifyMetaSignature(
    KNOWN_KEY,
    KNOWN_MESSAGE,
    `sha256=${KNOWN_HMAC_SHA256_HEX}`,
  );
  assertEquals(ok, true);
});

Deno.test("rechaza una firma con el hash incorrecto", async () => {
  const ok = await verifyMetaSignature(
    KNOWN_KEY,
    KNOWN_MESSAGE,
    "sha256=0000000000000000000000000000000000000000000000000000000000000000",
  );
  assertEquals(ok, false);
});

Deno.test("rechaza si el algoritmo no es sha256", async () => {
  const ok = await verifyMetaSignature(
    KNOWN_KEY,
    KNOWN_MESSAGE,
    `sha1=${KNOWN_HMAC_SHA256_HEX}`,
  );
  assertEquals(ok, false);
});

Deno.test("rechaza si falta el header de firma", async () => {
  const ok = await verifyMetaSignature(KNOWN_KEY, KNOWN_MESSAGE, null);
  assertEquals(ok, false);
});

Deno.test("rechaza si el body cambió (payload distinto)", async () => {
  const ok = await verifyMetaSignature(
    KNOWN_KEY,
    KNOWN_MESSAGE + " modificado",
    `sha256=${KNOWN_HMAC_SHA256_HEX}`,
  );
  assertEquals(ok, false);
});
