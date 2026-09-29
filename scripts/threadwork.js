// Threadwork: a shared, animated relationship board drawn on its own scene.
// SPEC.md is the plan of record. This file is the entry: it registers the
// page sub-types declared in module.json and re-exports everything the tests
// need.

export const MODULE_ID = "threadwork";

/** The JournalEntryPage sub-types module.json declares, without the module prefix. */
export const PAGE_TYPES = ["card", "string", "frame"];

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
});
