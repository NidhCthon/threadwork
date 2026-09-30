// The canvas layer that hosts the board on the board scene (SPEC.md 5.1). All
// drawing and motion live in BoardView; this file connects it to Foundry: the
// board journal's pages, who may see and change what, the ticker, PreciseText,
// textures, the HUD for typing, the right-click menus and the scene controls.
import { MODULE_ID } from "./constants.js";
import { BoardView } from "./board-view.js";
import { isBoardScene } from "./board-scene.js";
import { closeMenu, showMenu } from "./context-menu.js";
import {
  CARD_SIZE, canModify, cardViewData, frameCreateData, frameViewData, isBoardJournal, noteCreateData,
  pageType, stringCreateData, stringViewData, visibleTo
} from "./data.js";
import { goBack, goToBoard } from "./navigation.js";
import { reduceMotion } from "./settings.js";
import { constellation } from "./themes/constellation.js";
import { UndoStack, beforeOf, cascadeFor } from "./undo.js";

const hex = (color) => `#${color.toString(16).padStart(6, "0")}`;

/** This user's own board edits, for Ctrl+Z. Per browser tab; gone on reload. */
export const history = new UndoStack();

/**
 * Text someone was typing when the board was torn down under them (the GM
 * activated a scene, or the canvas redrew), keyed by page id. It is reopened,
 * half-typed, when that board draws again.
 */
export const drafts = new Map();

export const boardJournal = () => game.journal.find(isBoardJournal) ?? null;

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

const colorOfUser = (userId) => {
  const color = game.users.get(userId)?.color;
  return color == null ? null : Number(color);
};

const resolve = (uuid) => (uuid ? fromUuidSync(uuid, { strict: false }) ?? null : null);

export const cardFromPage = (page) => cardViewData(page, resolve(page.system.uuid));
export const stringFromPage = (page) => stringViewData(page, colorOfUser(page.system.author));

/**
 * The pages this user should see, split by type. A string is only drawn when
 * both of its cards are, so hiding a card hides the strings that lead to it.
 */
export function visiblePages(pages, user) {
  const shown = (p) => visibleTo(p.system, user);
  const cards = pages.filter((p) => p.type === pageType("card") && shown(p));
  const ids = new Set(cards.map((p) => p.id));
  const strings = pages.filter((p) => p.type === pageType("string") && shown(p) && ids.has(p.system.from) && ids.has(p.system.to));
  const frames = pages.filter((p) => p.type === pageType("frame") && shown(p));
  return { cards, strings, frames };
}

/** Open a card's document the way its own sidebar would: journal pages open in their journal. */
function openSheet(doc) {
  if (doc.documentName === "JournalEntryPage") return doc.parent?.sheet?.render(true, { pageId: doc.id });
  return doc.sheet?.render(true);
}

const LOCKED_NOTE = "Locked by the GM";

export class ThreadworkLayer extends foundry.canvas.layers.InteractionLayer {
  /** @type {BoardView|null} */
  view = null;

  #tick = null;
  #editor = null;
  /** Notes made but not yet written in: kept only once they have words. */
  #fresh = new Set();

  static get layerOptions() {
    return Object.assign(super.layerOptions, { name: MODULE_ID, zIndex: 150 });
  }

  static prepareSceneControls() {
    const here = () => ({ x: canvas.stage.pivot.x, y: canvas.stage.pivot.y });
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
        note: { name: "note", order: 2, title: "New note in the middle of the view", icon: "fa-solid fa-note-sticky", button: true, onChange: () => canvas[MODULE_ID]?.createNote("text", here()) },
        frame: { name: "frame", order: 3, title: "New frame in the middle of the view", icon: "fa-regular fa-square", button: true, onChange: () => canvas[MODULE_ID]?.createFrame(here()) },
        back: { name: "back", order: 4, title: "Back to where you were", icon: "fa-solid fa-arrow-left", button: true, onChange: () => goBack() }
      }
    };
  }

  async _draw(options) {
    await super._draw(options);
    if (!isBoardScene(canvas.scene)) return;
    const rect = canvas.dimensions.sceneRect;
    const { cards, strings, frames } = visiblePages(boardJournal()?.pages.contents ?? [], game.user);
    const view = new BoardView({
      PIXI,
      root: this,
      theme: constellation,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      cards: cards.map(cardFromPage),
      strings: strings.map(stringFromPage),
      frames: frames.map(frameViewData),
      makeText: (text, style) => new foundry.canvas.containers.PreciseText(text, new PIXI.TextStyle(style)),
      loadTexture: (src) => foundry.canvas.loadTexture(src),
      editText: (request) => this.#editInHud(request),
      canModify: (item) => canModify(item, game.user),
      userColor: colorOfUser(game.user.id),
      reducedMotion: reduceMotion()
    });
    view.onCardMoved = (id, { x, y }) => this.updatePages([{ _id: id, system: { x, y } }]);
    view.onLabelChanged = (id, label) => this.updatePages([{ _id: id, system: { label } }]);
    view.onCaptionChanged = (id, text) => this.#captionChanged(id, text);
    view.onEditCancelled = (id) => this.#editCancelled(id);
    view.onConnect = (from, to) => this.#connect(from, to);
    view.onContextMenu = ({ kind, id, clientX, clientY }) => this.#openMenu(kind, id, { x: clientX, y: clientY });
    view.onFrameMoved = (id, position, carried) => this.updatePages([
      { _id: id, system: position },
      ...carried.map(({ id: cardId, x, y }) => ({ _id: cardId, system: { x, y } }))
    ]);
    view.onFrameResized = (id, { w, h }) => this.updatePages([{ _id: id, system: { w, h } }]);
    view.onFrameRenamed = (id, title) => this.updatePages([{ _id: id, name: title || "Frame", system: { title } }]);
    this.view = view;
    await view.build();
    this.#tick = () => this.view?.update(canvas.app.ticker.deltaMS / 1000);
    canvas.app.ticker.add(this.#tick);
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

  /**
   * Reopen anything that was being typed when the board was last torn down.
   * Called on canvasReady, not from _draw: the canvas re-renders the HUD after
   * its layers draw, which would wipe out an input opened any earlier.
   */
  reopenDrafts() {
    if (!this.view) return;
    for (const [id, value] of drafts) {
      if (!this.view.strings.has(id) && !this.view.cards.has(id) && !this.view.frames.has(id)) continue;
      drafts.delete(id);
      this.view.editItem(id, value);
    }
  }

  /* -------------------------------------------- */
  /*  Keeping the view in step with the journal   */
  /* -------------------------------------------- */

  /**
   * Bring the view in line with the journal: add what is newly visible, update
   * what changed, remove what is gone or now hidden. Called after every board
   * page change, from any client, so visibility changes need no special case.
   */
  sync() {
    const view = this.view;
    if (!view) return;
    const { cards, strings, frames } = visiblePages(boardJournal()?.pages.contents ?? [], game.user);
    const reconcile = (current, pages, toData, upsert, remove) => {
      const wanted = new Set(pages.map((p) => p.id));
      for (const id of [...current.keys()]) if (!wanted.has(id)) remove(id);
      for (const page of pages) upsert(toData(page));
    };
    reconcile(view.frames, frames, frameViewData, (d) => view.updateFrame(d), (id) => view.removeFrame(id));
    reconcile(view.cards, cards, cardFromPage, (d) => view.updateCard(d), (id) => view.removeCard(id));
    reconcile(view.strings, strings, stringFromPage, (d) => view.updateString(d), (id) => view.removeString(id));
  }

  /** A document behind some cards changed or went away: refresh their name, image and caption. */
  onDocument(doc) {
    if (!this.view) return;
    const journal = boardJournal();
    for (const card of this.view.cards.values()) {
      const page = journal?.pages.get(card.data.id);
      const uuid = page?.system.uuid;
      if (!uuid) continue;
      if (uuid === doc.uuid || uuid.startsWith(`${doc.uuid}.`) || doc.uuid?.startsWith(`${uuid}.`)) this.view.updateCard(cardFromPage(page));
    }
  }

  /* -------------------------------------------- */
  /*  Making things                               */
  /* -------------------------------------------- */

  /** Make the string page. Returns its id so the view can open the label editor on it. */
  async #connect(fromId, toId) {
    const journal = boardJournal();
    const from = journal?.pages.get(fromId);
    const to = journal?.pages.get(toId);
    if (!from || !to) return null;
    const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [
      stringCreateData({ id: from.id, name: from.name }, { id: to.id, name: to.name }, game.user.id)
    ]);
    if (page) history.record({ kind: "create", pages: [page.toObject()] });
    return page?.id ?? null;
  }

  /** A note ("text") or a concept ("hub") at a board point, opened for writing. */
  async createNote(kind, point) {
    const journal = this.#journalOrWarn();
    if (!journal) return;
    const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [noteCreateData(kind, point, game.user.id)]);
    if (!page) return;
    // Not an undo step yet: an empty note is dropped rather than kept.
    this.#fresh.add(page.id);
    this.view?.editCard(page.id);
  }

  async createFrame(point) {
    const journal = this.#journalOrWarn();
    if (!journal) return;
    const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [frameCreateData(point, game.user.id)]);
    if (!page) return;
    history.record({ kind: "create", pages: [page.toObject()] });
    this.view?.editFrame(page.id);
  }

  async #captionChanged(id, text) {
    const journal = boardJournal();
    const page = journal?.pages.get(id);
    if (!page) return;
    const words = page.system.kind !== "document";
    const name = words ? (text.trim().slice(0, 60) || page.name) : page.name;
    if (this.#fresh.delete(id)) {
      // A new note becomes real, and undoable, once it has words.
      if (!text.trim()) return journal.deleteEmbeddedDocuments("JournalEntryPage", [id]);
      await page.update({ name, system: { caption: text } });
      history.record({ kind: "create", pages: [page.toObject()] });
      return;
    }
    return this.updatePages([{ _id: id, ...(words ? { name } : {}), system: { caption: text } }]);
  }

  #editCancelled(id) {
    if (!this.#fresh.delete(id)) return;
    boardJournal()?.deleteEmbeddedDocuments("JournalEntryPage", [id]);
  }

  #journalOrWarn() {
    const journal = boardJournal();
    if (!journal) ui.notifications.warn("The Party Board isn't set up yet: a GM needs to log in once with Threadwork enabled.");
    return journal;
  }

  /* -------------------------------------------- */
  /*  Undoable edits                              */
  /* -------------------------------------------- */

  /** Change board pages as one undo step, remembering what each was so Ctrl+Z can put it back. */
  async updatePages(updates) {
    const journal = boardJournal();
    const live = updates.filter((u) => journal?.pages.has(u._id));
    if (!live.length) return;
    const changes = live.map(({ _id, ...after }) => ({ _id, before: beforeOf(journal.pages.get(_id).toObject(), after), after }));
    await journal.updateEmbeddedDocuments("JournalEntryPage", live);
    history.record({ kind: "update", changes });
  }

  /** Take a card off the board, with every string attached to it. The document itself is untouched. */
  async removeCard(id) {
    const journal = boardJournal();
    if (!journal) return;
    const pages = cascadeFor(id, journal.pages.contents.map((p) => p.toObject()), pageType("string"));
    if (!pages.length) return;
    if (pages.some((p) => !canModify(p.system, game.user))) {
      ui.notifications.warn("The GM has locked this card or a string attached to it.");
      return;
    }
    await journal.deleteEmbeddedDocuments("JournalEntryPage", pages.map((p) => p._id));
    history.record({ kind: "delete", pages });
  }

  /** Remove a string, or a frame (the cards inside a frame stay where they are). */
  async removePage(id) {
    const journal = boardJournal();
    const page = journal?.pages.get(id);
    if (!page) return;
    if (!canModify(page.system, game.user)) {
      ui.notifications.warn(`${LOCKED_NOTE}.`);
      return;
    }
    const pages = [page.toObject()];
    await journal.deleteEmbeddedDocuments("JournalEntryPage", [id]);
    history.record({ kind: "delete", pages });
  }

  /** GM only: lock an item so players cannot change it. The server enforces it through the page's ownership. */
  setLocked(id, locked) {
    const { OBSERVER, INHERIT } = CONST.DOCUMENT_OWNERSHIP_LEVELS;
    return this.updatePages([{ _id: id, system: { locked }, ownership: { default: locked ? OBSERVER : INHERIT } }]);
  }

  /** "Only me and the GM" makes you its author, so it is private to you rather than to whoever made it. */
  setVisibility(id, visibility) {
    const system = visibility === "private" ? { visibility, author: game.user.id } : { visibility };
    return this.updatePages([{ _id: id, system }]);
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
    else this.removePage(target.id);
    return true;
  }

  /* -------------------------------------------- */
  /*  Clicks on empty board                       */
  /* -------------------------------------------- */

  #onEmptyBoard(event) {
    if (!this.view) return null;
    const point = event.getLocalPosition(this);
    return this.view.itemAt(point) ? null : point;
  }

  /** Double-click empty board (or inside a frame) for a note. */
  _onClickLeft2(event) {
    const point = this.#onEmptyBoard(event);
    if (point) this.createNote("text", point);
  }

  /** Right-click empty board for things to make there. */
  _onClickRight(event) {
    const point = this.#onEmptyBoard(event);
    if (!point) return;
    showMenu({ x: event.clientX, y: event.clientY }, [
      { label: "New note here", icon: "fa-solid fa-note-sticky", action: () => this.createNote("text", point) },
      { label: "New concept here", icon: "fa-solid fa-sun", action: () => this.createNote("hub", point) },
      { label: "New frame here", icon: "fa-regular fa-square", action: () => this.createFrame(point) }
    ], { title: "Party Board" });
  }

  /* -------------------------------------------- */
  /*  Right-click menus                           */
  /* -------------------------------------------- */

  /** The menu entries every item shares: colour, who sees it, and the GM's lock. */
  #commonItems(page, { colorLabel }) {
    const s = page.system;
    const items = [];
    const pick = (visibility) => () => this.setVisibility(page.id, visibility);
    const current = s.color == null ? null : Number(s.color);
    items.push(
      { swatches: constellation.palette, current, resetLabel: colorLabel, action: (color) => this.updatePages([{ _id: page.id, system: { color: color === null ? null : hex(color) } }]) },
      "-",
      { label: "Everyone sees it", icon: "fa-solid fa-eye", current: s.visibility === "everyone", action: pick("everyone") },
      { label: game.user.isGM ? "GM only" : "GM only (hides it from you)", icon: "fa-solid fa-user-shield", current: s.visibility === "gm", action: pick("gm") },
      { label: "Only me and the GM", icon: "fa-solid fa-user-lock", current: s.visibility === "private" && s.author === game.user.id, action: pick("private") }
    );
    if (game.user.isGM) {
      items.push("-", s.locked
        ? { label: "Unlock", icon: "fa-solid fa-lock-open", action: () => this.setLocked(page.id, false) }
        : { label: "Lock so players can't change it", icon: "fa-solid fa-lock", action: () => this.setLocked(page.id, true) });
    }
    return items;
  }

  #openMenu(kind, id, at) {
    const page = boardJournal()?.pages.get(id);
    if (!page) return;
    const editable = canModify(page.system, game.user);
    if (kind === "card") return this.#cardMenu(page, at, editable);
    if (kind === "frame") return this.#frameMenu(page, at, editable);
    return this.#stringMenu(page, at, editable);
  }

  #cardMenu(page, at, editable) {
    const id = page.id;
    const s = page.system;
    const card = this.view?.cards.get(id)?.data;
    const doc = s.uuid ? resolve(s.uuid) : null;
    const items = [];
    if (doc && doc.testUserPermission?.(game.user, "LIMITED")) items.push({ label: "Open sheet", icon: "fa-solid fa-book-open", action: () => openSheet(doc) });
    if (!editable) {
      items.push({ label: LOCKED_NOTE, icon: "fa-solid fa-lock", action: () => {} });
      return showMenu(at, items, { title: card?.name ?? page.name });
    }
    if (s.kind === "document") items.push({ label: s.caption ? "Edit caption" : "Add a caption", icon: "fa-solid fa-pen", action: () => this.view?.editCard(id) });
    else {
      items.push({ label: "Edit words", icon: "fa-solid fa-pen", action: () => this.view?.editCard(id) });
      const other = s.kind === "hub" ? "text" : "hub";
      items.push({
        label: s.kind === "hub" ? "Make it a note" : "Make it a concept",
        icon: s.kind === "hub" ? "fa-solid fa-note-sticky" : "fa-solid fa-sun",
        action: () => this.updatePages([{ _id: id, system: { kind: other, w: CARD_SIZE[other].w } }])
      });
    }
    items.push("-", ...this.#commonItems(page, { colorLabel: "Default colour" }), "-");
    // "Remove from board", not "delete": the actor, item or journal itself is not touched.
    items.push({ label: s.kind === "document" ? "Remove from board" : "Delete", icon: "fa-solid fa-xmark", danger: true, action: () => this.removeCard(id) });
    showMenu(at, items, { title: card?.name || (s.kind === "hub" ? "Concept" : "Note") });
  }

  #stringMenu(page, at, editable) {
    const id = page.id;
    const s = page.system;
    const name = (cardId) => this.view?.cards.get(cardId)?.data.name || "?";
    const title = `${name(s.from)} → ${name(s.to)}`;
    if (!editable) return showMenu(at, [{ label: LOCKED_NOTE, icon: "fa-solid fa-lock", action: () => {} }], { title });
    const arrows = (value) => () => this.updatePages([{ _id: id, system: { arrows: value } }]);
    showMenu(at, [
      { label: "One way", icon: "fa-solid fa-arrow-right-long", current: s.arrows === "forward", action: arrows("forward") },
      { label: "Both ways", icon: "fa-solid fa-arrows-left-right", current: s.arrows === "both", action: arrows("both") },
      { label: "No arrow", icon: "fa-solid fa-minus", current: s.arrows === "none", action: arrows("none") },
      { label: "Reverse direction", icon: "fa-solid fa-right-left", action: () => this.updatePages([{ _id: id, system: { from: s.to, to: s.from } }]) },
      { label: "Edit label", icon: "fa-solid fa-pen", action: () => this.view?.editString(id) },
      "-",
      ...this.#commonItems(page, { colorLabel: "Its author's colour" }),
      "-",
      { label: "Delete string", icon: "fa-solid fa-trash", danger: true, action: () => this.removePage(id) }
    ], { title });
  }

  #frameMenu(page, at, editable) {
    const id = page.id;
    const title = page.system.title || "Frame";
    if (!editable) return showMenu(at, [{ label: LOCKED_NOTE, icon: "fa-solid fa-lock", action: () => {} }], { title });
    showMenu(at, [
      { label: "Rename", icon: "fa-solid fa-pen", action: () => this.view?.editFrame(id) },
      "-",
      ...this.#commonItems(page, { colorLabel: "Default colour" }),
      "-",
      { label: "Delete frame (keeps its cards)", icon: "fa-solid fa-trash", danger: true, action: () => this.removePage(id) }
    ], { title });
  }

  /* -------------------------------------------- */
  /*  Typing in the HUD                           */
  /* -------------------------------------------- */

  /**
   * Type into an input placed in the canvas HUD at board coordinates. The HUD
   * is re-aligned on every pan and zoom, so the input stays on what it edits.
   * Notes and concepts get a textarea: Enter saves, Shift+Enter starts a new line.
   */
  #editInHud({ id, x, y, value, color, fontSize, width = null, multiline = false, placeholder = "" }) {
    const hud = canvas.hud?.element;
    if (!hud) return Promise.resolve(null);
    this.#editor?.finish(this.#editor.input.value);
    const input = document.createElement(multiline ? "textarea" : "input");
    if (!multiline) input.type = "text";
    input.className = "threadwork-label-input";
    input.placeholder = placeholder;
    input.value = value;
    Object.assign(input.style, { left: `${x}px`, top: `${y}px`, fontSize: `${fontSize}px`, borderColor: hex(color) });
    if (width) input.style.width = `${width}px`;
    hud.append(input);
    const grow = () => {
      if (!multiline) return;
      input.style.height = "auto";
      input.style.height = `${input.scrollHeight + 4}px`;
    };
    grow();
    input.addEventListener("input", grow);
    input.focus();
    input.select();
    return new Promise((resolvePromise) => {
      // If anything re-renders the HUD under the input, keep the text as a draft
      // and give the item back, rather than leaving it hidden forever.
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
        if (event.key === "Enter" && !(multiline && event.shiftKey)) {
          event.preventDefault();
          editor.finish(input.value);
        } else if (event.key === "Escape") editor.finish(null);
      });
      input.addEventListener("blur", () => editor.finish(input.value));
    });
  }
}
