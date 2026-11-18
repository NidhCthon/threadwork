// SPEC.md 15: a card's sheet opens from the board, and making things never
// depends on a right-click, because people right-drag to pan.
import { test } from "node:test";
import assert from "node:assert/strict";

const { threadwork, fireOnce, keybindings } = await import("./foundry.mjs");
const { ThreadworkLayer } = threadwork;

/* -------------------------------------------- */
/*  Making things                               */
/* -------------------------------------------- */

test("a right-click on empty board does nothing of ours, so a pan never opens a menu", () => {
  // Core fires clickRight on the press, before it knows the press starts a pan.
  assert.equal(Object.hasOwn(ThreadworkLayer.prototype, "_onClickRight"), false);
});

test("the tools on the left make every kind of thing: a note, a concept and a frame", () => {
  const { tools } = ThreadworkLayer.prepareSceneControls();
  for (const name of ["note", "concept", "frame"]) {
    assert.ok(tools[name], `no ${name} tool`);
    assert.equal(tools[name].button, true, `${name} is a button, not a mode`);
    assert.equal(typeof tools[name].onChange, "function");
  }
  const order = Object.values(tools).sort((a, b) => a.order - b.order).map((t) => t.name);
  assert.deepEqual(order, ["board", "note", "concept", "frame", "back"]);
});

test("N opens the make menu, and lets the key pass when there is no board", async () => {
  await fireOnce("init");
  const make = keybindings.find((k) => k.module === "threadwork" && k.name === "make");
  assert.ok(make, "no make keybinding");
  assert.deepEqual(make.options.editable, [{ key: "KeyN" }]);
  globalThis.canvas = undefined;
  assert.equal(make.options.onDown(), false, "off the board the key is someone else's");
  globalThis.canvas = { threadwork: { view: {}, active: false } };
  assert.equal(make.options.onDown(), false, "nor while another layer is active");
});

/* -------------------------------------------- */
/*  Opening sheets                              */
/* -------------------------------------------- */

function boardWith(cards, docs) {
  const opened = [];
  const sheet = (uuid) => ({ render: (_force, options) => opened.push(options?.pageId ? `${uuid}#${options.pageId}` : uuid) });
  const documents = Object.fromEntries(Object.entries(docs).map(([uuid, { level, type = "Actor" }]) => {
    const doc = { uuid, documentName: type, id: uuid.split(".").pop(), testUserPermission: (_user, wanted) => wanted === "LIMITED" && level >= 1 };
    if (type === "JournalEntryPage") doc.parent = { sheet: sheet("JournalEntry.j") };
    else doc.sheet = sheet(uuid);
    return [uuid, doc];
  }));
  globalThis.fromUuidSync = (uuid) => documents[uuid] ?? null;
  const pages = new Map(cards.map((c) => [c.id, { id: c.id, system: { uuid: c.uuid ?? null } }]));
  globalThis.game.journal = [{ getFlag: () => true, pages }];
  globalThis.game.user = { id: "p1", isGM: false };
  const layer = new ThreadworkLayer();
  layer.view = { cards: new Map(cards.map((c) => [c.id, { data: { kind: "document", ...c } }])) };
  return { layer, opened };
}

test("a character's card opens its sheet; a journal page opens in its journal", () => {
  const { layer, opened } = boardWith(
    [{ id: "kyra", uuid: "Actor.kyra" }, { id: "clue", uuid: "JournalEntry.j.JournalEntryPage.clue" }],
    { "Actor.kyra": { level: 3 }, "JournalEntry.j.JournalEntryPage.clue": { level: 2, type: "JournalEntryPage" } }
  );
  assert.equal(layer.openCard("kyra"), true);
  assert.equal(layer.openCard("clue"), true);
  assert.deepEqual(opened, ["Actor.kyra", "JournalEntry.j#clue"]);
});

test("a card opens nothing it shouldn't: no permission, shadowed, gone, or not a document", () => {
  const { layer, opened } = boardWith(
    [
      { id: "mayor", uuid: "Actor.mayor" },
      { id: "masked", uuid: "Actor.kyra", shadowed: true },
      { id: "gone", uuid: "Actor.gone", missing: true },
      { id: "note", kind: "text" }
    ],
    { "Actor.mayor": { level: 0 }, "Actor.kyra": { level: 3 } }
  );
  for (const id of ["mayor", "masked", "gone", "note", "nobody"]) {
    assert.equal(layer.sheetFor(id), null, `${id} offers a sheet`);
    assert.equal(layer.openCard(id), false, `${id} opened`);
  }
  assert.deepEqual(opened, [], "a shadowed card's sheet would say what the ??? hides");
});
