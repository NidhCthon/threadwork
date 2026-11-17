// A painting behind the board's pattern (SPEC.md 14). The world names the
// image in a setting; a theme that takes one (`theme.backdrop`) says how to
// tone it down and how much of its own surface to lay over it.
//
// The painting hangs still behind the view, filling the screen, while the
// board pans and zooms over it like a window onto a room. Stretched across
// the whole board instead, a painting would be magnified five or six times at
// table zoom, and most published art is not big enough for that.

/** Never bake bigger than this on a side: it sits under a veil and a pattern, and GPU memory is shared with the scene. */
export const BACKDROP_MAX_SIDE = 3072;

/**
 * Where to put a `srcW` by `srcH` image so it covers `box` without
 * stretching, like CSS `background-size: cover`: scaled to the box's larger
 * need and centred, so a wider image spills off the sides and a taller one
 * off the top and bottom.
 */
export function coverFit(srcW, srcH, box) {
  const scale = Math.max(box.width / srcW, box.height / srcH);
  const width = srcW * scale;
  const height = srcH * scale;
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/**
 * The part of the screen, in board coordinates, given the board's transform
 * to the screen (`a`, `d` its scale, `tx`, `ty` its offset; the board never
 * rotates) and the screen's size.
 */
export function viewOnBoard({ a, d, tx, ty }, screen) {
  // 0 - tx, not -tx: an unpanned board is at 0, not -0.
  return { x: (0 - tx) / a, y: (0 - ty) / d, width: screen.width / a, height: screen.height / d };
}

/** The size to bake an image at: its own pixels, shrunk so neither side passes `max`. */
export function bakeSize(sw, sh, max = BACKDROP_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(sw, sh));
  return { width: Math.max(1, Math.round(sw * scale)), height: Math.max(1, Math.round(sh * scale)) };
}

/**
 * A theme's tone as a CSS filter, for a 2D canvas to apply while it draws:
 * `{brightness: 0.7, sepia: 0.15}` becomes "brightness(0.7) sepia(0.15)".
 * The order is fixed, so the same tone always looks the same. Null for none.
 */
export function toneFilter(tone) {
  if (!tone) return null;
  const parts = ["brightness", "contrast", "saturate", "sepia"]
    .filter((key) => typeof tone[key] === "number")
    .map((key) => `${key}(${tone[key]})`);
  return parts.length ? parts.join(" ") : null;
}

/**
 * The painting as a texture, toned to the theme, once. Browser only. A
 * browser without canvas filters gets it untoned; the theme's veil over it
 * still darkens it.
 */
export function makeBackdropTexture(PIXI, texture, theme) {
  const source = texture?.baseTexture?.resource?.source;
  if (!source) return null;
  const { x, y, width, height } = texture.frame;
  const size = bakeSize(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  const filter = toneFilter(theme.backdrop.tone);
  if (filter && "filter" in ctx) ctx.filter = filter;
  ctx.drawImage(source, x, y, width, height, 0, 0, size.width, size.height);
  return PIXI.Texture.from(canvas);
}
