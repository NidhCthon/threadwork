// The springs, drift and flow that make the board feel alive.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork } from "./foundry.mjs";

const { smoothDamp, dampPoint, driftOffset, stepClock, advanceFlow, hash01, DRIFT } = threadwork;

const frames = (seconds, fps = 60) => Array.from({ length: Math.round(seconds * fps) }, () => 1 / fps);

test("the spring reaches its target without ever overshooting", () => {
  let value = 0, velocity = 0;
  for (const dt of frames(1)) {
    ({ value, velocity } = smoothDamp(value, 100, velocity, 0.09, dt));
    assert.ok(value <= 100, `overshot to ${value}`);
  }
  assert.ok(100 - value < 0.01, `still ${100 - value} short after a second`);
});

test("the spring is still at zero elapsed time", () => {
  assert.deepEqual(smoothDamp(5, 100, 2, 0.1, 0), { value: 5, velocity: 2 });
});

test("a longer smooth time lags further behind, which is what bends a string", () => {
  const card = { x: 0, y: 0 }, bend = { x: 0, y: 0 };
  for (const dt of frames(0.1)) {
    dampPoint(card, { x: 100, y: 0 }, 0.09, dt);
    dampPoint(bend, { x: 100, y: 0 }, 0.22, dt);
  }
  assert.ok(bend.x < card.x, `the bend (${bend.x}) should trail the card (${card.x})`);
});

test("drift stays within its amplitude", () => {
  for (let t = 0; t < 60; t += 0.37) {
    const d = driftOffset("valeros", t);
    assert.ok(Math.abs(d.x) <= DRIFT.amplitude + 1e-9 && Math.abs(d.y) <= DRIFT.amplitude + 1e-9);
  }
});

test("each card drifts its own way, the same way every load", () => {
  assert.notDeepEqual(driftOffset("valeros", 3), driftOffset("seelah", 3));
  assert.deepEqual(driftOffset("valeros", 3), driftOffset("valeros", 3));
  assert.equal(hash01("valeros"), hash01("valeros"));
});

test("a paused drift clock glides to a stop instead of snapping", () => {
  const clock = { time: 0, rate: 1 };
  stepClock(clock, 1 / 60, false);
  assert.ok(clock.rate > 0.5, "the first paused frame still moves");
  for (const dt of frames(2)) stepClock(clock, dt, false);
  const stoppedAt = clock.time;
  for (const dt of frames(1)) stepClock(clock, dt, false);
  assert.equal(clock.time, stoppedAt, "once stopped it stays put");
  assert.equal(clock.rate, 0);
});

test("a stopped clock eases back up when the card is let go", () => {
  const clock = { time: 5, rate: 0 };
  stepClock(clock, 1 / 60, true);
  assert.ok(clock.rate > 0 && clock.rate < 0.2, `rate ${clock.rate} should start small`);
  for (const dt of frames(2)) stepClock(clock, dt, true);
  assert.ok(clock.rate > 0.99);
});

test("flow moves at a constant speed in pixels whatever the string's length", () => {
  assert.equal(advanceFlow(0, 1, 170, 1700), 0.1);
  assert.equal(advanceFlow(0, 1, 170, 340), 0.5);
  assert.ok(Math.abs(advanceFlow(0.95, 1, 170, 1700) - 0.05) < 1e-9, "it wraps back to the start");
  assert.equal(advanceFlow(0.3, 1, 170, 0), 0.3, "a zero-length string does not divide by zero");
});
