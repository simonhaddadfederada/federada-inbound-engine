import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scheduledAtFor, scheduledAtUtc, slotTimeFor } from "./scheduling.ts";

const SLOTS = {
  reel: ["12:30"],
  carousel: ["17:00"],
  story: ["09:30", "19:00"],
  post: ["16:00"],
};

Deno.test("scheduledAtUtc convierte hora local de Mendoza (UTC-3) a UTC", () => {
  assertEquals(scheduledAtUtc("2026-09-21", "12:30"), "2026-09-21T15:30:00.000Z");
});

Deno.test("scheduledAtUtc funciona cerca de medianoche (cruza de dia)", () => {
  assertEquals(scheduledAtUtc("2026-09-21", "22:00"), "2026-09-22T01:00:00.000Z");
});

Deno.test("scheduledAtUtc rechaza fecha/hora invalida", () => {
  assertThrows(() => scheduledAtUtc("fecha-mala", "12:30"));
});

Deno.test("slotTimeFor cicla sobre los horarios configurados", () => {
  assertEquals(slotTimeFor("story", 0, SLOTS), "09:30");
  assertEquals(slotTimeFor("story", 1, SLOTS), "19:00");
  assertEquals(slotTimeFor("story", 2, SLOTS), "09:30"); // vuelve a ciclar
});

Deno.test("slotTimeFor lanza error claro si el formato no tiene horarios", () => {
  assertThrows(() => slotTimeFor("story", 0, { ...SLOTS, story: [] }));
});

Deno.test("scheduledAtFor combina fecha + formato + slot en un solo llamado", () => {
  assertEquals(scheduledAtFor("2026-09-22", "story", 1, SLOTS), "2026-09-22T22:00:00.000Z");
});
