// The motion that keeps the board alive (SPEC.md 5.6): cards easing toward
// where they belong, a slow drift that stops for whatever you are looking at,
// light running along strings. Pure functions over plain numbers and objects.

const TAU = Math.PI * 2;

/** Seconds for a dragged card to catch up with the pointer. */
export const CARD_SMOOTH = 0.09;

/** Seconds for a string's bend to catch up with its cards: the trailing lag. */
export const CONTROL_SMOOTH = 0.22;

/** Drift: how far a card floats, and how quickly it eases to a stop and back. */
export const DRIFT = { amplitude: 5, ease: 0.25 };

/**
 * A critically damped spring toward `target` (the smooth-damp formulation):
 * it closes the gap as fast as it can without ever overshooting.
 * Returns the new value and velocity.
 */
export function smoothDamp(current, target, velocity, smoothTime, dt) {
  if (dt <= 0) return { value: current, velocity };
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  let value = target + (change + temp) * decay;
  let nextVelocity = (velocity - omega * temp) * decay;
  if ((target - current > 0) === (value > target)) {
    value = target;
    nextVelocity = 0;
  }
  return { value, velocity: nextVelocity };
}

/** smoothDamp for a point {x, y, vx, vy}, updated in place. */
export function dampPoint(state, target, smoothTime, dt) {
  const x = smoothDamp(state.x, target.x, state.vx ?? 0, smoothTime, dt);
  const y = smoothDamp(state.y, target.y, state.vy ?? 0, smoothTime, dt);
  state.x = x.value;
  state.vx = x.velocity;
  state.y = y.value;
  state.vy = y.velocity;
  return state;
}

/** A stable number in [0, 1) from a string, so each card drifts its own way every load. */
export function hash01(text, salt = 0) {
  let h = 0x811c9dc5 ^ salt;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 2 ** 32;
}

/** Where a card sits relative to its rest position after `time` seconds of drift. */
export function driftOffset(seed, time, amplitude = DRIFT.amplitude) {
  const periodX = 11 + 4 * hash01(seed, 1);
  const periodY = 9 + 4 * hash01(seed, 2);
  const phaseX = hash01(seed, 3) * TAU;
  const phaseY = hash01(seed, 4) * TAU;
  return {
    x: amplitude * Math.sin((TAU * time) / periodX + phaseX),
    y: amplitude * Math.sin((TAU * time) / periodY + phaseY)
  };
}

/**
 * Advance a drift clock {time, rate}. While `running` is false the rate eases
 * to zero, so a card glides to a stop where it is rather than snapping back to
 * its rest position; it eases up again the same way.
 */
export function stepClock(clock, dt, running, ease = DRIFT.ease) {
  const target = running ? 1 : 0;
  clock.rate += (target - clock.rate) * (1 - Math.exp(-dt / ease));
  if (!running && clock.rate < 1e-3) clock.rate = 0;
  clock.time += dt * clock.rate;
  return clock;
}

/** Move a flow phase (0-1 along the string) at `speed` pixels a second. */
export function advanceFlow(phase, dt, speed, length) {
  if (length <= 0) return phase;
  return (phase + (dt * speed) / length) % 1;
}

/** The operating system's reduced-motion preference, false where there is no window. */
export function prefersReducedMotion() {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
