// Threadwork's settings (SPEC.md 5.6). The board's look is one choice for the
// whole world, because the board is one shared board and its scene background
// is shared data. Ambient motion is each player's own, and is also off
// whenever their operating system asks for reduced motion.
import { MODULE_ID } from "./constants.js";
import { prefersReducedMotion } from "./motion.js";
import { isBoardScene, paintBackground } from "./board-scene.js";
import { applyThemeCss } from "./theme-css.js";
import { DEFAULT_THEME, themeChoices, themeOf } from "./themes/index.js";

export const REDUCE_MOTION = "reduceMotion";
export const THEME = "theme";

/** The theme this world's board is wearing. Falls back to the default before the setting exists. */
export function currentTheme() {
  let id = DEFAULT_THEME;
  try { id = game.settings.get(MODULE_ID, THEME) || DEFAULT_THEME; } catch { /* not registered yet */ }
  return themeOf(id);
}

/**
 * Put a newly chosen theme on screen. The HTML parts re-read their custom
 * properties here; the canvas needs a full redraw, which repainting the
 * scene's background triggers on every client at once. Only the GM can change
 * a world setting, so only the GM repaints — the players' canvases are redrawn
 * by the level update arriving.
 */
async function applyTheme() {
  const theme = currentTheme();
  applyThemeCss(theme);
  if (!game.user.isGM) return;
  const painted = await paintBackground(game.scenes.find(isBoardScene), theme);
  if (!painted && isBoardScene(globalThis.canvas?.scene)) await globalThis.canvas.draw();
}

/** Whether this user's board should hold still: their own setting, or their OS's preference. */
export function reduceMotion() {
  let chosen = false;
  try { chosen = !!game.settings.get(MODULE_ID, REDUCE_MOTION); } catch { /* not registered yet */ }
  return chosen || prefersReducedMotion();
}

/** Tell a live board that the answer may have changed. */
const refresh = () => globalThis.canvas?.[MODULE_ID]?.view?.setReducedMotion(reduceMotion());

export function registerSettings() {
  game.settings.register(MODULE_ID, THEME, {
    name: "Party Board look",
    hint: "Constellation is a night sky with light running along the strings. Cork is a detective's board: brown cork, cream index cards and red twine. It changes the board for everyone.",
    scope: "world",
    config: true,
    type: String,
    choices: themeChoices(),
    default: DEFAULT_THEME,
    onChange: applyTheme
  });
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
