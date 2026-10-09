// Fitting words into a card. Pure functions over an injected measure(), so
// they run under node --test; the board measures with PIXI.TextMetrics.

/**
 * The largest font size, from `max` down to `min` in `step`s, at which the
 * text fits `width` in at most `maxLines` lines. `measure(size)` returns the
 * wrapped text's {width, lines}. Wrapping onto a second line is preferred to
 * shrinking: on-board text has to read at table zoom, so a name only gets
 * smaller when two lines at full size are not enough.
 */
export function fitFontSize(measure, width, { max, min, step = 2, maxLines = 2 }) {
  for (let size = max; size >= min; size -= step) {
    const m = measure(size);
    if (m.width <= width + 0.5 && m.lines <= maxLines) return { size, fits: true };
  }
  return { size: min, fits: false };
}

/**
 * The longest start of `text`, cut at a word and ending in "…", that wraps to
 * at most `maxLines` lines. `lines(candidate)` counts the wrapped lines.
 * Text that already fits comes back unchanged.
 */
export function truncateToLines(lines, text, maxLines) {
  if (!text || lines(text) <= maxLines) return text;
  const words = text.split(/\s+/);
  let lo = 0;
  let hi = words.length - 1;
  // Binary search on how many words to keep.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lines(`${words.slice(0, mid).join(" ")}…`) <= maxLines) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? `${words.slice(0, lo).join(" ")}…` : "…";
}
