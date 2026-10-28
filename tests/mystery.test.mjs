// Mystery mechanics (SPEC.md 10): the shadowed stub, and how sure the table
// is of a string. The point of most of these is that a board which never
// touches either of them keeps exactly the look and data it had in v1.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork } from "./foundry.mjs";
import { constellation as theme } from "../scripts/themes/constellation.js";

const { cardViewData, stringViewData, shadowedFor, shadowCardData, shadowStringData, SHADOW_TEXT } = threadwork;
const { dashedSegments, flowsFor } = await import("../scripts/draw/string.js");

const cardPage = (system) => ({
  id: "c1", name: "Page name",
  system: { kind: "document", uuid: "Actor.a1", x: 10, y: 20, w: 380, h: 132, caption: "", lastName: "", lastImg: null, visibility: "everyone", author: "u1", locked: false, ...system }
});
const stringPage = (system) => ({
  id: "s1", name: "a → b",
  system: { from: "c1", to: "c2", label: "owes money to", arrows: "forward", color: null, visibility: "everyone", author: "u1", locked: false, ...system }
});
const doc = { documentName: "Actor", name: "Mayor Oskar", img: "oskar.webp" };

/* -------------------------------------------- */
/*  Defaults, so a live board does not change   */
/* -------------------------------------------- */

test("a page saved before M6 reads as revealed and confirmed", () => {
  const card = cardViewData(cardPage({}), doc);
  const string = stringViewData(stringPage({}));
  assert.equal(card.state, "revealed");
  assert.equal(string.state, "revealed");
  assert.equal(string.certainty, "confirmed");
});

test("a confirmed string carries light, and the less certain ones do not", () => {
  assert.equal(flowsFor(theme, "confirmed"), true);
  assert.equal(flowsFor(theme, "suspected"), false);
  assert.equal(flowsFor(theme, "rumored"), false);
  // Anything unsaid is treated as settled, so v1 data flows as it always did.
  assert.equal(flowsFor(theme, undefined), true);
});

/* -------------------------------------------- */
/*  Shadowing                                   */
/* -------------------------------------------- */

test("only the people it is shadowed from get the shadow; the GM sees the real thing", () => {
  const shadowed = cardViewData(cardPage({ state: "shadowed" }), doc);
  assert.equal(shadowedFor(shadowed, false), true);
  assert.equal(shadowedFor(shadowed, true), false);
  assert.equal(shadowedFor(cardViewData(cardPage({}), doc), false), false);
});

test("a shadowed card hands the renderer no name, caption or portrait", () => {
  const data = shadowCardData(cardViewData(cardPage({ state: "shadowed", caption: "Took the ledger" }), doc));
  assert.equal(data.name, SHADOW_TEXT);
  assert.equal(data.caption, "");
  assert.equal(data.img, null);
  assert.equal(data.shadowed, true);
  // Still a card in a place: the table can see that something is there.
  assert.equal(data.x, 10);
  assert.equal(data.y, 20);
  assert.equal(data.id, "c1");
});

test("a shadowed card does not read as a deleted one", () => {
  const gone = cardViewData(cardPage({ state: "shadowed" }), null);
  assert.equal(gone.missing, true, "the document really is gone");
  assert.equal(shadowCardData(gone).missing, false, "but the table must not be told which");
});

test("a shadowed string keeps its ends and loses its label", () => {
  const data = shadowStringData(stringViewData(stringPage({ state: "shadowed" })));
  assert.equal(data.label, "");
  assert.equal(data.shadowed, true);
  assert.equal(data.from, "c1");
  assert.equal(data.to, "c2");
});

test("a shadowed string does not pass on how sure the GM was of it", () => {
  const confirmed = stringViewData(stringPage({ state: "shadowed", certainty: "confirmed" }));
  assert.equal(shadowStringData(confirmed).certainty, "rumored");
});

/* -------------------------------------------- */
/*  Dashes                                      */
/* -------------------------------------------- */

const straight = { p0: { x: 0, y: 0 }, p1: { x: 200, y: 0 }, p2: { x: 400, y: 0 } };
const spanOf = (run) => Math.abs(run[run.length - 2] - run[0]);

test("a rumoured string is cut into dashes along its whole length", () => {
  const runs = dashedSegments(straight, 20, 10);
  assert.ok(runs.length > 5, `expected several dashes, got ${runs.length}`);
  assert.ok(runs[0][0] < 10, "starts near the beginning of the curve");
  const last = runs[runs.length - 1];
  assert.ok(last[last.length - 2] > 380, "and runs out near the end");
});

test("dashes and the gaps between them hold their lengths", () => {
  const runs = dashedSegments(straight, 20, 10);
  for (const run of runs.slice(1, -1)) {
    assert.ok(Math.abs(spanOf(run) - 20) <= 4, `dash was ${spanOf(run)}`);
  }
  for (let i = 1; i < runs.length - 1; i++) {
    const gap = runs[i][0] - runs[i - 1][runs[i - 1].length - 2];
    assert.ok(Math.abs(gap - 10) <= 4, `gap was ${gap}`);
  }
});

test("a curve that bends is still dashed evenly", () => {
  const bowed = { p0: { x: 0, y: 0 }, p1: { x: 200, y: 300 }, p2: { x: 400, y: 0 } };
  const runs = dashedSegments(bowed, 20, 10);
  for (const run of runs.slice(1, -1)) {
    let length = 0;
    for (let i = 2; i < run.length; i += 2) length += Math.hypot(run[i] - run[i - 2], run[i + 1] - run[i - 1]);
    assert.ok(Math.abs(length - 20) <= 4, `dash measured ${length} along the curve`);
  }
});

test("no dash length means no dashes, so the solid path is used instead", () => {
  assert.deepEqual(dashedSegments(straight, 0, 10), []);
  assert.deepEqual(dashedSegments(straight, 0, 0), []);
});

test("a string with nowhere to go does not hang or divide by zero", () => {
  const point = { p0: { x: 5, y: 5 }, p1: { x: 5, y: 5 }, p2: { x: 5, y: 5 } };
  const runs = dashedSegments(point, 20, 10);
  assert.ok(Array.isArray(runs));
  for (const run of runs) assert.ok(run.every(Number.isFinite));
});

/* -------------------------------------------- */
/*  The theme                                   */
/* -------------------------------------------- */

test("every certainty has a look, and confirmed is the undashed one v1 drew", () => {
  for (const key of ["rumored", "suspected", "confirmed"]) {
    assert.ok(theme.string.certainty[key], `${key} has no look`);
  }
  assert.equal(theme.string.certainty.confirmed.alpha, 1);
  assert.equal(theme.string.certainty.confirmed.dash, 0);
  assert.ok(theme.string.certainty.rumored.dash > 0);
});
