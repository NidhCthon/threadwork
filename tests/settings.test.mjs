// The reduce-motion setting, and the theme's colours reaching the stylesheet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork, fireOnce, registered, settings } from "./foundry.mjs";

const { reduceMotion, themeProperties } = threadwork;
const { constellation } = await import("../scripts/themes/constellation.js");

test("each player has their own reduce-motion setting in Configure Settings", async () => {
  await fireOnce("init");
  const setting = registered.find((r) => r.module === "threadwork" && r.key === "reduceMotion");
  assert.ok(setting);
  assert.equal(setting.options.scope, "client", "one player turning it on does not change it for anyone else");
  assert.equal(setting.options.config, true);
  assert.equal(setting.options.default, false);
});

test("motion is reduced when the player asks for it", () => {
  settings.set("threadwork.reduceMotion", false);
  assert.equal(reduceMotion(), false);
  settings.set("threadwork.reduceMotion", true);
  assert.equal(reduceMotion(), true);
});

test("motion is reduced when the operating system asks, even if the player did not", () => {
  settings.set("threadwork.reduceMotion", false);
  const before = globalThis.matchMedia;
  globalThis.matchMedia = (query) => ({ matches: query.includes("reduce") });
  try {
    assert.equal(reduceMotion(), true);
  } finally {
    globalThis.matchMedia = before;
  }
});

test("the theme's interface colours become CSS custom properties, as RGB for alpha", () => {
  const props = themeProperties(constellation);
  assert.equal(props["--threadwork-surface"], "10 15 38");
  assert.equal(props["--threadwork-danger"], "255 154 154");
  assert.equal(Object.keys(props).length, Object.keys(constellation.ui).length);
});
