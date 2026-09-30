// Threadwork's settings. Each player can turn the board's ambient motion off
// for themselves (SPEC.md 5.6); it is also off whenever their operating system
// asks for reduced motion.
import { MODULE_ID } from "./constants.js";
import { prefersReducedMotion } from "./motion.js";

export const REDUCE_MOTION = "reduceMotion";

/** Whether this user's board should hold still: their own setting, or their OS's preference. */
export function reduceMotion() {
  let chosen = false;
  try { chosen = !!game.settings.get(MODULE_ID, REDUCE_MOTION); } catch { /* not registered yet */ }
  return chosen || prefersReducedMotion();
}

/** Tell a live board that the answer may have changed. */
const refresh = () => globalThis.canvas?.[MODULE_ID]?.view?.setReducedMotion(reduceMotion());

export function registerSettings() {
  game.settings.register(MODULE_ID, REDUCE_MOTION, {
    name: "Reduce motion on the Party Board",
    hint: "Stops the twinkling stars, the light running along strings and the drifting cards, and makes cards settle quickly. It is also on whenever your computer is set to reduce motion.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    onChange: refresh
  });
  // The OS preference can change mid-session.
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", refresh);
}
