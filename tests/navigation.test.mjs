// Board and Back: remember where you were, and go back there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork } from "./foundry.mjs";

const { returnScene, rememberReturnScene, forgetReturnScene } = threadwork;

const scenes = (list, activeId) => {
  const map = new Map(list.map((s) => [s.id, s]));
  return { get: (id) => map.get(id), active: map.get(activeId) ?? null };
};

test("Back returns to the scene you left for the board", () => {
  forgetReturnScene();
  rememberReturnScene("map");
  assert.equal(returnScene(scenes([{ id: "map" }, { id: "town" }], "town")).id, "map");
});

test("if that scene is gone, Back goes to the active scene", () => {
  forgetReturnScene();
  rememberReturnScene("deleted");
  assert.equal(returnScene(scenes([{ id: "town" }], "town")).id, "town");
});

test("with nothing remembered and nothing active, there is nowhere to go back to", () => {
  forgetReturnScene();
  assert.equal(returnScene(scenes([], null)), null);
});
