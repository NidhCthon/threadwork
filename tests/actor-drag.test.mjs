// Players can drag actors out of the sidebar on the board, and nowhere else.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork } from "./foundry.mjs";

const { allowActorDragOnBoard } = threadwork;

/** A directory whose own rule is core's: only token creators may drag. */
function directory(canCreateTokens) {
  return class { _canDragStart() { return canCreateTokens; } };
}

test("on the board a player may drag an actor, though core forbids it", () => {
  const Directory = directory(false);
  allowActorDragOnBoard(Directory, () => true);
  assert.equal(new Directory()._canDragStart(".directory-item"), true);
});

test("off the board the directory keeps its own rule", () => {
  const Directory = directory(false);
  allowActorDragOnBoard(Directory, () => false);
  assert.equal(new Directory()._canDragStart(".directory-item"), false);
  const GmDirectory = directory(true);
  allowActorDragOnBoard(GmDirectory, () => false);
  assert.equal(new GmDirectory()._canDragStart(".directory-item"), true, "a GM can still drag anywhere");
});

test("wrapping twice does nothing the second time", () => {
  const Directory = directory(false);
  assert.equal(allowActorDragOnBoard(Directory, () => true), true);
  assert.equal(allowActorDragOnBoard(Directory, () => false), false);
  assert.equal(new Directory()._canDragStart(), true, "the first wrap stands");
});

test("the actor list re-renders when a player moves on or off the board, so its draggable flags update", () => {
  const { refreshActorDrag } = threadwork;
  let renders = 0;
  const directory = { render: () => { renders++; } };
  const player = { can: () => false };
  assert.equal(refreshActorDrag(true, player, directory), true, "arriving on the board");
  assert.equal(refreshActorDrag(true, player, directory), false, "staying on it changes nothing");
  assert.equal(refreshActorDrag(false, player, directory), true, "leaving it");
  assert.equal(renders, 2);
  assert.equal(refreshActorDrag(true, { can: () => true }, directory), false, "token creators can drag everywhere already");
  assert.equal(renders, 2);
});

test("a missing directory class is ignored rather than thrown on", () => {
  assert.equal(allowActorDragOnBoard(undefined), false);
});
