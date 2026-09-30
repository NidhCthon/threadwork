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
