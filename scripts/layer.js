// The canvas layer that hosts the board on the board scene (SPEC.md 5.1). All
// drawing and motion live in BoardView; this file connects it to Foundry: the
// board journal's pages, the ticker, PreciseText, textures, the HUD for typing,
// and the scene controls.
import { MODULE_ID } from "./constants.js";
import { BoardView } from "./board-view.js";
import { isBoardScene } from "./board-scene.js";
import { closeMenu, showMenu } from "./context-menu.js";
import { cardViewData, isBoardJournal, pageType, stringCreateData, stringViewData } from "./data.js";
import { prefersReducedMotion } from "./motion.js";
import { goBack, goToBoard } from "./navigation.js";
import { constellation } from "./themes/constellation.js";
import { UndoStack, beforeOf, cascadeFor } from "./undo.js";

/** This user's own board edits, for Ctrl+Z. Per browser tab; gone on reload. */
export const history = new UndoStack();

/**
 * Apply an undo operation to the journal. Pages already in the state asked for
 * are skipped, so undoing something someone else has since changed does not throw.
 */
export async function applyOperation(journal, op) {
  if (op.kind === "create") {
    // Cards before strings, so a restored string's cards are there when it draws.
    const rank = (p) => (p.type === pageType("card") ? 0 : 1);
    const fresh = op.pages.filter((p) => !journal.pages.has(p._id)).sort((a, b) => rank(a) - rank(b));
    if (fresh.length) await journal.createEmbeddedDocuments("JournalEntryPage", fresh, { keepId: true });
  } else if (op.kind === "delete") {
    const ids = op.pages.map((p) => p._id).filter((id) => journal.pages.has(id));
    if (ids.length) await journal.deleteEmbeddedDocuments("JournalEntryPage", ids);
  } else if (op.kind === "update") {
    const updates = op.changes.filter((c) => journal.pages.has(c._id)).map((c) => ({ _id: c._id, ...c.after }));
    if (updates.length) await journal.updateEmbeddedDocuments("JournalEntryPage", updates);
  }
}

const hex = (color) => `#${color.toString(16).padStart(6, "0")}`;

/**
 * Labels someone was typing when the board was torn down under them (the GM
 * activated a scene, or the canvas redrew), keyed by string page id. They are
 * reopened with the half-typed text when that board draws again.
 */
export const drafts = new Map();

export const boardJournal = () => game.journal.find(isBoardJournal) ?? null;

const colorOfUser = (userId) => {
  const color = game.users.get(userId)?.color;
  return color == null ? null : Number(color);
};

const resolve = (uuid) => (uuid ? fromUuidSync(uuid, { strict: false }) ?? null : null);

/** Open a card's document the way its own sidebar would: journal pages open in their journal. */
function openSheet(doc) {
  if (doc.documentName === "JournalEntryPage") return doc.parent?.sheet?.render(true, { pageId: doc.id });
  return doc.sheet?.render(true);
}

export const cardFromPage = (page) => cardViewData(page, resolve(page.system.uuid));
export const stringFromPage = (page) => stringViewData(page, colorOfUser(page.system.author));

export class ThreadworkLayer extends foundry.canvas.layers.InteractionLayer {
  /** @type {BoardView|null} */
  view = null;

  #tick = null;
  #editor = null;

  static get layerOptions() {
    return Object.assign(super.layerOptions, { name: MODULE_ID, zIndex: 150 });
  }

  static prepareSceneControls() {
    return {
      name: MODULE_ID,
      order: 20,
      title: "Party Board",
      layer: MODULE_ID,
      icon: "fa-solid fa-diagram-project",
      // Choosing the group from any other scene takes you to the board.
      onChange: (_event, active) => {
        if (!active) return;
        if (isBoardScene(canvas.scene)) canvas[MODULE_ID].activate();
        else goToBoard();
      },
      tools: {
        board: { name: "board", order: 1, title: "Arrange the board", icon: "fa-solid fa-hand-pointer", interaction: true },
        back: { name: "back", order: 2, title: "Back to where you were", icon: "fa-solid fa-arrow-left", button: true, onChange: () => goBack() }
      }
    };
  }

  async _draw(options) {
    await super._draw(options);
    if (!isBoardScene(canvas.scene)) return;
    const rect = canvas.dimensions.sceneRect;
    const journal = boardJournal();
    const pages = journal?.pages.contents ?? [];
    const view = new BoardView({
      PIXI,
      root: this,
      theme: constellation,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      cards: pages.filter((p) => p.type === pageType("card")).map(cardFromPage),
      strings: pages.filter((p) => p.type === pageType("string")).map(stringFromPage),
      makeText: (text, style) => new foundry.canvas.containers.PreciseText(text, new PIXI.TextStyle(style)),
      loadTexture: (src) => foundry.canvas.loadTexture(src),
      editText: (request) => this.#editInHud(request),
      userColor: colorOfUser(game.user.id),
      reducedMotion: prefersReducedMotion()
    });
    view.onCardMoved = (id, { x, y }) => this.updatePage(id, { system: { x, y } });
    view.onLabelChanged = (id, label) => this.updatePage(id, { system: { label } });
    view.onConnect = (from, to) => this.#connect(journal, from, to);
    view.onContextMenu = ({ kind, id, clientX, clientY }) => this.#openMenu(kind, id, { x: clientX, y: clientY });
    this.view = view;
    await view.build();
    this.#tick = () => this.view?.update(canvas.app.ticker.deltaMS / 1000);
    canvas.app.ticker.add(this.#tick);
  }

  /**
   * Reopen any label that was being typed when the board was last torn down.
   * Called on canvasReady, not from _draw: the canvas re-renders the HUD after
   * its layers draw, which would wipe out an input opened any earlier.
   */
  reopenDrafts() {
    if (!this.view) return;
    for (const [id, value] of drafts) {
      if (!this.view.strings.has(id)) continue;
      drafts.delete(id);
      this.view.editString(id, value);
    }
  }

  async _tearDown(options) {
    closeMenu();
    if (this.#tick) canvas.app.ticker.remove(this.#tick);
    this.#tick = null;
    if (this.#editor) {
      drafts.set(this.#editor.id, this.#editor.input.value);
      this.#editor.finish(null);
    }
    this.view?.destroy();
    this.view = null;
    return super._tearDown(options);
  }

  /** Make the string page. Returns its id so the view can open the label editor on it. */
  async #connect(journal, fromId, toId) {
    if (!journal) return null;
    const from = journal.pages.get(fromId);
    const to = journal.pages.get(toId);
    if (!from || !to) return null;
    const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [
      stringCreateData({ id: from.id, name: from.name }, { id: to.id, name: to.name }, game.user.id)
    ]);
    if (page) history.record({ kind: "create", pages: [page.toObject()] });
    return page?.id ?? null;
  }

  /* -------------------------------------------- */
  /*  Undoable edits                              */
  /* -------------------------------------------- */

  /** Change a board page, remembering what it was so Ctrl+Z can put it back. */
  async updatePage(id, after) {
    const page = boardJournal()?.pages.get(id);
    if (!page) return;
    const before = beforeOf(page.toObject(), after);
    await page.update(after);
    history.record({ kind: "update", changes: [{ _id: id, before, after }] });
  }

  /** Take a card off the board, with every string attached to it. The document itself is untouched. */
  async removeCard(id) {
    const journal = boardJournal();
    if (!journal) return;
    const pages = cascadeFor(id, journal.pages.contents.map((p) => p.toObject()), pageType("string"));
    if (!pages.length) return;
    await journal.deleteEmbeddedDocuments("JournalEntryPage", pages.map((p) => p._id));
    history.record({ kind: "delete", pages });
  }

  async removeString(id) {
    const journal = boardJournal();
    const page = journal?.pages.get(id);
    if (!page) return;
    const pages = [page.toObject()];
    await journal.deleteEmbeddedDocuments("JournalEntryPage", [id]);
    history.record({ kind: "delete", pages });
  }

  async undo() {
    const journal = boardJournal();
    const op = journal && history.takeUndo();
    if (!op) return false;
    await applyOperation(journal, op);
    return true;
  }

  async redo() {
    const journal = boardJournal();
    const op = journal && history.takeRedo();
    if (!op) return false;
    await applyOperation(journal, op);
    return true;
  }

  /** Ctrl+Z, from core's keybinding, while the board layer is active. */
  _onUndoKey(_event) {
    if (!this.view || !history.canUndo) return false;
    this.undo();
    return true;
  }

  /** Delete or Backspace, from core's keybinding: remove whatever the pointer is over. */
  _onDeleteKey(_event) {
    const target = this.view?.hovered();
    if (!target) return false;
    if (target.kind === "card") this.removeCard(target.id);
    else this.removeString(target.id);
    return true;
  }

  /* -------------------------------------------- */
  /*  Right-click menu                            */
  /* -------------------------------------------- */

  #openMenu(kind, id, at) {
    const journal = boardJournal();
    const page = journal?.pages.get(id);
    if (!page) return;
    if (kind === "card") {
      const card = this.view?.cards.get(id)?.data;
      const doc = page.system.uuid ? fromUuidSync(page.system.uuid, { strict: false }) : null;
      const items = [];
      if (doc && doc.testUserPermission?.(game.user, "LIMITED")) {
        items.push({ label: "Open sheet", icon: "fa-solid fa-book-open", action: () => openSheet(doc) }, "-");
      }
      // "Remove from board", not "delete": the actor, item or journal itself is not touched.
      items.push({ label: "Remove from board", icon: "fa-solid fa-xmark", danger: true, action: () => this.removeCard(id) });
      showMenu(at, items, { title: card?.name ?? page.name });
      return;
    }
    const s = page.system;
    const name = (cardId) => this.view?.cards.get(cardId)?.data.name ?? "?";
    const arrows = (value) => () => this.updatePage(id, { system: { arrows: value } });
    showMenu(at, [
      { label: "One way", icon: "fa-solid fa-arrow-right-long", current: s.arrows === "forward", action: arrows("forward") },
      { label: "Both ways", icon: "fa-solid fa-arrows-left-right", current: s.arrows === "both", action: arrows("both") },
      { label: "No arrow", icon: "fa-solid fa-minus", current: s.arrows === "none", action: arrows("none") },
      { label: "Reverse direction", icon: "fa-solid fa-right-left", action: () => this.updatePage(id, { system: { from: s.to, to: s.from } }) },
      "-",
      { label: "Edit label", icon: "fa-solid fa-pen", action: () => this.view?.editString(id) },
      { label: "Delete string", icon: "fa-solid fa-trash", danger: true, action: () => this.removeString(id) }
    ], { title: `${name(s.from)} → ${name(s.to)}` });
  }

  /* -------------------------------------------- */
  /*  Keeping the view in step with the journal   */
  /* -------------------------------------------- */

  /** A board page was created, updated or deleted on any client. */
  onPage(page, action) {
    if (!this.view || !isBoardJournal(page.parent)) return;
    const isCard = page.type === pageType("card");
    const isString = page.type === pageType("string");
    if (action === "delete") {
      if (isCard) this.view.removeCard(page.id);
      if (isString) this.view.removeString(page.id);
      return;
    }
    if (isCard) this.view.updateCard(cardFromPage(page));
    if (isString) this.view.updateString(stringFromPage(page));
  }

  /** A document behind some cards changed or went away: refresh their name, image and caption. */
  onDocument(doc) {
    if (!this.view) return;
    const journal = boardJournal();
    for (const card of this.view.cards.values()) {
      const page = journal?.pages.get(card.data.id);
      if (!page?.system.uuid) continue;
      const matches = page.system.uuid === doc.uuid || page.system.uuid.startsWith(`${doc.uuid}.`) || doc.uuid?.startsWith(`${page.system.uuid}.`);
      if (matches) this.view.updateCard(cardFromPage(page));
    }
  }

  /* -------------------------------------------- */
  /*  Typing in the HUD                           */
  /* -------------------------------------------- */

  /**
   * Type into an HTML input placed in the canvas HUD at board coordinates. The
   * HUD is re-aligned on every pan and zoom, so the input stays on the label.
   */
  #editInHud({ id, x, y, value, color, fontSize }) {
    const hud = canvas.hud?.element;
    if (!hud) return Promise.resolve(null);
    this.#editor?.finish(this.#editor.input.value);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "threadwork-label-input";
    input.placeholder = "Say how they're connected";
    input.value = value;
    Object.assign(input.style, { left: `${x}px`, top: `${y}px`, fontSize: `${fontSize}px`, borderColor: hex(color) });
    hud.append(input);
    input.focus();
    input.select();
    return new Promise((resolvePromise) => {
      // If anything re-renders the HUD under the input, keep the text as a draft
      // and give the label back, rather than leaving it hidden forever.
      const watcher = new MutationObserver(() => {
        if (input.isConnected) return;
        drafts.set(id, input.value);
        editor.finish(null);
      });
      const editor = {
        id, input,
        finish: (result) => {
          if (this.#editor !== editor) return;
          this.#editor = null;
          watcher.disconnect();
          input.remove();
          resolvePromise(result);
        }
      };
      this.#editor = editor;
      watcher.observe(hud, { childList: true, subtree: true });
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") editor.finish(input.value);
        else if (event.key === "Escape") editor.finish(null);
      });
      input.addEventListener("blur", () => editor.finish(input.value));
    });
  }
}
