// The board scene's creation data and its sky.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork } from "./foundry.mjs";

const { boardSceneData, isBoardScene, starfieldData, starAlpha } = threadwork;
const theme = (await import("../scripts/themes/constellation.js")).constellation;

test("the board scene has no token vision, so a player without a token is not left in the dark", () => {
  assert.equal(boardSceneData(theme).tokenVision, false);
});

test("the board scene is gridless, fogless, and in every player's scene bar", () => {
  const data = boardSceneData(theme);
  assert.equal(data.grid.type, CONST.GRID_TYPES.GRIDLESS);
  assert.equal(data.fog.mode, CONST.FOG_EXPLORATION_MODES.DISABLED);
  assert.equal(data.navigation, true);
  assert.equal(data.ownership.default, CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED, "LIMITED is the lowest level that shows it");
});

test("the board scene is found again by its flag, not its name", () => {
  const data = boardSceneData(theme);
  const scene = { getFlag: (scope, key) => data.flags[scope]?.[key] };
  assert.equal(isBoardScene(scene), true);
  assert.equal(isBoardScene({ getFlag: () => undefined }), false);
  assert.equal(isBoardScene(null), false);
});

test("the sky is the same every time for the same board", () => {
  const rect = { x: 0, y: 0, width: 1400, height: 1000 };
  assert.deepEqual(starfieldData(rect, theme), starfieldData(rect, theme));
});

test("stars fill the board's rect and scale with its area", () => {
  const rect = { x: 100, y: 200, width: 1400, height: 1000 };
  const { stars } = starfieldData(rect, theme);
  assert.equal(stars.length, Math.round(1400 * 1000 * theme.stars.density));
  for (const s of stars) {
    assert.ok(s.x >= 100 && s.x <= 1500 && s.y >= 200 && s.y <= 1200);
    assert.ok(s.r >= theme.stars.minRadius && s.r <= theme.stars.maxRadius);
  }
});

test("nebulae scale with the board, so a big board still has colour in every view", () => {
  const small = starfieldData({ x: 0, y: 0, width: 1000, height: 800 }, theme).nebulae;
  const big = starfieldData({ x: 0, y: 0, width: 8000, height: 6000 }, theme).nebulae;
  assert.equal(small.length, theme.nebula.minCount, "a small board still gets a few");
  assert.equal(big.length, Math.round(8000 * 6000 * theme.nebula.density));
  for (const n of big) assert.ok(n.r >= theme.nebula.minRadius && n.r <= theme.nebula.maxRadius);
});

test("a twinkling star dims and brightens but never goes out", () => {
  const star = { twinkle: true, base: 0.8, speed: 1, phase: 0 };
  let low = 1, high = 0;
  for (let t = 0; t < 10; t += 0.05) {
    low = Math.min(low, starAlpha(star, t));
    high = Math.max(high, starAlpha(star, t));
  }
  assert.ok(low > 0.05 && high <= 0.8 + 1e-9 && high - low > 0.5, `${low}..${high}`);
  assert.equal(starAlpha({ twinkle: false, base: 0.4 }, 3), 0.4);
});
