// The light along strings, placed without allocating, and when a string needs redrawing.
import { test } from "node:test";
import assert from "node:assert/strict";

const { flowDots, flowDotCount, curvesClose } = await import("../scripts/draw/string.js");
const { constellation: theme } = await import("../scripts/themes/constellation.js");

const curve = { p0: { x: 0, y: 0 }, p1: { x: 500, y: 0 }, p2: { x: 1000, y: 0 } };

test("every slot of a string's dot pool is placed each frame, shown or not", () => {
  const seen = [];
  const count = flowDots(curve, theme, 0.3, 1000, {}, (i) => seen.push(i));
  assert.equal(count, flowDotCount(theme, false));
  assert.deepEqual(seen, [...Array(count).keys()]);
});

test("an undirected string has light going both ways, from a pool twice the size", () => {
  const xs = [];
  flowDots(curve, theme, 0.25, 1000, { both: true }, (_i, x, _y, alpha) => { if (alpha > 0) xs.push(x); });
  assert.equal(flowDotCount(theme, true), 2 * flowDotCount(theme, false));
  assert.ok(xs.length > flowDotCount(theme, false), "both runs show dots");
});

test("dots stay on the string and fade at its ends", () => {
  flowDots(curve, theme, 0.004, 1000, {}, (_i, x, y, alpha) => {
    assert.ok(x >= 0 && x <= 1000 && y === 0);
    assert.ok(alpha >= 0 && alpha <= theme.string.flow.alpha);
  });
  let nearStart = 1;
  flowDots(curve, theme, 0.001, 1000, {}, (i, x, _y, alpha) => { if (i === 0) nearStart = alpha; });
  assert.ok(nearStart < 0.05, "the lead dot is almost invisible right at the start");
});

test("a string that moved less than half a pixel is not redrawn", () => {
  const nudged = { p0: { x: 0.3, y: 0 }, p1: { x: 500, y: 0.2 }, p2: { x: 1000, y: 0 } };
  assert.equal(curvesClose(curve, nudged, 0.5), true);
  const moved = { ...nudged, p2: { x: 1001, y: 0 } };
  assert.equal(curvesClose(curve, moved, 0.5), false);
  assert.equal(curvesClose(curve, null, 0.5), false, "a string never drawn must be drawn");
});
