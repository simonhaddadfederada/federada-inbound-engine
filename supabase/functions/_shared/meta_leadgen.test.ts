import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractLeadgenEvents, mapLeadgenFields } from "./meta_leadgen.ts";

Deno.test("extractLeadgenEvents interpreta un webhook real de leadgen", () => {
  const payload = {
    object: "page",
    entry: [
      {
        id: "page123",
        time: 1234567890,
        changes: [
          {
            field: "leadgen",
            value: {
              leadgen_id: "lead1",
              page_id: "page123",
              form_id: "form1",
              ad_id: "ad1",
              campaign_id: "camp1",
            },
          },
        ],
      },
    ],
  };
  const events = extractLeadgenEvents(payload);
  assertEquals(events.length, 1);
  assertEquals(events[0].leadgen_id, "lead1");
  assertEquals(events[0].campaign_id, "camp1");
});

Deno.test("extractLeadgenEvents ignora changes que no son de leadgen", () => {
  const payload = {
    object: "page",
    entry: [{ id: "p", time: 1, changes: [{ field: "feed", value: { leadgen_id: "x" } }] }],
  };
  assertEquals(extractLeadgenEvents(payload).length, 0);
});

Deno.test("extractLeadgenEvents procesa multiples entries", () => {
  const payload = {
    object: "page",
    entry: [
      { id: "p1", time: 1, changes: [{ field: "leadgen", value: { leadgen_id: "a" } }] },
      { id: "p2", time: 2, changes: [{ field: "leadgen", value: { leadgen_id: "b" } }] },
    ],
  };
  assertEquals(extractLeadgenEvents(payload).length, 2);
});

Deno.test("mapLeadgenFields extrae telefono, rango de edad y cobertura", () => {
  const mapped = mapLeadgenFields({
    field_data: [
      { name: "phone_number", values: ["+5492611234567"] },
      { name: "rango_edad", values: ["26_35"] },
      { name: "tiene_cobertura", values: ["No"] },
    ],
  });
  assertEquals(mapped.phone, "+5492611234567");
  assertEquals(mapped.ageRange, "26_35");
  assertEquals(mapped.hasCoverage, false);
});

Deno.test("mapLeadgenFields interpreta variantes de si/no", () => {
  assertEquals(mapLeadgenFields({ field_data: [{ name: "tiene_cobertura", values: ["Sí"] }] }).hasCoverage, true);
  assertEquals(mapLeadgenFields({ field_data: [{ name: "tiene_cobertura", values: ["si"] }] }).hasCoverage, true);
  assertEquals(mapLeadgenFields({ field_data: [{ name: "tiene_cobertura", values: ["no"] }] }).hasCoverage, false);
});

Deno.test("mapLeadgenFields descarta un rango de edad invalido en vez de guardar basura", () => {
  const mapped = mapLeadgenFields({ field_data: [{ name: "rango_edad", values: ["99_100"] }] });
  assertEquals(mapped.ageRange, null);
});

Deno.test("mapLeadgenFields devuelve null en los campos que faltan, sin explotar", () => {
  const mapped = mapLeadgenFields({ field_data: [] });
  assertEquals(mapped.phone, null);
  assertEquals(mapped.ageRange, null);
  assertEquals(mapped.hasCoverage, null);
});
