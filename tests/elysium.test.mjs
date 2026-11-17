// SPEC.md 14: Elysium, the third theme — a damask surface, an optional
// painting behind it, cameo portraits and wax seals that carry the emblem.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const { threadwork, fireOnce, registered } = await import("./foundry.mjs");
const { THEMES } = threadwork;
const { damaskTile } = await import("../scripts/draw/damask-surface.js");
const { coverFit, viewOnBoard, bakeSize, toneFilter, BACKDROP_MAX_SIDE } = await import("../scripts/draw/backdrop.js");
const { sealOutline, sealCentre, seedOf } = await import("../scripts/draw/card.js");

const root = new URL("../", import.meta.url);
const elysium = THEMES.elysium;

/* -------------------------------------------- */
/*  The damask tile                             */
/* -------------------------------------------- */

test("the damask tile is two cells each way, so the pattern repeats exactly once per tile", () => {
  const tile = damaskTile(elysium.surface);
  const { w, h } = elysium.surface.cell;
  assert.equal(tile.width, w * 2);
  assert.equal(tile.height, h * 2);
  assert.equal(tile.motifs.length, 2, "a flower in every other lozenge");
  for (const m of tile.motifs) assert.ok(m.x > 0 && m.x < tile.width && m.y > 0 && m.y < tile.height);
  assert.equal(tile.nap.length, elysium.surface.nap.count);
});

test("the column at the right edge is the left column again, so a bulge crossing the seam continues", () => {
  const { waves, width } = damaskTile(elysium.surface);
  const column = (x) => waves.filter((wave) => wave.x0 === x).map(({ y0, dir }) => `${y0}:${dir}`);
  assert.deepEqual(column(width), column(0));
  // Neighbouring columns bulge opposite ways, which is what makes the lozenges.
  for (const wave of waves.filter((w) => w.x0 === 0)) {
    const next = waves.find((w) => w.x0 === width / 2 && w.y0 === wave.y0);
    assert.equal(next.dir, -wave.dir);
  }
});

test("the damask is the same every time, so the board does not reshuffle", () => {
  assert.deepEqual(damaskTile(elysium.surface), damaskTile(elysium.surface));
});

/* -------------------------------------------- */
/*  The painting                                */
/* -------------------------------------------- */

const close = (a, b) => Math.abs(a - b) < 1e-9;

test("the painting covers the view without stretching: a wide one spills off the sides, a tall one off the top", () => {
  const view = { x: 100, y: 50, width: 1600, height: 900 };
  const wide = coverFit(3000, 1000, view);
  assert.ok(close(wide.width / wide.height, 3), "never stretched");
  assert.ok(close(wide.height, 900));
  assert.ok(close(wide.x + wide.width / 2, 900) && close(wide.y, 50), "centred on the view");
  const tall = coverFit(1000, 1000, view);
  assert.ok(close(tall.width, 1600) && close(tall.height, 1600));
  assert.ok(close(tall.y + tall.height / 2, 500));
  // The mock-up's painting on a 1920 by 1080 screen: about one and a half times its size.
  const salon = coverFit(1296, 875, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.ok(salon.width / 1296 < 1.5);
});

test("the view on the board follows its pan and zoom", () => {
  const screen = { width: 1920, height: 1080 };
  assert.deepEqual(viewOnBoard({ a: 1, d: 1, tx: 0, ty: 0 }, screen), { x: 0, y: 0, width: 1920, height: 1080 });
  // Zoomed out to half and panned so board point (4000, 3000) is at the screen's top left.
  const view = viewOnBoard({ a: 0.5, d: 0.5, tx: -2000, ty: -1500 }, screen);
  assert.deepEqual(view, { x: 4000, y: 3000, width: 3840, height: 2160 });
});

test("a painting is baked no bigger than the cap and never enlarged", () => {
  const big = bakeSize(6000, 4500);
  assert.equal(Math.max(big.width, big.height), BACKDROP_MAX_SIDE);
  assert.ok(Math.abs(big.width / big.height - 6000 / 4500) < 0.01);
  assert.deepEqual(bakeSize(800, 600), { width: 800, height: 600 });
});

test("a tone becomes a canvas filter in a fixed order, and no tone is no filter", () => {
  assert.equal(toneFilter({ sepia: 0.15, brightness: 0.7, saturate: 0.85 }), "brightness(0.7) saturate(0.85) sepia(0.15)");
  assert.equal(toneFilter(null), null);
  assert.equal(toneFilter({}), null);
});

test("only Elysium hangs a painting, under a veil it can still be seen through", () => {
  assert.equal(THEMES.constellation.backdrop, null);
  assert.equal(THEMES.cork.backdrop, null);
  assert.ok(elysium.backdrop.veil > 0 && elysium.backdrop.veil < 1);
  assert.ok(toneFilter(elysium.backdrop.tone));
});

test("the painting is one image for the whole world, picked from the Data folder", async () => {
  await fireOnce("init");
  const setting = registered.find((r) => r.module === "threadwork" && r.key === "painting");
  assert.ok(setting, "no painting setting registered");
  assert.equal(setting.options.scope, "world");
  assert.equal(setting.options.config, true);
  assert.equal(setting.options.filePicker, "image");
  assert.equal(setting.options.default, "");
});

/* -------------------------------------------- */
/*  Seals                                       */
/* -------------------------------------------- */

test("a seal's edge wobbles within its jitter and keeps its shape for the same card", () => {
  const { points, jitter } = elysium.seal;
  const outline = sealOutline(20, points, jitter, seedOf("card-1"));
  assert.equal(outline.length, points * 2);
  for (let i = 0; i < outline.length; i += 2) {
    const r = Math.hypot(outline[i], outline[i + 1]);
    assert.ok(r >= 20 * (1 - jitter / 2) - 1e-9 && r <= 20 * (1 + jitter / 2) + 1e-9, `corner at ${r}`);
  }
  assert.deepEqual(sealOutline(20, points, jitter, seedOf("card-1")), outline);
  assert.notDeepEqual(sealOutline(20, points, jitter, seedOf("card-2")), outline, "each card's seal is its own");
});

test("the seal sits across the card's top edge, clear of its right-hand corner", () => {
  const at = sealCentre(380, elysium);
  assert.equal(at.y, elysium.seal.top);
  assert.ok(at.x + elysium.emblem.radius < 380, "even the larger seal stays inside the right edge");
});

test("Elysium carries the emblem in its seal; the other themes keep it on the portrait", () => {
  assert.equal(elysium.emblem.place, "seal");
  assert.ok(elysium.seal);
  assert.ok(elysium.emblem.radius > elysium.seal.radius, "a seal with a symbol in it is the bigger one");
  for (const id of ["constellation", "cork"]) {
    assert.equal(THEMES[id].emblem.place, "rim");
    assert.equal(THEMES[id].seal, null);
  }
  assert.equal(elysium.pin, null, "sealed, not pinned");
});

test("the ribbon is a material: its own colour, a cast shadow, and a glint only when confirmed", () => {
  assert.equal(elysium.string.authorColours, false);
  assert.ok(elysium.string.fibre.drop);
  assert.equal(elysium.string.certainty.confirmed.flow, true);
  assert.equal(elysium.string.certainty.suspected.flow, false);
  assert.equal(elysium.string.certainty.rumored.flow, false);
});

/* -------------------------------------------- */
/*  Fonts                                       */
/* -------------------------------------------- */

test("every typeface Elysium names is declared in the stylesheet and shipped beside it", async () => {
  const css = await readFile(new URL("styles/threadwork.css", root), "utf8");
  const styles = [elysium.card.name, elysium.card.caption, elysium.hub.text, elysium.note.text, elysium.frame.title, elysium.label.text, elysium.badge.text];
  // Signika is Foundry's own and always there.
  const families = [...new Set(styles.map((s) => s.fontFamily))].filter((f) => f !== "Signika");
  assert.deepEqual(families.sort(), ["Cinzel", "Cormorant Garamond"]);
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
  for (const family of families) {
    const own = faces.filter((face) => face.includes(`font-family: "${family}"`));
    assert.ok(own.length, `${family} has no @font-face`);
    for (const face of own) {
      const [, file] = face.match(/url\("([^"]+)"\)/);
      await access(new URL(`styles/${file}`, root));
    }
  }
  // The italic caption needs an italic face, or the browser slants the upright one.
  assert.ok(faces.some((face) => face.includes('"Cormorant Garamond"') && face.includes("font-style: italic")));
  await access(new URL("styles/fonts/OFL-Cinzel.txt", root));
  await access(new URL("styles/fonts/OFL-CormorantGaramond.txt", root));
});
