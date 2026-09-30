// Dropping documents onto the board (SPEC.md 5.5). On the board scene an
// Actor, Item or Journal dropped from the sidebar becomes a card, instead of
// the token or map note core would make.
import { isBoardScene } from "./board-scene.js";
import { DROPPABLE, cardCreateData, pageType } from "./data.js";
import { boardJournal, history } from "./layer.js";
import { beforeOf } from "./undo.js";

/**
 * The dropCanvasData hook. Returning false stops core's own handling, which is
 * how a player dropping an Actor avoids core trying (and failing) to make a token.
 */
export function onDropCanvasData(board, data) {
  if (!isBoardScene(board.scene) || !DROPPABLE.includes(data?.type)) return;
  dropDocument(data);
  return false;
}

/** Make a card for the dropped document, or move its existing card to the drop point. */
export async function dropDocument(data) {
  const journal = boardJournal();
  if (!journal) {
    ui.notifications.warn("The Party Board isn't set up yet: a GM needs to log in once with Threadwork enabled.");
    return null;
  }
  const doc = await fromUuid(data.uuid);
  if (!doc) return null;
  const create = cardCreateData(doc, { x: data.x, y: data.y }, game.user.id);
  // One card per document: dropping it again moves the card you already have.
  const existing = journal.pages.find((p) => p.type === pageType("card") && p.system.uuid === doc.uuid);
  if (existing) {
    const after = { system: { x: create.system.x, y: create.system.y } };
    const before = beforeOf(existing.toObject(), after);
    await existing.update(after);
    history.record({ kind: "update", changes: [{ _id: existing.id, before, after }] });
    return existing;
  }
  const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [create]);
  if (page) history.record({ kind: "create", pages: [page.toObject()] });
  return page ?? null;
}
