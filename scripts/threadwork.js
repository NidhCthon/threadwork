// Threadwork: a shared, animated relationship board drawn on its own scene.
// SPEC.md is the plan of record. This file is the entry: it registers the page
// sub-types declared in module.json and the board's canvas layer, and
// re-exports everything the tests need.
import { MODULE_ID, PAGE_TYPES } from "./constants.js";
import { ensureBoardScene, isBoardScene } from "./board-scene.js";
import { ThreadworkLayer } from "./layer.js";
import { constellation } from "./themes/constellation.js";

export * from "./constants.js";
export * from "./geometry.js";
export * from "./motion.js";
export * from "./board-scene.js";
export * from "./draw/starfield.js";
export { ThreadworkLayer };

// Empty until M2 gives them their fields (SPEC.md 5.2). Foundry still needs a
// model registered for every declared sub-type, or the pages fail validation.
export class CardData extends foundry.abstract.TypeDataModel {
  static defineSchema() { return {}; }
}

export class StringData extends foundry.abstract.TypeDataModel {
  static defineSchema() { return {}; }
}

export class FrameData extends foundry.abstract.TypeDataModel {
  static defineSchema() { return {}; }
}

export const DATA_MODELS = { card: CardData, string: StringData, frame: FrameData };

Hooks.once("init", () => {
  for (const type of PAGE_TYPES) {
    CONFIG.JournalEntryPage.dataModels[`${MODULE_ID}.${type}`] = DATA_MODELS[type];
  }
  CONFIG.Canvas.layers[MODULE_ID] = { layerClass: ThreadworkLayer, group: "interface" };
});

Hooks.once("ready", () => ensureBoardScene(constellation));

// Modeless (SPEC.md 5.5): on the board scene the board layer is simply active,
// so nobody has to pick a tool first.
Hooks.on("canvasReady", (board) => {
  if (isBoardScene(board.scene)) board[MODULE_ID]?.activate();
});
