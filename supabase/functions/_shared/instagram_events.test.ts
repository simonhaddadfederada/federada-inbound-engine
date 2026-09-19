import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractEvents,
  matchesTriggerKeyword,
  type InstagramWebhookPayload,
} from "./instagram_events.ts";

Deno.test("matchesTriggerKeyword detecta palabras clave sin importar mayusculas", () => {
  assertEquals(matchesTriggerKeyword("quiero aportes porfa"), true);
  assertEquals(matchesTriggerKeyword("mandame el PLAN"), true);
  assertEquals(matchesTriggerKeyword("cuanto sale?"), false);
  assertEquals(matchesTriggerKeyword(null), false);
  assertEquals(matchesTriggerKeyword(""), false);
});

Deno.test("extractEvents interpreta un comentario con palabra clave", () => {
  const payload: InstagramWebhookPayload = {
    object: "instagram",
    entry: [
      {
        id: "17841439114787646",
        time: 1700000000,
        changes: [
          {
            field: "comments",
            value: {
              id: "comment_123",
              text: "Hola! Mandame APORTES por favor",
              from: { id: "ig_user_1", username: "juanperez" },
              media: { id: "media_1" },
            },
          },
        ],
      },
    ],
  };

  const events = extractEvents(payload);
  assertEquals(events.length, 1);
  assertEquals(events[0].type, "comment");
  assertEquals(events[0].eventKey, "comment:comment_123");
  assertEquals(events[0].username, "juanperez");
  assertEquals(events[0].matchesKeyword, true);
});

Deno.test("extractEvents interpreta un mensaje directo sin palabra clave", () => {
  const payload: InstagramWebhookPayload = {
    object: "instagram",
    entry: [
      {
        id: "17841439114787646",
        messaging: [
          {
            sender: { id: "ig_user_2" },
            message: { mid: "msg_456", text: "Hola buenas tardes" },
          },
        ],
      },
    ],
  };

  const events = extractEvents(payload);
  assertEquals(events.length, 1);
  assertEquals(events[0].type, "message");
  assertEquals(events[0].eventKey, "message:msg_456");
  assertEquals(events[0].username, null);
  assertEquals(events[0].igUserId, "ig_user_2");
  assertEquals(events[0].matchesKeyword, false);
});

Deno.test("extractEvents ignora campos que no son comentarios (ej: likes)", () => {
  const payload: InstagramWebhookPayload = {
    object: "instagram",
    entry: [
      {
        id: "17841439114787646",
        changes: [
          { field: "live_comments", value: { id: "x" } },
        ],
      },
    ],
  };

  assertEquals(extractEvents(payload).length, 0);
});

Deno.test("extractEvents ignora eventos de mensajeria sin mensaje (ej: read receipts)", () => {
  const payload: InstagramWebhookPayload = {
    object: "instagram",
    entry: [
      {
        id: "17841439114787646",
        messaging: [
          { sender: { id: "ig_user_3" }, timestamp: 123 },
        ],
      },
    ],
  };

  assertEquals(extractEvents(payload).length, 0);
});

Deno.test("extractEvents procesa multiples entries y eventos juntos", () => {
  const payload: InstagramWebhookPayload = {
    object: "instagram",
    entry: [
      {
        id: "acct",
        changes: [
          {
            field: "comments",
            value: { id: "c1", text: "precio?", from: { id: "u1", username: "ana" } },
          },
        ],
      },
      {
        id: "acct",
        messaging: [
          { sender: { id: "u2" }, message: { mid: "m1", text: "hola" } },
        ],
      },
    ],
  };

  const events = extractEvents(payload);
  assertEquals(events.length, 2);
  assertEquals(events[0].type, "comment");
  assertEquals(events[1].type, "message");
});
