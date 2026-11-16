// Threadwork's settings (SPEC.md 5.6). The board's look is one choice for the
// whole world, because the board is one shared board and its scene background
// is shared data. Ambient motion is each player's own, and is also off
// whenever their operating system asks for reduced motion. Card emblems
// (SPEC.md 13) are the world's too: a folder of images and the actor data
// that picks one.
import { MODULE_ID } from "./constants.js";
import { prefersReducedMotion } from "./motion.js";
import { isBoardScene, paintBackground } from "./board-scene.js";
import { applyThemeCss } from "./theme-css.js";
import { DEFAULT_THEME, themeChoices, themeOf } from "./themes/index.js";
import { emblemLookup, isEmblemFile, parseFields } from "./emblem.js";

export const REDUCE_MOTION = "reduceMotion";
export const THEME = "theme";
export const EMBLEM_FOLDER = "emblemFolder";
export const EMBLEM_FIELDS = "emblemFields";
/** The emblem folder's image paths. Hidden: the GM keeps it, because players may not browse files. */
export const EMBLEM_INDEX = "emblemIndex";

const read = (key, fallback) => {
  try { return game.settings.get(MODULE_ID, key) ?? fallback; } catch { return fallback; }
};

let cached = { index: null, fields: null, value: null };

/**
 * The world's emblems: a lookup of the folder's images by file name, and the
 * actor fields that pick one. Rebuilt only when either setting changes, since
 * every card on the board asks.
 */
export function emblemSettings() {
  const index = read(EMBLEM_INDEX, []);
  const fields = read(EMBLEM_FIELDS, "");
  if (cached.index !== index || cached.fields !== fields) {
    cached = { index, fields, value: { lookup: emblemLookup(Array.isArray(index) ? index : []), fields: parseFields(fields) } };
  }
  return cached.value;
}

/**
 * List the emblem folder into the hidden index, so every client can match
 * names to files. Only the active GM does it, on load and when the folder
 * changes, and only writes when the listing differs. Images added to the
 * folder later show up the next time the GM loads the world.
 */
export async function refreshEmblemIndex() {
  if (!game.user?.isGM || (game.users?.activeGM && !game.users.activeGM.isSelf)) return;
  const folder = String(read(EMBLEM_FOLDER, "") ?? "").trim().replace(/\/+$/, "");
  let files = [];
  if (folder) {
    try {
      const picker = foundry.applications.apps.FilePicker.implementation;
      const listing = await picker.browse("data", folder);
      files = (listing?.files ?? []).filter(isEmblemFile).sort();
    } catch (error) {
      console.warn(`Threadwork | Could not list the emblem folder "${folder}"`, error);
      ui.notifications?.warn(`Threadwork couldn't open the emblem folder "${folder}". Check the path in Configure Settings.`);
      return;
    }
  }
  const current = read(EMBLEM_INDEX, []);
  if (JSON.stringify(current) !== JSON.stringify(files)) await game.settings.set(MODULE_ID, EMBLEM_INDEX, files);
}

/** Redraw the board's cards with the emblems as they now are. */
const resyncBoard = () => globalThis.canvas?.[MODULE_ID]?.sync?.();

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
  game.settings.register(MODULE_ID, EMBLEM_FOLDER, {
    name: "Card emblems: image folder",
    hint: "A folder of small symbols, such as clan or house emblems, that cards can wear on their portrait. Transparent PNG, WebP or SVG works best; each is drawn in the board's own colours. Leave empty for no emblems.",
    scope: "world",
    config: true,
    type: String,
    filePicker: "folder",
    default: "",
    onChange: () => refreshEmblemIndex()
  });
  game.settings.register(MODULE_ID, EMBLEM_FIELDS, {
    name: "Card emblems: chosen by",
    hint: "The actor data that picks each card's emblem, matched to a file name in the folder: with system.clan, a Toreador wears toreador.png. List several, separated by commas, to try them in turn (system.clan, system.sect). Leave empty to choose emblems only by hand, from a card's right-click menu.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: resyncBoard
  });
  game.settings.register(MODULE_ID, EMBLEM_INDEX, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
    onChange: resyncBoard
  });
  // The OS preference can change mid-session.
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").addEventListener?.("change", refresh);
}
