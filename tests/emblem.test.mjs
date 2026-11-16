// Card emblems: matching a document's data to an image in the world's folder,
// the settings that name the folder and the data, and turning any symbol into
// a silhouette the theme can colour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork, fireOnce, registered, settings } from "./foundry.mjs";

const {
  slugify, fileStem, isEmblemFile, emblemTitle, emblemLookup, emblemChoices, matchEmblem, parseFields, textAt, emblemFor, silhouette,
  EMBLEM_NONE, cardViewData, shadowCardData, emblemSettings
} = threadwork;

const FOLDER = [
  "assets/clans/brujah.webp",
  "assets/clans/toreador.png",
  "assets/clans/toreador.webp",
  "assets/clans/banu-haqim.webp",
  "assets/clans/followers-of-set.webp",
  "assets/clans/camarilla.webp",
  "assets/clans/notes.txt"
];
const lookup = emblemLookup(FOLDER);

test("names become file names the same way however they are written", () => {
  assert.equal(slugify("Brujah antitribu"), "brujah-antitribu");
  assert.equal(slugify("Banu Haqim"), "banu-haqim");
  assert.equal(slugify("  Thin-Blood "), "thin-blood");
  assert.equal(slugify("Followers of Set"), "followers-of-set");
  assert.equal(slugify("Malkavian’s"), "malkavians");
  assert.equal(slugify("Tzimisce"), "tzimisce");
  assert.equal(slugify(""), "");
  assert.equal(slugify(null), "");
});

test("only images in the folder are offered, keyed by file name", () => {
  assert.equal(fileStem("assets/clans/banu-haqim.webp"), "banu-haqim");
  assert.equal(fileStem("assets/clans/Banu%20Haqim.png?v=2"), "Banu Haqim");
  assert.ok(isEmblemFile("a/b.SVG"));
  assert.ok(!isEmblemFile("a/notes.txt"));
  assert.ok(!lookup.has("notes"));
  assert.equal(emblemTitle("assets/clans/followers-of-set.webp"), "Followers Of Set");
});

test("one file can answer to several names, and is offered once", () => {
  const folder = ["c/banu-haqim+assamite.png", "c/ministry+followers-of-set+setite.png", "c/brujah.png"];
  const several = emblemLookup(folder);
  assert.equal(matchEmblem("Assamite", several), "c/banu-haqim+assamite.png");
  assert.equal(matchEmblem("Banu Haqim", several), "c/banu-haqim+assamite.png");
  assert.equal(matchEmblem("Followers of Set", several), "c/ministry+followers-of-set+setite.png");
  assert.equal(matchEmblem("Setite", several), "c/ministry+followers-of-set+setite.png");
  assert.deepEqual(emblemChoices(several), ["c/banu-haqim+assamite.png", "c/brujah.png", "c/ministry+followers-of-set+setite.png"]);
  assert.equal(emblemTitle("c/ministry+followers-of-set+setite.png"), "Ministry", "a tooltip names it once");
});

test("two files with the same name resolve to the same one on every client", () => {
  assert.equal(lookup.get("toreador"), "assets/clans/toreador.png");
  assert.equal(emblemLookup([...FOLDER].reverse()).get("toreador"), "assets/clans/toreador.png");
});

test("a name finds its own file first, then the longest name it starts with", () => {
  assert.equal(matchEmblem("Toreador", lookup), "assets/clans/toreador.png");
  assert.equal(matchEmblem("Banu Haqim", lookup), "assets/clans/banu-haqim.webp");
  // An antitribu wears its parent clan's symbol unless the folder has its own.
  assert.equal(matchEmblem("Brujah antitribu", lookup), "assets/clans/brujah.webp");
  assert.equal(matchEmblem("Brujah antitribu", emblemLookup([...FOLDER, "x/brujah-antitribu.png"])), "x/brujah-antitribu.png");
  // A whole word at a time: "Brujahs" is not Brujah.
  assert.equal(matchEmblem("Brujahs", lookup), null);
  assert.equal(matchEmblem("Ventrue", lookup), null);
  assert.equal(matchEmblem("", lookup), null);
  assert.equal(matchEmblem("Brujah", new Map()), null);
});

test("the fields setting is a comma-separated list, tried in order", () => {
  assert.deepEqual(parseFields("system.clan, system.sect ,,"), ["system.clan", "system.sect"]);
  assert.deepEqual(parseFields(""), []);
  assert.deepEqual(parseFields(undefined), []);
});

test("data is read as text wherever a system keeps it", () => {
  const actor = { name: "Ana", system: { clan: "Brujah", sect: { value: "Camarilla" }, bloodline: { name: "Followers of Set" }, generation: 9 } };
  assert.equal(textAt(actor, "system.clan"), "Brujah");
  assert.equal(textAt(actor, "system.sect"), "Camarilla");
  assert.equal(textAt(actor, "system.bloodline"), "Followers of Set");
  assert.equal(textAt(actor, "system.generation"), null, "a number names no file");
  assert.equal(textAt(actor, "system.nothing.here"), null);
});

test("a card's emblem: chosen by hand, taken from its sheet, or none", () => {
  const emblems = { lookup, fields: ["system.clan", "system.sect"] };
  const kindred = { system: { clan: "Toreador", sect: "Camarilla" } };
  const caitiff = { system: { clan: "Caitiff", sect: "Camarilla" } };
  assert.equal(emblemFor("", kindred, emblems), "assets/clans/toreador.png");
  // No clan symbol in the folder, so the next field in the list has a go.
  assert.equal(emblemFor("", caitiff, emblems), "assets/clans/camarilla.webp");
  assert.equal(emblemFor("assets/clans/brujah.webp", kindred, emblems), "assets/clans/brujah.webp", "a hand-picked emblem wins");
  assert.equal(emblemFor(EMBLEM_NONE, kindred, emblems), null);
  assert.equal(emblemFor("", null, emblems), null, "nothing to read from a missing document");
  assert.equal(emblemFor("", kindred, { lookup, fields: [] }), null, "no fields means by hand only");
  assert.equal(emblemFor("", kindred, null), null);
  assert.equal(emblemFor("x/picked.png", null, null), "x/picked.png", "a picked emblem needs no folder");
});

const cardPage = (system) => ({
  id: "c1", name: "Page name",
  system: { kind: "document", uuid: "Actor.a1", x: 0, y: 0, w: 380, h: 132, caption: "", lastName: "", lastImg: null, visibility: "everyone", author: "u1", locked: false, emblem: "", ...system }
});

test("a portrait card wears its emblem; notes, concepts and shadows do not", () => {
  const emblems = { lookup, fields: ["system.clan"] };
  const actor = { documentName: "Actor", name: "Ana", img: "ana.webp", system: { clan: "Brujah" } };
  assert.equal(cardViewData(cardPage({}), actor, emblems).emblem, "assets/clans/brujah.webp");
  assert.equal(cardViewData(cardPage({}), actor).emblem, null, "no world emblems, nothing to match");
  assert.equal(cardViewData(cardPage({ kind: "hub", uuid: null, emblem: "assets/clans/brujah.webp" }), null, emblems).emblem, null);
  // A page saved before emblems existed has no field at all.
  const old = cardPage({});
  delete old.system.emblem;
  assert.equal(cardViewData(old, actor, emblems).emblem, "assets/clans/brujah.webp");
  // A clan says who it is as surely as a name does.
  assert.equal(shadowCardData(cardViewData(cardPage({}), actor, emblems)).emblem, null);
});

/* -------------------------------------------- */
/*  Silhouettes                                 */
/* -------------------------------------------- */

const pixels = (...rgba) => new Uint8ClampedArray(rgba.flat());
const alphas = (data) => [...data].filter((_, i) => i % 4 === 3);
const allWhite = (data) => [...data].every((v, i) => i % 4 === 3 || v === 255);

test("a symbol on a transparent sheet is shaped by its alpha, whatever its colour", () => {
  // Black ink, half-covered edge, and nothing: the ink would vanish on a dark board.
  const data = silhouette(pixels([0, 0, 0, 255], [0, 0, 0, 128], [0, 0, 0, 0], [200, 30, 30, 255]));
  assert.ok(allWhite(data), "every pixel turns white, for the theme to tint");
  assert.deepEqual(alphas(data), [255, 128, 0, 255]);
});

test("a symbol printed on white paper is shaped by its dark ink", () => {
  const data = silhouette(pixels([255, 255, 255, 255], [255, 255, 255, 255], [255, 255, 255, 255], [0, 0, 0, 255]));
  assert.ok(allWhite(data));
  assert.deepEqual(alphas(data), [0, 0, 0, 255]);
});

test("a light symbol on a dark sheet is shaped by its light ink", () => {
  const data = silhouette(pixels([0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [255, 255, 255, 255]));
  assert.deepEqual(alphas(data), [0, 0, 0, 255]);
});

test("an empty image is left alone", () => {
  assert.equal(silhouette(new Uint8ClampedArray(0)).length, 0);
});

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

test("the emblem folder and the data that picks one are world settings the GM sets", async () => {
  await fireOnce("init");
  const get = (key) => registered.find((r) => r.module === "threadwork" && r.key === key)?.options;
  const folder = get("emblemFolder");
  assert.equal(folder.scope, "world");
  assert.equal(folder.config, true);
  assert.equal(folder.filePicker, "folder");
  assert.equal(folder.default, "", "Threadwork ships no symbols, so none are on until a world names a folder");
  const fields = get("emblemFields");
  assert.equal(fields.scope, "world");
  assert.equal(fields.default, "", "no system's data is assumed");
  const index = get("emblemIndex");
  assert.equal(index.config, false, "the index is the GM's listing of the folder, not something to edit");
  assert.equal(index.scope, "world");
});

test("emblem settings come back as a lookup and a list of fields", () => {
  settings.set("threadwork.emblemIndex", FOLDER);
  settings.set("threadwork.emblemFields", "system.clan, system.sect");
  const emblems = emblemSettings();
  assert.equal(emblems.lookup.get("brujah"), "assets/clans/brujah.webp");
  assert.deepEqual(emblems.fields, ["system.clan", "system.sect"]);
  assert.equal(emblemSettings(), emblems, "unchanged settings are not re-parsed for every card");
  settings.delete("threadwork.emblemIndex");
  settings.delete("threadwork.emblemFields");
  assert.equal(emblemSettings().lookup.size, 0, "a world that never set them has no emblems");
});
