import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isPastLastCheckpoint, nextMetricsCheckpointDue } from "./metrics_checkpoint_policy.ts";

const H = 60 * 60 * 1000;

Deno.test("no hay checkpoint pendiente recien publicado", () => {
  assertEquals(nextMetricsCheckpointDue(0, 0, null), false);
});

Deno.test("checkpoint de 2 horas pendiente si nunca se midio", () => {
  assertEquals(nextMetricsCheckpointDue(3 * H, 0, null), true);
});

Deno.test("no hay checkpoint pendiente si ya se midio despues de ese checkpoint", () => {
  assertEquals(nextMetricsCheckpointDue(3 * H, 0, 2.5 * H), false);
});

Deno.test("checkpoint de 24 horas pendiente aunque ya se haya medido el de 2 horas", () => {
  // se midio a las 2.5hs (cubrio el checkpoint de 2hs), ahora estamos en 25hs
  assertEquals(nextMetricsCheckpointDue(25 * H, 0, 2.5 * H), true);
});

Deno.test("checkpoint de 72 horas pendiente", () => {
  assertEquals(nextMetricsCheckpointDue(73 * H, 0, 25 * H), true);
});

Deno.test("ningun checkpoint pendiente despues de medir los 3", () => {
  assertEquals(nextMetricsCheckpointDue(100 * H, 0, 73 * H), false);
});

Deno.test("isPastLastCheckpoint indica cuando ya no hace falta seguir midiendo", () => {
  assertEquals(isPastLastCheckpoint(71 * H, 0), false);
  assertEquals(isPastLastCheckpoint(72 * H, 0), true);
});
