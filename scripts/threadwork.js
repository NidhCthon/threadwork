// Threadwork: a shared, animated relationship board drawn on its own scene.
// SPEC.md is the plan of record. This file is the entry: it registers the page
// sub-types declared in module.json and the board's canvas layer, wires
// Foundry's hooks to them, and re-exports everything the tests need.
import { MODULE_ID, PAGE_TYPES } from "./constants.js";
import { allowActorDragOnBoard, refreshActorDrag } from "./actor-drag.js";
import { ensureBoardScene, isBoardScene } from "./board-scene.js";
import { DATA_MODELS, ensureBoardJournal, isBoardJournal } from "./data.js";
import { onDropCanvasData } from "./drops.js";
import { ThreadworkLayer } from "./layer.js";
import { constellation } from "./themes/constellation.js";

export * from "./constants.js";
export * from "./geometry.js";
export * from "./motion.js";
export * from "./board-scene.js";
export * from "./data.js";
export * from "./navigation.js";
export * from "./draw/starfield.js";
export * from "./actor-drag.js";
export * from "./undo.js";
export { ThreadworkLayer };

Hooks.once("init", () => {
  for (const type of PAGE_TYPES) {
    CONFIG.JournalEntryPage.dataModels[`${MODULE_ID}.${type}`] = DATA_MODELS[type];
  }
  CONFIG.Canvas.layers[MODULE_ID] = { layerClass: ThreadworkLayer, group: "interface" };
  // Core has Ctrl+Z (it reaches the layer's _onUndoKey) but no redo.
  game.keybindings.register(MODULE_ID, "redo", {
    name: "Redo on the Party Board",
    editable: [{ key: "KeyZ", modifiers: ["Control", "Shift"] }, { key: "KeyY", modifiers: ["Control"] }],
    onDown: () => {
      const layer = canvas?.[MODULE_ID];
      if (!layer?.view || !layer.active) return false;
      layer.redo();
      return true;
    }
  });
});

// After every init (a system may swap in its own actor directory, as pf2e
// does) but before the sidebar first renders and binds its drag rule.
Hooks.once("setup", () => allowActorDragOnBoard(CONFIG.ui.actors));

Hooks.once("ready", async () => {
  const scene = await ensureBoardScene(constellation);
  await ensureBoardJournal(scene);
});

// Modeless (SPEC.md 5.5): on the board scene the board layer is simply active,
// so nobody has to pick a tool first. Leaving the board hands control back to tokens.
Hooks.on("canvasReady", (board) => {
  refreshActorDrag(isBoardScene(board.scene));
  if (isBoardScene(board.scene)) {
    board[MODULE_ID]?.activate();
    board[MODULE_ID]?.reopenDrafts();
  } else if (board.activeLayer === board[MODULE_ID]) board.tokens?.activate();
});

Hooks.on("dropCanvasData", onDropCanvasData);

// Every client redraws from the journal, so an edit anywhere shows up everywhere.
const layer = () => globalThis.canvas?.[MODULE_ID];
for (const action of ["create", "update", "delete"]) {
  Hooks.on(`${action}JournalEntryPage`, (page) => {
    if (isBoardJournal(page.parent)) layer()?.onPage(page, action);
    else layer()?.onDocument(page);
  });
  for (const type of ["Actor", "Item", "JournalEntry"]) {
    Hooks.on(`${action}${type}`, (doc) => layer()?.onDocument(doc));
  }
}

// The board's pages are not meant to be opened as a journal; keep it out of the sidebar.
Hooks.on("renderJournalDirectory", (_app, html) => {
  const entry = game.journal.find(isBoardJournal);
  if (entry) html.querySelector?.(`[data-entry-id="${entry.id}"]`)?.remove();
});
