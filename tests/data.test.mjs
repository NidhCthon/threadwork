// From journal pages to what the board draws, and back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { threadwork } from "./foundry.mjs";

const { cardViewData, stringViewData, cardCreateData, stringCreateData, firstLine, imageOf, captionOf, boardJournalData, isBoardJournal, CARD_SIZE } = threadwork;

const cardPage = (system) => ({
  id: "c1", name: "Page name",
  system: { kind: "document", uuid: "Actor.a1", x: 10, y: 20, w: 380, h: 132, caption: "", lastName: "", lastImg: null, visibility: "everyone", author: "u1", locked: false, ...system }
});

test("a card shows its document's current name and image, not what was saved", () => {
  const data = cardViewData(cardPage({ lastName: "Old name", lastImg: "old.webp" }), { documentName: "Actor", name: "Kyra", img: "kyra.webp" });
  assert.equal(data.name, "Kyra");
  assert.equal(data.img, "kyra.webp");
  assert.equal(data.missing, false);
});

test("a card whose document is gone falls back to its last name and image, marked missing", () => {
  const data = cardViewData(cardPage({ lastName: "Mayor Oskar", lastImg: "oskar.webp" }), null);
  assert.equal(data.name, "Mayor Oskar");
  assert.equal(data.img, "oskar.webp");
  assert.equal(data.missing, true);
});

test("a board caption wins over a journal's first line", () => {
  const journal = { documentName: "JournalEntryPage", type: "text", name: "Rumours", text: { content: "<p>The mill burned twice.</p>" } };
  assert.equal(cardViewData(cardPage({ uuid: "JournalEntry.j.JournalEntryPage.p" }), journal).caption, "The mill burned twice.");
  assert.equal(cardViewData(cardPage({ uuid: "JournalEntry.j.JournalEntryPage.p", caption: "Ask Oskar" }), journal).caption, "Ask Oskar");
});

test("firstLine finds the first non-empty line of HTML and trims long ones", () => {
  assert.equal(firstLine("<h2></h2><p>&nbsp;</p><p>Grayce&#39;s &amp; mill</p><p>second</p>"), "Grayce's & mill");
  assert.equal(firstLine("line one<br>line two"), "line one");
  assert.equal(firstLine(null), "");
  const long = firstLine(`<p>${"a".repeat(100)}</p>`, 20);
  assert.equal(long.length, 20);
  assert.ok(long.endsWith("…"));
});

test("journals have no image of their own, so their cards get a book", () => {
  assert.equal(imageOf({ documentName: "JournalEntry" }), "icons/svg/book.svg");
  assert.equal(imageOf({ documentName: "JournalEntryPage", type: "image", src: "map.webp" }), "map.webp");
  assert.equal(imageOf({ documentName: "Item", img: "sword.webp" }), "sword.webp");
  assert.equal(imageOf(null), null);
});

test("a journal entry's caption comes from its first text page", () => {
  const entry = { documentName: "JournalEntry", pages: { contents: [{ type: "image" }, { type: "text", text: { content: "<p>Found at the ford.</p>" } }] } };
  assert.equal(captionOf(entry), "Found at the ford.");
  assert.equal(captionOf({ documentName: "Actor" }), "");
});

test("a dropped card is centred on the drop point and remembers who made it", () => {
  const data = cardCreateData({ name: "Kyra", uuid: "Actor.k", documentName: "Actor", img: "kyra.webp" }, { x: 1000, y: 500 }, "player-one");
  assert.equal(data.type, "threadwork.card");
  assert.equal(data.system.x, 1000 - CARD_SIZE.document.w / 2);
  assert.equal(data.system.y, 500 - CARD_SIZE.document.h / 2);
  assert.equal(data.system.author, "player-one");
  assert.equal(data.system.lastName, "Kyra");
  assert.equal(data.system.lastImg, "kyra.webp");
});

test("a new string starts unlabelled, pointing from the card it was drawn from", () => {
  const data = stringCreateData({ id: "a", name: "Kyra" }, { id: "b", name: "Oskar" }, "player-one");
  assert.equal(data.type, "threadwork.string");
  assert.deepEqual([data.system.from, data.system.to, data.system.label, data.system.arrows], ["a", "b", "", "forward"]);
  assert.equal(data.name, "Kyra → Oskar");
});

test("a string without its own colour takes its author's", () => {
  const page = { id: "s1", system: { from: "a", to: "b", label: "", arrows: "forward", color: null, visibility: "everyone", author: "u1", locked: false } };
  assert.equal(stringViewData(page, 0xff0000).color, 0xff0000);
  assert.equal(stringViewData({ ...page, system: { ...page.system, color: 0x00ff00 } }, 0xff0000).color, 0x00ff00);
  assert.equal(stringViewData(page, null).color, null, "the theme colour applies when nobody's colour is known");
});

test("players own the board journal, because making a page needs OWNER on it", () => {
  const data = boardJournalData("scene-1");
  assert.equal(data.ownership.default, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
  const entry = { getFlag: (scope, key) => data.flags[scope]?.[key] };
  assert.equal(isBoardJournal(entry), true);
  assert.equal(entry.getFlag("threadwork", "board").sceneId, "scene-1");
});
