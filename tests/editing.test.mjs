// M3's rules: who sees what, who may change what, snapping, frames, notes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork } from "./foundry.mjs";

const { visibleTo, canModify, snapBox, centreInside, noteCreateData, frameCreateData, frameViewData, CARD_SIZE, FRAME_SIZE } = threadwork;

const gm = { id: "gm", isGM: true };
const one = { id: "p1", isGM: false };
const two = { id: "p2", isGM: false };

test("everyone sees an item for everyone", () => {
  for (const user of [gm, one, two]) assert.equal(visibleTo({ visibility: "everyone", author: "p1" }, user), true);
});

test("a GM-only item is drawn for GMs alone", () => {
  assert.equal(visibleTo({ visibility: "gm", author: "p1" }, gm), true);
  assert.equal(visibleTo({ visibility: "gm", author: "p1" }, one), false, "not even for its author");
});

test("a private item is drawn for its author and the GM, not other players", () => {
  const item = { visibility: "private", author: "p1" };
  assert.equal(visibleTo(item, one), true);
  assert.equal(visibleTo(item, gm), true);
  assert.equal(visibleTo(item, two), false);
});

test("players may change anything the GM has not locked; the GM may change anything", () => {
  assert.equal(canModify({ locked: false }, one), true);
  assert.equal(canModify({ locked: true }, one), false);
  assert.equal(canModify({ locked: true }, gm), true);
});

test("a dragged card snaps its edge to a nearby card's edge", () => {
  const other = { x: 100, y: 500, w: 200, h: 100 };
  const { dx, dy, guides } = snapBox({ x: 106, y: 100, w: 200, h: 100 }, [other], 8);
  assert.equal(dx, -6, "left edges line up");
  assert.equal(dy, 0, "nothing near vertically");
  assert.equal(guides.length, 1);
  assert.equal(guides[0].x1, 100);
  assert.ok(guides[0].y1 < 100 && guides[0].y2 > 600, "the guide spans both cards");
});

test("centres snap too, and the closest match wins", () => {
  const other = { x: 0, y: 0, w: 300, h: 100 };
  // This box's centre is at 153, 3 away from the other's centre at 150; its left is 50 from any edge.
  const { dx } = snapBox({ x: 103, y: 400, w: 100, h: 100 }, [other], 8);
  assert.equal(dx, -3);
});

test("nothing snaps beyond the threshold", () => {
  const { dx, dy, guides } = snapBox({ x: 150, y: 150, w: 100, h: 100 }, [{ x: 0, y: 0, w: 100, h: 100 }], 8);
  assert.deepEqual([dx, dy, guides.length], [0, 0, 0]);
});

test("a frame carries the cards whose centres are inside it", () => {
  const frame = { x: 0, y: 0, w: 500, h: 400 };
  assert.equal(centreInside({ x: 400, y: 300, w: 180, h: 80 }, frame), true, "hanging off the edge but centred inside");
  assert.equal(centreInside({ x: 450, y: 300, w: 200, h: 80 }, frame), false, "mostly outside");
});

test("a new note or concept is centred on where it was made, with nothing written yet", () => {
  const note = noteCreateData("text", { x: 1000, y: 800 }, "p1");
  assert.equal(note.system.kind, "text");
  assert.equal(note.system.x, 1000 - CARD_SIZE.text.w / 2);
  assert.equal(note.system.caption, "");
  assert.equal(note.system.uuid, null);
  assert.equal(noteCreateData("hub", { x: 0, y: 0 }, "p1").system.w, CARD_SIZE.hub.w);
});

test("a string is drawn only when both its cards are", async () => {
  const { visiblePages } = await import("../scripts/layer.js");
  const card = (id, visibility = "everyone", author = "p1") => ({ id, type: "threadwork.card", system: { visibility, author } });
  const string = (id, from, to) => ({ id, type: "threadwork.string", system: { from, to, visibility: "everyone", author: "p1" } });
  const pages = [card("kyra"), card("secret", "private", "p1"), string("s1", "kyra", "secret"), string("s2", "kyra", "kyra2"), card("kyra2")];
  const forTwo = visiblePages(pages, two);
  assert.deepEqual(forTwo.cards.map((p) => p.id), ["kyra", "kyra2"]);
  assert.deepEqual(forTwo.strings.map((p) => p.id), ["s2"], "the string to Player One's private card is hidden from Player Two");
  assert.deepEqual(visiblePages(pages, one).strings.map((p) => p.id), ["s1", "s2"], "its author sees it all");
});

test("a new frame is centred on where it was made", () => {
  const frame = frameCreateData({ x: 2000, y: 1000 }, "p1");
  assert.equal(frame.type, "threadwork.frame");
  assert.equal(frame.system.x, 2000 - FRAME_SIZE.w / 2);
  assert.equal(frame.system.title, "New frame");
  const view = frameViewData({ id: "f", system: { ...frame.system, color: null, visibility: "everyone", locked: false } });
  assert.equal(view.color, null);
  assert.equal(view.title, "New frame");
});
