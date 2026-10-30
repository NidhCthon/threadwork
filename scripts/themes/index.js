// Every theme the board can wear. A theme is a plain object; the board reads
// every colour, size and glow from the one it is given, so a new theme is one
// more file beside these and one more line here.
import { constellation } from "./constellation.js";
import { cork } from "./cork.js";

export const THEMES = { [constellation.id]: constellation, [cork.id]: cork };
export const DEFAULT_THEME = constellation.id;

/** The theme with this id, falling back to the default rather than throwing. */
export const themeOf = (id) => THEMES[id] ?? THEMES[DEFAULT_THEME];

/** `{id: title}` for the settings menu. */
export const themeChoices = () => Object.fromEntries(Object.entries(THEMES).map(([id, theme]) => [id, theme.title]));
