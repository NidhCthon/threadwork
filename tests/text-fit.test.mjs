// Names and captions fit their cards: wrap first, shrink only if needed, cut long captions.
import { test } from "node:test";
import assert from "node:assert/strict";

const { fitFontSize, truncateToLines } = await import("../scripts/text-fit.js");

/**
 * A stand-in for PIXI.TextMetrics: each character is 0.6 × the font size wide,
 * and words wrap greedily at `width`.
 */
function measurer(text, width) {
  return (size) => {
    const charW = size * 0.6;
    const lines = [];
    let line = "";
    for (const word of text.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && next.length * charW > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    return { width: Math.max(...lines.map((l) => l.length * charW)), lines: lines.length };
  };
}

test("a short name keeps the full size on one line", () => {
  assert.deepEqual(fitFontSize(measurer("Richard", 224), 224, { max: 34, min: 22 }), { size: 34, fits: true });
});

test("a long two-word name wraps to two lines at full size rather than shrinking", () => {
  // "Lysander Drakovescu" is ~388px on one line at 34px, but each word fits 224px.
  assert.deepEqual(fitFontSize(measurer("Lysander Drakovescu", 224), 224, { max: 34, min: 22 }), { size: 34, fits: true });
});

test("a single word too long for the card shrinks until it fits", () => {
  const { size, fits } = fitFontSize(measurer("Drakovescu-Vandermeer", 224), 224, { max: 34, min: 14 });
  assert.equal(fits, true);
  assert.ok(size < 34 && size * 0.6 * 21 <= 224, `size ${size}`);
});

test("when nothing fits even at the smallest size, it says so", () => {
  assert.deepEqual(fitFontSize(measurer("Supercalifragilisticexpialidocious", 100), 100, { max: 34, min: 22 }), { size: 22, fits: false });
});

test("a caption that fits is left alone", () => {
  assert.equal(truncateToLines(() => 1, "Fighter, owes a life", 2), "Fighter, owes a life");
  assert.equal(truncateToLines(() => 1, "", 2), "");
});

test("a long caption is cut at a word, with an ellipsis, to the most that fits", () => {
  // Pretend every 4 words make a line.
  const lines = (s) => Math.ceil(s.replace("…", "").trim().split(/\s+/).length / 4);
  const caption = "one two three four five six seven eight nine ten eleven";
  const cut = truncateToLines(lines, caption, 2);
  assert.equal(cut, "one two three four five six seven eight…");
  assert.ok(lines(cut) <= 2);
});
