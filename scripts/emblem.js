// Card emblems: a small symbol on a card's portrait, such as a clan, a house
// or a sect. Threadwork ships no symbols and knows nothing about what they
// mean. A world names a folder of images and, if it likes, which piece of
// actor data picks one; a card then shows the image whose file name matches
// that data ("Toreador" finds toreador.png), or one chosen by hand.
//
// Everything here is plain functions over plain data, so it runs in node.

/** A card's emblem field: "" picks from the document's data, this shows nothing, anything else is an image path. */
export const EMBLEM_NONE = "none";

/** The files in the emblem folder worth offering. */
export const EMBLEM_EXTENSIONS = ["png", "webp", "svg", "jpg", "jpeg", "avif", "gif"];

/** "Brujah antitribu" → "brujah-antitribu", "Banu Haqim" → "banu-haqim", "Thin-Blood" → "thin-blood". */
export function slugify(text) {
  return String(text ?? "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A path's file name without its folder or extension: "assets/clans/banu-haqim.webp" → "banu-haqim". */
export function fileStem(path) {
  const name = decodeURIComponent(String(path ?? "").split(/[?#]/)[0].split("/").pop() ?? "");
  return name.replace(/\.[^.]+$/, "");
}

/** Whether a path is an image the emblem folder should offer. */
export const isEmblemFile = (path) => EMBLEM_EXTENSIONS.includes(String(path ?? "").split(/[?#]/)[0].split(".").pop()?.toLowerCase());

/**
 * The names a file answers to. A file can carry several, joined with "+", so
 * one symbol serves every name for the same thing without copies of it:
 * "banu-haqim+assamite.png" is both Banu Haqim and Assamite.
 */
export const emblemNames = (path) => fileStem(path).split("+").map(slugify).filter(Boolean);

/** "banu-haqim+assamite.webp" → "Banu Haqim", for a tooltip: its first name. */
export const emblemTitle = (path) => (fileStem(path).split("+")[0] ?? "").split(/[-_\s]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

/**
 * The emblem folder's images keyed by every name they answer to. When two
 * files claim the same name (toreador.png beside toreador.webp) the first in
 * sorted order wins, so every client picks the same one.
 */
export function emblemLookup(paths) {
  const lookup = new Map();
  for (const path of [...(paths ?? [])].filter(isEmblemFile).sort()) {
    for (const key of emblemNames(path)) if (!lookup.has(key)) lookup.set(key, path);
  }
  return lookup;
}

/** Each image once, for a picker: a file with several names is still one symbol. */
export const emblemChoices = (lookup) => [...new Set(lookup?.values() ?? [])];

/**
 * The image a piece of text names: the file of exactly that name, or else the
 * longest file name it begins with, a whole word at a time. So "Brujah
 * antitribu" shows brujah's emblem unless a brujah-antitribu file exists.
 */
export function matchEmblem(text, lookup) {
  const slug = slugify(text);
  if (!slug || !lookup?.size) return null;
  if (lookup.has(slug)) return lookup.get(slug);
  let best = null;
  for (const key of lookup.keys()) {
    if (slug.startsWith(`${key}-`) && (!best || key.length > best.length)) best = key;
  }
  return best ? lookup.get(best) : null;
}

/** "system.clan, system.sect" → ["system.clan", "system.sect"]. */
export const parseFields = (text) => String(text ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * The text at a dotted path in a document. Some systems keep a trait as
 * `{value: "Toreador"}` or as an embedded item with a name; both are read.
 */
export function textAt(doc, path) {
  let value = path.split(".").reduce((node, key) => node?.[key], doc);
  if (value && typeof value === "object") value = value.value ?? value.name ?? value.label;
  return typeof value === "string" ? value : null;
}

/**
 * The image a card's emblem shows, or null for none.
 * @param {string} chosen  The card's own emblem field (see EMBLEM_NONE).
 * @param {object|null} doc  The document behind the card, if any.
 * @param {{lookup: Map, fields: string[]}|null} emblems  The world's folder and fields.
 */
export function emblemFor(chosen, doc, emblems) {
  if (chosen === EMBLEM_NONE) return null;
  if (chosen) return chosen;
  if (!doc || !emblems?.lookup?.size) return null;
  for (const field of emblems.fields ?? []) {
    const path = matchEmblem(textAt(doc, field), emblems.lookup);
    if (path) return path;
  }
  return null;
}

/**
 * Turn an image's RGBA pixels into a white silhouette, in place, so that any
 * symbol takes the theme's ink colour when tinted: black artwork would stay
 * black on a dark board, and coloured artwork would clash with the theme.
 *
 * An image with transparency is shaped by its alpha. One without (a JPEG, or
 * a symbol printed on a white sheet) is shaped by its ink: dark on light
 * paper, or light on dark, whichever the picture mostly is not.
 */
export function silhouette(rgba) {
  const count = rgba.length / 4;
  if (!count) return rgba;
  let see = 0;
  let light = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 250) see++;
    light += luminance(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  const transparent = see > count * 0.02;
  const paperIsLight = light / count > 127.5;
  for (let i = 0; i < rgba.length; i += 4) {
    const lum = luminance(rgba[i], rgba[i + 1], rgba[i + 2]);
    const ink = transparent ? rgba[i + 3] : (paperIsLight ? 255 - lum : lum);
    rgba[i] = rgba[i + 1] = rgba[i + 2] = 255;
    rgba[i + 3] = Math.round(ink);
  }
  return rgba;
}

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
