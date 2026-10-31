// SPEC.md 5.6: colours live in the theme file and nowhere else, so a second
// theme (cork) is one more file. These checks keep it that way.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("no drawing or board code hard-codes a colour", async () => {
  const drawing = (await readdir(new URL("scripts/draw/", root))).map((f) => `scripts/draw/${f}`);
  for (const path of [...drawing, "scripts/board-view.js", "scripts/layer.js", "scripts/context-menu.js"]) {
    const source = (await read(path)).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const found = source.match(/0x[0-9a-f]{6}\b|#[0-9a-f]{6}\b/gi);
    assert.equal(found, null, `${path} has colour literals: ${found}`);
  }
});

test("the stylesheet takes every colour from the theme's custom properties", async () => {
  const css = (await read("styles/threadwork.css")).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(css.match(/#[0-9a-f]{3,8}\b/gi), null, "no hex colours");
  const literals = [...css.matchAll(/rgba?\(([^)]*)\)/g)].map((m) => m[1]).filter((inner) => !inner.includes("var(--threadwork-") && !/^0 0 0\b/.test(inner.trim()));
  assert.deepEqual(literals, [], "every rgb() reads a theme property (plain black shadows aside)");
});

/* -------------------------------------------- */
/*  A second theme (SPEC.md 5.6: cork)          */
/* -------------------------------------------- */

const { threadwork, fireOnce, registered, settings } = await import("./foundry.mjs");
const { THEMES, DEFAULT_THEME, themeOf, themeChoices, currentTheme, themeProperties } = threadwork;

/** Every key path in an object, so two themes can be compared shape to shape. */
function keyPaths(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

test("the board can wear more than one theme, and the default is constellation", () => {
  assert.deepEqual(Object.keys(THEMES).sort(), ["constellation", "cork"]);
  assert.equal(DEFAULT_THEME, "constellation");
  for (const [id, theme] of Object.entries(THEMES)) {
    assert.equal(theme.id, id, "a theme's id is the key it is registered under");
    assert.ok(theme.title, `${id} has no title for the settings menu`);
  }
});

test("every theme has exactly the same shape, so the board can read any of them", () => {
  // A theme opts out of a whole feature by setting its key to null — cork has
  // no sky, constellation has no pins — so a path is exempt when walking it
  // hits a null in EITHER theme: one of them has said it does not use this.
  const optsOut = (theme, path) => {
    const parts = path.split(".");
    for (let i = 1; i <= parts.length; i++) {
      let node = theme;
      for (const part of parts.slice(0, i)) node = node?.[part];
      if (node === null) return true;
    }
    return false;
  };
  const [first, ...rest] = Object.values(THEMES);
  const expected = keyPaths(first);
  for (const theme of rest) {
    const actual = keyPaths(theme);
    const exempt = (path) => optsOut(theme, path) || optsOut(first, path);
    assert.deepEqual(expected.filter((k) => !actual.includes(k) && !exempt(k)), [],
      `${theme.id} is missing keys the default has, without opting out with null`);
    assert.deepEqual(actual.filter((k) => !expected.includes(k) && !exempt(k)), [],
      `${theme.id} has keys the default neither has nor opts out of with null`);
  }
});

test("a theme's display title does not collide with its label config", () => {
  for (const theme of Object.values(THEMES)) {
    assert.equal(typeof theme.title, "string");
    assert.equal(typeof theme.label, "object", `${theme.id}.label must stay the string-tag config`);
  }
});

test("an unknown or missing theme id falls back to the default rather than throwing", () => {
  assert.equal(themeOf("cork").id, "cork");
  assert.equal(themeOf("no-such-theme").id, DEFAULT_THEME);
  assert.equal(themeOf(undefined).id, DEFAULT_THEME);
});

test("the settings menu offers each theme by title", () => {
  assert.deepEqual(themeChoices(), { constellation: "Constellation", cork: "Cork" });
});

test("the look is one choice for the whole world, not per player", async () => {
  await fireOnce("init");
  const setting = registered.find((r) => r.module === "threadwork" && r.key === "theme");
  assert.ok(setting, "no theme setting registered");
  assert.equal(setting.options.scope, "world", "the board is shared, so its look is too");
  assert.equal(setting.options.config, true);
  assert.equal(setting.options.default, DEFAULT_THEME);
  assert.deepEqual(Object.keys(setting.options.choices).sort(), ["constellation", "cork"]);
});

test("the chosen theme is the one the board is handed", () => {
  settings.set("threadwork.theme", "cork");
  assert.equal(currentTheme().id, "cork");
  settings.set("threadwork.theme", "constellation");
  assert.equal(currentTheme().id, "constellation");
  // A world saved before this setting existed has no value at all.
  settings.delete("threadwork.theme");
  assert.equal(currentTheme().id, DEFAULT_THEME);
});

test("each theme's interface colours all reach the stylesheet", () => {
  for (const theme of Object.values(THEMES)) {
    const props = themeProperties(theme);
    assert.equal(Object.keys(props).length, Object.keys(theme.ui).length, `${theme.id} drops a ui colour`);
    for (const value of Object.values(props)) assert.match(value, /^\d{1,3} \d{1,3} \d{1,3}$/);
  }
});

test("no theme asks the sky for more sprites than the profiled baseline", async () => {
  // M4 measured constellation on a 60-card, 100-string board. Every star is
  // one sprite, so a sky-based theme that generates more than the default has
  // not been profiled and must not be assumed to run at the same rate. A
  // theme with a surface instead draws one tiling sprite, whatever its size.
  const { starfieldData } = await import("../scripts/draw/starfield.js");
  const rect = { x: 0, y: 0, width: 8000, height: 6000 };
  const baseline = starfieldData(rect, THEMES[DEFAULT_THEME]).stars.length;
  for (const theme of Object.values(THEMES)) {
    if (!theme.stars) {
      assert.ok(theme.surface, `${theme.id} has neither a sky nor a surface to draw`);
      continue;
    }
    const { stars } = starfieldData(rect, theme);
    assert.ok(stars.length <= baseline, `${theme.id} generates ${stars.length} sky sprites against a baseline of ${baseline}`);
  }
});

test("cork is a surface, not a sky", async () => {
  const { corkGrains } = await import("../scripts/draw/cork-surface.js");
  const cork = THEMES.cork;
  assert.equal(cork.stars, null, "no stars");
  assert.equal(cork.nebula, null, "no clouds");
  assert.ok(cork.surface.tile > 0, "it has a tile to repeat");

  const grains = corkGrains(cork.surface.tile, cork.surface);
  assert.equal(grains.length, cork.surface.fleck.count + cork.surface.pit.count);
  for (const g of grains) {
    assert.ok(g.x >= 0 && g.x <= cork.surface.tile, "a grain sits on the tile");
    assert.ok(g.y >= 0 && g.y <= cork.surface.tile);
    assert.ok(g.rx > 0 && g.ry > 0, "and has a size");
  }
  // Pits are the deeper holes: fewer, and bigger than the speckle around them.
  const pits = grains.filter((g) => g.kind === "pit");
  assert.equal(pits.length, cork.surface.pit.count);
  assert.ok(Math.min(...pits.map((g) => g.rx)) >= cork.surface.pit.minRadius);
});

test("the cork surface is the same every time, so the board does not reshuffle", async () => {
  const { corkGrains } = await import("../scripts/draw/cork-surface.js");
  const { surface } = THEMES.cork;
  assert.deepEqual(corkGrains(surface.tile, surface), corkGrains(surface.tile, surface));
});

test("twine takes the material's colour, never the author's; starlight takes the author's", () => {
  assert.equal(THEMES.cork.string.authorColours, false);
  assert.equal(THEMES.constellation.string.authorColours, true);
});

test("nothing travels along twine, and cork's cards are pinned down", () => {
  for (const look of Object.values(THEMES.cork.string.certainty)) assert.equal(look.flow, false);
  assert.ok(THEMES.cork.string.fibre, "twine is drawn as a cord, not a glow");
  assert.equal(THEMES.cork.pin.show, true);
  assert.equal(THEMES.constellation.pin, null, "stars are not pinned to anything");
});
