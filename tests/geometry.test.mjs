// Where strings leave cards, how they bow, and where arrowheads and labels sit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork } from "./foundry.mjs";

const { edgePoint, controlPoint, curveThrough, stringCurve, quadPoint, quadLength, arrowHead, bowFor, center, STRING_SPACING } = threadwork;

const box = (x, y, w = 200, h = 100) => ({ x, y, w, h });
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`);

test("a string leaves a card at its edge, not its centre", () => {
  const card = box(0, 0);
  const right = edgePoint(card, { x: 1000, y: 50 });
  close(right.x, 200, "straight right exits the right edge");
  close(right.y, 50, "at the card's middle height");
  const below = edgePoint(card, { x: 100, y: 900 });
  close(below.y, 100, "straight down exits the bottom edge");
  // 45 degrees from a card twice as wide as it is tall reaches the bottom first.
  const diagonal = edgePoint(card, { x: 300, y: 250 });
  close(diagonal.y, 100, "a diagonal exits whichever edge it reaches first");
  close(diagonal.x, 150, "partway along that edge");
});

test("padding stops the string short of the card", () => {
  const p = edgePoint(box(0, 0), { x: 1000, y: 50 }, 10);
  close(p.x, 210, "10px clear of the right edge");
});

test("the curve's ends sit on each card's padded edge", () => {
  const a = box(0, 0), b = box(800, 300);
  const curve = stringCurve(a, b, { pad: 10 });
  const onEdge = (p, card) => {
    const dx = Math.abs(p.x - center(card).x) - (card.w / 2 + 10);
    const dy = Math.abs(p.y - center(card).y) - (card.h / 2 + 10);
    return Math.abs(Math.max(dx, dy)) < 1e-6;
  };
  assert.ok(onEdge(curve.p0, a), "starts on the first card's edge");
  assert.ok(onEdge(curve.p2, b), "ends on the second card's edge");
});

test("a lone string bows gently, and the bow grows with distance up to a cap", () => {
  assert.equal(bowFor(100), 24, "short strings get the minimum bow");
  assert.equal(bowFor(600), 60);
  assert.equal(bowFor(5000), 120, "long strings stop bowing more");
});

test("strings sharing two cards fan out by a fixed spacing", () => {
  const a = box(0, 0), b = box(800, 0);
  const first = controlPoint(a, b, { index: 0, count: 2 });
  const second = controlPoint(a, b, { index: 1, count: 2 });
  close(Math.abs(second.y - first.y), STRING_SPACING, "one spacing apart");
});

test("strings in opposite directions between the same cards do not overlap", () => {
  const a = box(0, 0), b = box(800, 0);
  // The flip flag is set when a string runs from the later card id to the earlier one.
  const there = controlPoint(a, b, { index: 0, count: 2, flip: false });
  const back = controlPoint(b, a, { index: 1, count: 2, flip: true });
  assert.ok(Math.abs(there.y - back.y) > STRING_SPACING - 1, `${there.y} vs ${back.y}`);
});

test("curveThrough uses the control point it is given, so a lagging bend is drawn as it is", () => {
  const control = { x: 400, y: -300 };
  const curve = curveThrough(box(0, 0), box(800, 0), control);
  assert.deepEqual(curve.p1, control);
});

test("the label anchor is the curve's midpoint and lies between the cards", () => {
  const curve = stringCurve(box(0, 0), box(800, 0));
  const mid = quadPoint(curve, 0.5);
  assert.ok(mid.x > 200 && mid.x < 800, `${mid.x}`);
});

test("the arrowhead's tip is the curve's end, and it points along the curve", () => {
  const curve = { p0: { x: 0, y: 0 }, p1: { x: 50, y: 0 }, p2: { x: 100, y: 0 } };
  const head = arrowHead(curve, 20);
  assert.deepEqual(head.tip, { x: 100, y: 0 });
  close(head.base.x, 80, "the base sits one arrow length back");
  close(head.left.y, -head.right.y, "the two barbs are symmetric");
});

test("a growing string's partial curve starts where the string does and ends on it", () => {
  const { splitCurve } = threadwork;
  const curve = stringCurve(box(0, 0), box(800, 300));
  const half = splitCurve(curve, 0.5);
  assert.deepEqual(half.p0, curve.p0);
  const onFull = quadPoint(curve, 0.5);
  close(half.p2.x, onFull.x, "ends at the full curve's midpoint");
  const quarterOfFull = quadPoint(curve, 0.25);
  const halfOfHalf = quadPoint(half, 0.5);
  close(halfOfHalf.x, quarterOfFull.x, "and follows the same path");
  close(halfOfHalf.y, quarterOfFull.y, "and follows the same path");
  assert.deepEqual(splitCurve(curve, 1).p2, quadPoint(curve, 1));
});

test("a string dropped near a card snaps to it", () => {
  const { boxContains } = threadwork;
  const card = box(100, 100);
  assert.ok(boxContains(card, { x: 150, y: 150 }));
  assert.ok(boxContains(card, { x: 90, y: 150 }, 14), "a little outside still counts with padding");
  assert.ok(!boxContains(card, { x: 80, y: 150 }, 14));
});

test("quadLength of a straight curve is its straight length", () => {
  const curve = { p0: { x: 0, y: 0 }, p1: { x: 150, y: 0 }, p2: { x: 300, y: 0 } };
  close(quadLength(curve), 300, "length");
});
