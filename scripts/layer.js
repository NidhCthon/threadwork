// The canvas layer that hosts the board on the board scene (SPEC.md 5.1). All
// drawing and motion live in BoardView; this file connects it to Foundry: the
// board journal's pages, the ticker, PreciseText, textures, the HUD for typing,
// and the scene controls.
import { MODULE_ID } from "./constants.js";
import { BoardView } from "./board-view.js";
import { isBoardScene } from "./board-scene.js";
import { cardViewData, isBoardJournal, pageType, stringCreateData, stringViewData } from "./data.js";
import { prefersReducedMotion } from "./motion.js";
import { goBack, goToBoard } from "./navigation.js";
import { constellation } from "./themes/constellation.js";

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
    view.onCardMoved = (id, { x, y }) => journal?.pages.get(id)?.update({ system: { x, y } });
    view.onLabelChanged = (id, label) => journal?.pages.get(id)?.update({ system: { label } });
    view.onConnect = (from, to) => this.#connect(journal, from, to);
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
    return page?.id ?? null;
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
