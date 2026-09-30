// module.json and the entry script have to agree: Foundry refuses a page whose
// declared sub-type has no registered data model, and an esmodules path that
// does not exist fails silently at load.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { threadwork, fireOnce } from "./foundry.mjs";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("module.json", root), "utf8"));

test("the manifest id is the module id the code uses", () => {
  assert.equal(manifest.id, threadwork.MODULE_ID);
});

test("it targets Foundry v14", () => {
  assert.match(manifest.compatibility.minimum, /^14\./);
  assert.match(manifest.compatibility.verified, /^14\./);
});

test("every esmodule and stylesheet it lists exists", async () => {
  for (const path of [...manifest.esmodules, ...manifest.styles]) await access(new URL(path, root));
});

test("it declares exactly the page sub-types the code knows", () => {
  assert.deepEqual(Object.keys(manifest.documentTypes.JournalEntryPage).sort(), [...threadwork.PAGE_TYPES].sort());
});

test("init registers a data model for every declared sub-type, under the module prefix", async () => {
  await fireOnce("init");
  for (const type of Object.keys(manifest.documentTypes.JournalEntryPage)) {
    assert.equal(CONFIG.JournalEntryPage.dataModels[`threadwork.${type}`], threadwork.DATA_MODELS[type], type);
  }
});

test("init registers the board layer in the interface group", () => {
  assert.equal(CONFIG.Canvas.layers.threadwork.layerClass, threadwork.ThreadworkLayer);
  assert.equal(CONFIG.Canvas.layers.threadwork.group, "interface");
  assert.equal(threadwork.ThreadworkLayer.layerOptions.name, "threadwork", "canvas.threadwork is how the control finds it");
});

test("init registers a redo key, since core only has undo", async () => {
  const { keybindings } = await import("./foundry.mjs");
  const redo = keybindings.find((k) => k.module === "threadwork" && k.name === "redo");
  assert.ok(redo, "a redo keybinding exists");
  assert.deepEqual(redo.options.editable[0], { key: "KeyZ", modifiers: ["Control", "Shift"] });
});

test("the download URL carries the manifest's version", () => {
  assert.ok(manifest.download.includes(`/v${manifest.version}/`), manifest.download);
});
