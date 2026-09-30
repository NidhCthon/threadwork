// Per-user undo: inverses, the redo trail, and removing a card with its strings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork } from "./foundry.mjs";

const { UndoStack, invert, cascadeFor } = threadwork;

const move = (id, from, to) => ({ kind: "update", changes: [{ _id: id, before: { system: { x: from } }, after: { system: { x: to } } }] });

test("undoing a create deletes it, and undoing a delete recreates it", () => {
  const pages = [{ _id: "a" }];
  assert.deepEqual(invert({ kind: "create", pages }), { kind: "delete", pages });
  assert.deepEqual(invert({ kind: "delete", pages }), { kind: "create", pages });
});

test("undoing an update puts the old values back", () => {
  assert.deepEqual(invert(move("a", 10, 90)).changes[0], { _id: "a", before: { system: { x: 90 } }, after: { system: { x: 10 } } });
});

test("undo walks back through your actions, newest first, and redo walks forward again", () => {
  const stack = new UndoStack();
  stack.record(move("a", 0, 1));
  stack.record(move("a", 1, 2));
  assert.equal(stack.takeUndo().changes[0].after.system.x, 1, "back to 1");
  assert.equal(stack.takeUndo().changes[0].after.system.x, 0, "back to 0");
  assert.equal(stack.takeUndo(), null, "nothing left to undo");
  assert.equal(stack.takeRedo().changes[0].after.system.x, 1, "forward to 1");
  assert.equal(stack.takeRedo().changes[0].after.system.x, 2, "forward to 2");
  assert.equal(stack.takeRedo(), null);
});

test("a new action after undoing clears what could be redone", () => {
  const stack = new UndoStack();
  stack.record(move("a", 0, 1));
  stack.takeUndo();
  assert.equal(stack.canRedo, true);
  stack.record(move("a", 0, 5));
  assert.equal(stack.canRedo, false);
});

test("the stack forgets its oldest actions past its limit", () => {
  const stack = new UndoStack(3);
  for (let i = 0; i < 5; i++) stack.record(move("a", i, i + 1));
  let count = 0;
  while (stack.takeUndo()) count++;
  assert.equal(count, 3);
});

test("an update remembers the old values of only the fields it changes", () => {
  const { beforeOf } = threadwork;
  const page = { name: "Kyra", system: { x: 10, y: 20, label: "old", caption: "keep" } };
  assert.deepEqual(beforeOf(page, { system: { x: 99, y: 5 } }), { system: { x: 10, y: 20 } });
  assert.deepEqual(beforeOf(page, { system: { label: "new" } }), { system: { label: "old" } });
  assert.deepEqual(beforeOf(page, { system: { color: "#ff0000" } }), { system: { color: null } }, "a field that was unset is put back as null");
});

test("removing a card takes its strings with it, and nothing else", () => {
  const S = "threadwork.string";
  const pages = [
    { _id: "kyra", type: "threadwork.card" },
    { _id: "oskar", type: "threadwork.card" },
    { _id: "s1", type: S, system: { from: "kyra", to: "oskar" } },
    { _id: "s2", type: S, system: { from: "oskar", to: "kyra" } },
    { _id: "s3", type: S, system: { from: "oskar", to: "mill" } }
  ];
  assert.deepEqual(cascadeFor("kyra", pages, S).map((p) => p._id), ["kyra", "s1", "s2"]);
});
