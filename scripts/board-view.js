// The board as PIXI objects: sky, frames, strings, flowing light, cards and
// labels, plus the motion and pointer handling that make it feel alive. It
// knows nothing about Foundry. The canvas layer and tools/preview each build
// one, hand it their own text, texture and text-editing helpers (SPEC.md 5.1),
// and listen for what the user did through the on* callbacks.
import { boxContains, centreInside, controlPoint, curveThrough, quadLength, quadPoint, snapBox, splitCurve } from "./geometry.js";
import {
  APPEAR_SECONDS, CARD_SMOOTH, CONTROL_SMOOTH, GROW_SECONDS, LEAVE_SECONDS, SETTLE_SMOOTH,
  advanceFlow, dampPoint, driftOffset, easeOut, stepClock
} from "./motion.js";
import { drawBadge, drawCardPlate, drawHandle, drawPortraitRing } from "./draw/card.js";
import { drawFramePlate, drawGrip, drawGuides } from "./draw/frame.js";
import { drawFlow, drawLabelDot, drawLabelPlate, drawString } from "./draw/string.js";
import { makeGlowTexture, starAlpha, starfieldData } from "./draw/starfield.js";

const DOUBLE_TAP_MS = 350;
const GLOW_TEXTURE_SIZE = 64;
/** How far outside a card its handles reach, and how close a dropped string must land to snap. */
const HANDLE_REACH = 18;
const SNAP_PAD = 14;
/** Alignment snapping reach, in screen pixels (so it feels the same at any zoom). */
const ALIGN_SCREEN_PX = 8;
/** Smallest card heights, by kind; notes and concepts grow taller to fit their words. */
const MIN_HEIGHT = { text: 96, hub: 150 };

export class BoardView {
  /** (cardId, {x, y}) when the user finishes dragging a card. */
  onCardMoved = null;
  /** (stringId, label) when the user commits a label. */
  onLabelChanged = null;
  /** (cardId, text) when the user commits a card's caption, or a note's or concept's words. */
  onCaptionChanged = null;
  /** (fromId, toId) => Promise<stringId|null> when the user draws a string. */
  onConnect = null;
  /** ({kind: "card"|"string"|"frame", id, clientX, clientY}) on a right-click that did not pan. */
  onContextMenu = null;
  /** (frameId, {x, y}, [{id, x, y}] of the cards it carried) when the user finishes moving a frame. */
  onFrameMoved = null;
  /** (frameId, {w, h}) when the user finishes resizing a frame. */
  onFrameResized = null;
  /** (frameId, title) when the user commits a frame's title. */
  onFrameRenamed = null;
  /** (cardId) when the user cancels editing a card's words, so a brand-new empty note can go. */
  onEditCancelled = null;

  /**
   * @param {object} options
   * @param {typeof PIXI} options.PIXI
   * @param {PIXI.Container} options.root       Container the board draws into, in board coordinates
   * @param {object} options.theme
   * @param {{x, y, width, height}} options.rect  Area the sky covers
   * @param {object[]} [options.cards]          {id, kind, name, caption, img, x, y, w, h, missing, color, visibility, locked}
   * @param {object[]} [options.strings]        {id, from, to, label, arrows, color, visibility, locked}
   * @param {object[]} [options.frames]         {id, x, y, w, h, title, color, visibility, locked}
   * @param {(text: string, style: object) => PIXI.Text} options.makeText
   * @param {(src: string) => Promise<PIXI.Texture>} options.loadTexture
   * @param {(request: object) => Promise<string|null>} [options.editText]  Resolves the new text, or null to cancel
   * @param {(item: object) => boolean} [options.canModify]  Whether this user may move or edit an item
   * @param {number|null} [options.userColor]   Colour for strings this user draws
   * @param {boolean} [options.reducedMotion]
   */
  constructor({
    PIXI, root, theme, rect, cards = [], strings = [], frames = [], makeText, loadTexture, editText,
    canModify = () => true, userColor = null, reducedMotion = false
  }) {
    Object.assign(this, { PIXI, root, theme, rect, makeText, loadTexture, editText, canModify, userColor, reducedMotion });
    this.initial = { cards, strings, frames };
    this.cards = new Map();
    this.strings = new Map();
    this.frames = new Map();
    this.stars = [];
    this.time = 0;
    this.topZ = 0;
    this.connecting = null;
    this.pendingEdit = null;
    this.guides = [];
    /** Items fading out after removal; no longer in `cards`, `strings` or `frames`. */
    this.leaving = new Set();
  }

  async build() {
    const { PIXI } = this;
    await this.#loadFonts();
    this.glowTexture = makeGlowTexture(PIXI, GLOW_TEXTURE_SIZE);
    const layer = () => this.root.addChild(new PIXI.Container());
    this.layers = { sky: layer(), frames: layer(), strings: layer(), flow: layer(), cards: layer(), guides: layer(), labels: layer() };
    this.layers.cards.sortableChildren = true;
    this.layers.frames.sortableChildren = true;
    this.guideLines = this.layers.guides.addChild(new PIXI.Graphics());
    this.#buildSky();
    for (const data of this.initial.frames) this.addFrame(data, { animate: false });
    for (const data of this.initial.cards) await this.addCard(data, { animate: false });
    for (const data of this.initial.strings) this.addString(data, { animate: false });
    this.update(0);
  }

  destroy() {
    for (const container of Object.values(this.layers ?? {})) {
      container.parent?.removeChild(container);
      container.destroy({ children: true });
    }
    this.glowTexture?.destroy(true);
    this.layers = null;
  }

  get alive() {
    return !!this.layers;
  }

  setReducedMotion(on) {
    this.reducedMotion = on;
  }

  /** The board's current zoom, from the root's world transform. */
  get #scale() {
    return this.root.worldTransform?.a || 1;
  }

  /* -------------------------------------------- */
  /*  What is where                               */
  /* -------------------------------------------- */

  /** What the pointer is over, for the Delete key: a label wins over a card, a card over a frame. */
  hovered() {
    for (const string of this.strings.values()) if (string.hover) return { kind: "string", id: string.data.id };
    for (const card of this.cards.values()) if (card.hover) return { kind: "card", id: card.data.id };
    for (const frame of this.frames.values()) if (frame.hover) return { kind: "frame", id: frame.data.id };
    return null;
  }

  /** The item at a board point, if any, so a click on empty board can be told from one on something. */
  itemAt(point) {
    for (const string of this.strings.values()) {
      const area = string.label.hitArea;
      if (area && string.label.visible && boxContains({ x: string.label.x + area.x, y: string.label.y + area.y, w: area.width, h: area.height }, point)) {
        return { kind: "string", id: string.data.id };
      }
    }
    for (const card of this.cards.values()) if (boxContains(card.box, point, 4)) return { kind: "card", id: card.data.id };
    for (const frame of this.frames.values()) {
      const { x, y } = frame.pos;
      const { w, h } = frame.data;
      if (boxContains({ x, y, w, h: this.theme.frame.titleBand }, point)) return { kind: "frame", id: frame.data.id };
      const grip = this.theme.frame.grip;
      if (boxContains({ x: x + w - grip, y: y + h - grip, w: grip, h: grip }, point)) return { kind: "frame", id: frame.data.id };
    }
    return null;
  }

  /** Open the right editor for any item by id; used to reopen drafts. */
  editItem(id, value) {
    if (this.strings.has(id)) return this.editString(id, value);
    if (this.cards.has(id)) return this.editCard(id, value);
    if (this.frames.has(id)) return this.editFrame(id, value);
    this.pendingEdit = { id, value };
  }

  /* -------------------------------------------- */
  /*  Cards                                       */
  /* -------------------------------------------- */

  async addCard(data, { animate = true } = {}) {
    if (!this.alive) return null;
    if (this.cards.has(data.id)) return this.updateCard(data);
    const { PIXI } = this;
    const container = new PIXI.Container();
    container.eventMode = "static";
    container.cursor = "grab";
    container.zIndex = ++this.topZ;
    const body = container.addChild(new PIXI.Container());
    this.layers.cards.addChild(container);
    const card = {
      data: { ...data }, container, body, handles: null, plate: null,
      target: { x: data.x, y: data.y },
      pos: { x: data.x, y: data.y, vx: 0, vy: 0 },
      clock: { time: 0, rate: 1 },
      box: { x: data.x, y: data.y, w: data.w, h: data.h },
      appear: animate && !this.reducedMotion ? 0 : 1,
      hover: false, dragging: null, carried: false, holds: 0, drawToken: 0, lastTap: 0, moved: false, editing: false
    };
    this.cards.set(data.id, card);
    this.#layoutCard(card);
    this.#wireCard(card);
    await this.#drawCardBody(card);
    this.#takePendingEdit(data.id);
    return card;
  }

  async updateCard(data) {
    const card = this.cards.get(data.id);
    if (!card) return this.addCard(data);
    const before = card.data;
    // A note's height is worked out locally from its words, so keep ours.
    const h = card.data.kind === "document" ? data.h : before.h;
    card.data = { ...before, ...data, h };
    // Your own drag wins over an echo of an older position.
    if (!card.dragging && !card.carried) card.target = { x: card.data.x, y: card.data.y };
    const looks = ["kind", "name", "img", "caption", "missing", "w", "color", "visibility", "locked"].some((k) => before[k] !== card.data[k]);
    if (looks) {
      this.#layoutCard(card);
      await this.#drawCardBody(card);
    }
    return card;
  }

  removeCard(id, { animate = true } = {}) {
    const card = this.cards.get(id);
    if (!card) return;
    if (this.connecting?.from === card) this.#endConnect(null);
    this.cards.delete(id);
    card.container.eventMode = "none";
    if (animate && !this.reducedMotion) {
      card.leavingKind = "card";
      this.leaving.add(card);
    } else this.#destroyCard(card);
  }

  /** Open the editor on a card's caption, or on a note's or concept's words. */
  editCard(id, value) {
    const card = this.cards.get(id);
    if (!card) {
      this.pendingEdit = { id, value };
      return;
    }
    this.#editCard(card, value);
  }

  #destroyCard(card) {
    card.container.parent?.removeChild(card.container);
    card.container.destroy({ children: true });
  }

  /** Size-dependent parts: hit area, pivot and handles. */
  #layoutCard(card) {
    const { PIXI } = this;
    const { w, h } = card.data;
    card.container.pivot.set(w / 2, h / 2);
    card.container.hitArea = new PIXI.Rectangle(-HANDLE_REACH, -HANDLE_REACH, w + HANDLE_REACH * 2, h + HANDLE_REACH * 2);
    card.handles?.destroy({ children: true });
    card.handles = card.container.addChild(new PIXI.Container());
    card.handles.visible = false;
    for (const [hx, hy] of [[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) {
      const handle = card.handles.addChild(new PIXI.Graphics());
      drawHandle(handle, this.theme, this.userColor ?? this.theme.string.color);
      handle.position.set(hx, hy);
      handle.eventMode = "static";
      handle.cursor = "crosshair";
      handle.hitArea = new PIXI.Circle(0, 0, HANDLE_REACH);
      handle.on("pointerdown", (event) => this.#startConnect(card, handle, event));
    }
  }

  /** Everything inside the card. Redrawn whenever its data or the document behind it changes. */
  async #drawCardBody(card) {
    const token = ++card.drawToken;
    const texture = card.data.kind === "document" && card.data.img ? await this.loadTexture(card.data.img).catch(() => null) : null;
    // A newer redraw started while this texture loaded, or the board went away.
    if (token !== card.drawToken || !this.alive || card.body.destroyed) return;
    for (const child of card.body.removeChildren()) child.destroy({ children: true });
    card.plate = card.body.addChild(new this.PIXI.Graphics());
    if (card.data.kind === "document") this.#drawDocumentCard(card, texture);
    else this.#drawWordsCard(card);
    this.#drawPlate(card);
    this.#drawBadges(card.body, card.data, card.data.w);
    card.body.alpha = card.data.missing ? 0.5 : 1;
  }

  #drawPlate(card) {
    if (!card.plate || card.plate.destroyed) return;
    drawCardPlate(card.plate, card.data.w, card.data.h, this.theme, { hover: card.hover, color: card.data.color, hub: card.data.kind === "hub" });
  }

  #drawDocumentCard(card, texture) {
    const { PIXI, theme } = this;
    const c = theme.card;
    const { data, body } = card;
    const r = c.portrait / 2;
    const px = 14 + r;
    const py = data.h / 2;
    drawPortraitRing(body.addChild(new PIXI.Graphics()), px, py, r, theme);
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.position.set(px, py);
      sprite.scale.set((r * 2) / Math.min(texture.width, texture.height));
      const mask = body.addChild(new PIXI.Graphics());
      mask.beginFill(0xffffff, 1);
      mask.drawCircle(px, py, r - 2);
      mask.endFill();
      sprite.mask = mask;
      body.addChild(sprite);
    }
    const textX = 14 + c.portrait + 22;
    const name = body.addChild(this.makeText(data.name ?? "", c.name));
    name.position.set(textX, 20);
    const words = data.missing ? "(no longer exists)" : (data.caption ?? "");
    const caption = body.addChild(this.makeText(words, c.caption));
    caption.position.set(textX, 72);
    card.captionText = caption;
  }

  /** A note or a concept: its words, wrapped to the card, which grows to fit them. */
  #drawWordsCard(card) {
    const { theme } = this;
    const hub = card.data.kind === "hub";
    const style = hub ? theme.hub : theme.note;
    const { w } = card.data;
    const empty = !card.data.caption;
    const text = this.makeText(empty ? (hub ? "A shared idea" : "Double-click to write") : card.data.caption, {
      ...style.text,
      wordWrapWidth: w - style.padX * 2,
      fill: empty ? theme.note.placeholder : style.text.fill
    });
    const h = Math.max(MIN_HEIGHT[card.data.kind], Math.ceil(text.height + style.padY * 2));
    if (h !== card.data.h) {
      card.data.h = h;
      this.#layoutCard(card);
    }
    if (hub) {
      text.anchor.set(0.5);
      text.position.set(w / 2, h / 2);
    } else text.position.set(style.padX, style.padY);
    card.body.addChild(text);
    card.captionText = text;
  }

  /** Small pills along the top edge for anything not simply public and open. */
  #drawBadges(parent, data, width) {
    const b = this.theme.badge;
    const words = [];
    if (data.locked) words.push(["LOCKED", b.locked]);
    if (data.visibility === "gm") words.push(["GM ONLY", b.gm]);
    if (data.visibility === "private") words.push(["PRIVATE", b.private]);
    let right = width - 14;
    for (const [word, color] of words) {
      const text = this.makeText(word, b.text);
      const pillW = Math.ceil(text.width + 18);
      const pill = parent.addChild(new this.PIXI.Graphics());
      drawBadge(pill, pillW, 24, color);
      pill.position.set(right - pillW, -12);
      text.position.set(right - pillW + 9, -12 + (24 - text.height) / 2);
      parent.addChild(text);
      right -= pillW + 6;
    }
  }

  #wireCard(card) {
    const { container } = card;
    this.#wireContextMenu(container, "card", () => card.data.id);
    container.on("pointerenter", () => this.#setHover(card, true));
    container.on("pointerleave", () => this.#setHover(card, false));
    container.on("pointertap", () => {
      if (card.moved) return;
      const now = performance.now();
      if (now - card.lastTap < DOUBLE_TAP_MS) this.#editCard(card);
      card.lastTap = now;
    });
    container.on("pointerdown", (event) => {
      if (event.button !== 0) return;
      card.moved = false;
      if (!this.canModify(card.data)) return;
      event.stopPropagation();
      const p = event.getLocalPosition(this.root);
      const start = { ...card.target };
      card.dragging = { dx: p.x - card.target.x, dy: p.y - card.target.y };
      container.cursor = "grabbing";
      container.zIndex = ++this.topZ;
      const move = (e) => {
        const q = e.getLocalPosition(this.root);
        let x = q.x - card.dragging.dx;
        let y = q.y - card.dragging.dy;
        this.guides = [];
        // Hold Alt to place a card freely.
        if (!e.altKey) {
          const others = [...this.cards.values()].filter((c) => c !== card).map((c) => ({ x: c.target.x, y: c.target.y, w: c.data.w, h: c.data.h }));
          const snap = snapBox({ x, y, w: card.data.w, h: card.data.h }, others, ALIGN_SCREEN_PX / this.#scale);
          x += snap.dx;
          y += snap.dy;
          this.guides = snap.guides;
        }
        card.target.x = x;
        card.target.y = y;
        if (Math.hypot(x - start.x, y - start.y) > 2) card.moved = true;
      };
      const end = () => {
        container.off("globalpointermove", move);
        container.off("pointerup", end);
        container.off("pointerupoutside", end);
        card.dragging = null;
        this.guides = [];
        container.cursor = "grab";
        if (card.moved) this.onCardMoved?.(card.data.id, { x: Math.round(card.target.x), y: Math.round(card.target.y) });
      };
      container.on("globalpointermove", move);
      container.on("pointerup", end);
      container.on("pointerupoutside", end);
    });
  }

  #setHover(card, on) {
    if (card.hover === on) return;
    card.hover = on;
    this.#drawPlate(card);
  }

  async #editCard(card, initial) {
    if (card.editing || !this.editText || !this.canModify(card.data) || card.data.missing) return;
    card.editing = true;
    card.holds += 1;
    const document = card.data.kind === "document";
    const style = card.data.kind === "hub" ? this.theme.hub : (document ? this.theme.card.caption : this.theme.note);
    const fontSize = (style.text ?? style).fontSize;
    const { box } = card;
    const value = await this.editText({
      id: card.data.id,
      kind: "card",
      x: box.x + box.w / 2,
      // A document card's caption row; a note or concept is edited over its whole face.
      y: document ? box.y + 72 + this.theme.card.caption.fontSize / 2 : box.y + box.h / 2,
      width: box.w - 24,
      value: initial ?? card.data.caption ?? "",
      multiline: !document,
      placeholder: document ? "Add a caption" : (card.data.kind === "hub" ? "Name the shared idea" : "Write a note"),
      color: card.data.color ?? this.theme.card.border,
      fontSize
    });
    card.editing = false;
    card.holds = Math.max(0, card.holds - 1);
    if (!this.alive || !this.cards.has(card.data.id)) return;
    if (value === null) {
      this.onEditCancelled?.(card.data.id);
      return;
    }
    if (value !== (card.data.caption ?? "")) {
      card.data.caption = value;
      await this.#drawCardBody(card);
    }
    this.onCaptionChanged?.(card.data.id, value);
  }

  /* -------------------------------------------- */
  /*  Frames                                      */
  /* -------------------------------------------- */

  addFrame(data, { animate = true } = {}) {
    if (!this.alive) return null;
    if (this.frames.has(data.id)) return this.updateFrame(data);
    const { PIXI } = this;
    const container = this.layers.frames.addChild(new PIXI.Container());
    // Only the title band and the grip take the pointer: clicks inside a frame reach the board.
    container.eventMode = "passive";
    container.zIndex = ++this.topZ;
    const plate = container.addChild(new PIXI.Graphics());
    const title = container.addChild(this.makeText("", this.theme.frame.title));
    const band = container.addChild(new PIXI.Container());
    band.eventMode = "static";
    band.cursor = "grab";
    const grip = container.addChild(new PIXI.Graphics());
    grip.eventMode = "static";
    grip.cursor = "nwse-resize";
    const badges = container.addChild(new PIXI.Container());
    const frame = {
      data: { ...data }, container, plate, title, band, grip, badges,
      target: { x: data.x, y: data.y },
      pos: { x: data.x, y: data.y, vx: 0, vy: 0 },
      appear: animate && !this.reducedMotion ? 0 : 1,
      hover: false, dragging: null, resizing: false, lastTap: 0, moved: false, editing: false
    };
    this.frames.set(data.id, frame);
    this.#layoutFrame(frame);
    this.#wireFrame(frame);
    this.#takePendingEdit(data.id);
    return frame;
  }

  updateFrame(data) {
    const frame = this.frames.get(data.id);
    if (!frame) return this.addFrame(data);
    const before = frame.data;
    frame.data = { ...before, ...data };
    if (frame.resizing) Object.assign(frame.data, { w: before.w, h: before.h });
    if (!frame.dragging) frame.target = { x: frame.data.x, y: frame.data.y };
    if (["w", "h", "title", "color", "visibility", "locked"].some((k) => before[k] !== frame.data[k])) this.#layoutFrame(frame);
    return frame;
  }

  removeFrame(id, { animate = true } = {}) {
    const frame = this.frames.get(id);
    if (!frame) return;
    this.frames.delete(id);
    frame.container.eventMode = "none";
    frame.band.eventMode = "none";
    frame.grip.eventMode = "none";
    if (animate && !this.reducedMotion) {
      frame.leavingKind = "frame";
      this.leaving.add(frame);
    } else this.#destroyFrame(frame);
  }

  editFrame(id, value) {
    const frame = this.frames.get(id);
    if (!frame) {
      this.pendingEdit = { id, value };
      return;
    }
    this.#editFrame(frame, value);
  }

  #destroyFrame(frame) {
    frame.container.parent?.removeChild(frame.container);
    frame.container.destroy({ children: true });
  }

  #layoutFrame(frame) {
    const { PIXI, theme } = this;
    const f = theme.frame;
    const { w, h, color } = frame.data;
    drawFramePlate(frame.plate, w, h, theme, { hover: frame.hover, color });
    frame.title.text = frame.data.title || "Untitled frame";
    frame.title.position.set(24, (f.titleBand - frame.title.height) / 2);
    frame.band.hitArea = new PIXI.Rectangle(0, 0, w, f.titleBand);
    drawGrip(frame.grip, theme, color);
    frame.grip.position.set(w - f.grip, h - f.grip);
    frame.grip.hitArea = new PIXI.Rectangle(0, 0, f.grip, f.grip);
    for (const child of frame.badges.removeChildren()) child.destroy({ children: true });
    this.#drawBadges(frame.badges, frame.data, w);
  }

  /** The cards a frame carries: those whose centres are inside it, and that this user may move. */
  #membersOf(frame) {
    const box = { x: frame.target.x, y: frame.target.y, w: frame.data.w, h: frame.data.h };
    return [...this.cards.values()]
      .filter((card) => this.canModify(card.data) && centreInside({ x: card.target.x, y: card.target.y, w: card.data.w, h: card.data.h }, box))
      .map((card) => ({ card, x: card.target.x, y: card.target.y }));
  }

  #wireFrame(frame) {
    const { band, grip } = frame;
    this.#wireContextMenu(band, "frame", () => frame.data.id);
    const hover = (on) => {
      frame.hover = on;
      drawFramePlate(frame.plate, frame.data.w, frame.data.h, this.theme, { hover: on, color: frame.data.color });
    };
    band.on("pointerenter", () => hover(true));
    band.on("pointerleave", () => hover(false));
    band.on("pointertap", () => {
      if (frame.moved) return;
      const now = performance.now();
      if (now - frame.lastTap < DOUBLE_TAP_MS) this.#editFrame(frame);
      frame.lastTap = now;
    });
    band.on("pointerdown", (event) => {
      if (event.button !== 0) return;
      frame.moved = false;
      if (!this.canModify(frame.data)) return;
      event.stopPropagation();
      const p = event.getLocalPosition(this.root);
      const start = { ...frame.target };
      const members = this.#membersOf(frame);
      for (const m of members) m.card.carried = true;
      frame.dragging = { dx: p.x - start.x, dy: p.y - start.y, members };
      frame.container.zIndex = ++this.topZ;
      band.cursor = "grabbing";
      const move = (e) => {
        const q = e.getLocalPosition(this.root);
        frame.target.x = q.x - frame.dragging.dx;
        frame.target.y = q.y - frame.dragging.dy;
        const dx = frame.target.x - start.x;
        const dy = frame.target.y - start.y;
        for (const m of members) {
          m.card.target.x = m.x + dx;
          m.card.target.y = m.y + dy;
        }
        if (Math.hypot(dx, dy) > 2) frame.moved = true;
      };
      const end = () => {
        band.off("globalpointermove", move);
        band.off("pointerup", end);
        band.off("pointerupoutside", end);
        frame.dragging = null;
        band.cursor = "grab";
        for (const m of members) m.card.carried = false;
        if (!frame.moved) return;
        const carried = members.map((m) => ({ id: m.card.data.id, x: Math.round(m.card.target.x), y: Math.round(m.card.target.y) }));
        this.onFrameMoved?.(frame.data.id, { x: Math.round(frame.target.x), y: Math.round(frame.target.y) }, carried);
      };
      band.on("globalpointermove", move);
      band.on("pointerup", end);
      band.on("pointerupoutside", end);
    });
    grip.on("pointerdown", (event) => {
      if (event.button !== 0 || !this.canModify(frame.data)) return;
      event.stopPropagation();
      const f = this.theme.frame;
      frame.resizing = true;
      const move = (e) => {
        const q = e.getLocalPosition(this.root);
        frame.data.w = Math.max(f.minW, Math.round(q.x - frame.pos.x));
        frame.data.h = Math.max(f.minH, Math.round(q.y - frame.pos.y));
        this.#layoutFrame(frame);
      };
      const end = () => {
        grip.off("globalpointermove", move);
        grip.off("pointerup", end);
        grip.off("pointerupoutside", end);
        frame.resizing = false;
        this.onFrameResized?.(frame.data.id, { w: frame.data.w, h: frame.data.h });
      };
      grip.on("globalpointermove", move);
      grip.on("pointerup", end);
      grip.on("pointerupoutside", end);
    });
  }

  async #editFrame(frame, initial) {
    if (frame.editing || !this.editText || !this.canModify(frame.data)) return;
    frame.editing = true;
    frame.title.visible = false;
    const f = this.theme.frame;
    const value = await this.editText({
      id: frame.data.id,
      kind: "frame",
      x: frame.pos.x + Math.min(frame.data.w - 48, 520) / 2 + 24,
      y: frame.pos.y + f.titleBand / 2,
      width: Math.min(frame.data.w - 48, 520),
      value: initial ?? frame.data.title ?? "",
      placeholder: "Name this frame",
      color: frame.data.color ?? f.color,
      fontSize: f.title.fontSize
    });
    frame.editing = false;
    if (!this.alive || !this.frames.has(frame.data.id)) return;
    frame.title.visible = true;
    if (value === null || value === frame.data.title) return;
    frame.data.title = value;
    this.#layoutFrame(frame);
    this.onFrameRenamed?.(frame.data.id, value);
  }

  /* -------------------------------------------- */
  /*  Drawing a new string                        */
  /* -------------------------------------------- */

  #startConnect(card, handle, event) {
    if (event.button !== 0 || !this.onConnect) return;
    event.stopPropagation();
    const g = this.layers.strings.addChild(new this.PIXI.Graphics());
    this.connecting = { from: card, handle, point: event.getLocalPosition(this.root), target: null, g };
    card.holds += 1;
    const move = (e) => {
      if (!this.connecting) return;
      this.connecting.point = e.getLocalPosition(this.root);
      this.connecting.target = this.#cardAt(this.connecting.point, card);
    };
    const end = () => {
      handle.off("globalpointermove", move);
      handle.off("pointerup", end);
      handle.off("pointerupoutside", end);
      this.#endConnect(this.connecting?.target ?? null);
    };
    handle.on("globalpointermove", move);
    handle.on("pointerup", end);
    handle.on("pointerupoutside", end);
  }

  async #endConnect(target) {
    const connecting = this.connecting;
    if (!connecting) return;
    this.connecting = null;
    connecting.g.destroy();
    connecting.from.holds = Math.max(0, connecting.from.holds - 1);
    if (!target || !this.onConnect) return;
    const id = await this.onConnect(connecting.from.data.id, target.data.id);
    if (id) this.editString(id);
  }

  /** The card under a board point, ignoring `except`; the topmost wins. */
  #cardAt(point, except) {
    let best = null;
    for (const card of this.cards.values()) {
      if (card === except || !boxContains(card.box, point, SNAP_PAD)) continue;
      if (!best || card.container.zIndex > best.container.zIndex) best = card;
    }
    return best;
  }

  /* -------------------------------------------- */
  /*  Strings                                     */
  /* -------------------------------------------- */

  addString(data, { animate = true } = {}) {
    if (!this.alive) return null;
    if (this.strings.has(data.id)) return this.updateString(data);
    const { PIXI } = this;
    const flow = this.layers.flow.addChild(new PIXI.Graphics());
    flow.blendMode = PIXI.BLEND_MODES.ADD;
    const label = this.layers.labels.addChild(new PIXI.Container());
    label.eventMode = "static";
    label.cursor = "text";
    const plate = label.addChild(new PIXI.Graphics());
    const text = label.addChild(this.makeText(data.label ?? "", this.theme.label.text));
    text.anchor.set(0.5);
    const badges = label.addChild(new PIXI.Container());
    const string = {
      data: { ...data }, index: 0, count: 1, flip: data.from > data.to,
      line: this.layers.strings.addChild(new PIXI.Graphics()),
      flow, label, plate, text, badges, control: null, phase: 0, lastTap: 0, editing: false, hover: false,
      grow: animate && !this.reducedMotion ? 0 : 1
    };
    this.strings.set(data.id, string);
    this.#reindexStrings();
    this.#layoutLabel(string);
    this.#wireLabel(string);
    this.#takePendingEdit(data.id);
    return string;
  }

  updateString(data) {
    const string = this.strings.get(data.id);
    if (!string) return this.addString(data);
    const before = string.data;
    string.data = { ...before, ...data };
    if (before.from !== string.data.from || before.to !== string.data.to) {
      string.flip = string.data.from > string.data.to;
      this.#reindexStrings();
    }
    if (!string.editing && before.label !== string.data.label) string.text.text = string.data.label ?? "";
    this.#layoutLabel(string);
    return string;
  }

  removeString(id, { animate = true } = {}) {
    const string = this.strings.get(id);
    if (!string) return;
    this.strings.delete(id);
    string.label.eventMode = "none";
    this.#reindexStrings();
    // It draws itself back toward its start; with nothing drawn yet there is nothing to retract.
    if (animate && !this.reducedMotion && string.lastCurve) {
      string.leavingKind = "string";
      this.leaving.add(string);
    } else this.#destroyString(string);
  }

  #destroyString(string) {
    for (const part of [string.line, string.flow, string.label]) {
      part.parent?.removeChild(part);
      part.destroy({ children: true });
    }
  }

  /**
   * Open the label editor on a string. If the string has not arrived yet (it
   * was just created and its page is still on the way), open it when it does.
   */
  editString(id, value) {
    const string = this.strings.get(id);
    if (!string) {
      this.pendingEdit = { id, value };
      return;
    }
    this.#editLabel(string, value);
  }

  #takePendingEdit(id) {
    if (this.pendingEdit?.id !== id) return;
    const { value } = this.pendingEdit;
    this.pendingEdit = null;
    this.editItem(id, value);
  }

  /** Strings sharing a pair of cards fan out, so each needs its place among its pair. */
  #reindexStrings() {
    const key = (s) => [s.data.from, s.data.to].sort().join("|");
    const groups = new Map();
    for (const string of this.strings.values()) {
      const k = key(string);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(string);
    }
    for (const group of groups.values()) {
      group.forEach((string, index) => {
        string.index = index;
        string.count = group.length;
      });
    }
  }

  #layoutLabel(string) {
    const l = this.theme.label;
    const empty = !string.data.label;
    const w = empty ? 16 : Math.max(l.minWidth, string.text.width + l.padX * 2);
    const h = empty ? 16 : Math.max(l.text.fontSize, string.text.height) + l.padY * 2;
    if (empty) drawLabelDot(string.plate, this.#colorOf(string));
    else drawLabelPlate(string.plate, w, h, this.theme, this.#colorOf(string));
    // An empty label is a small dot, but still an easy target to double-click or right-click.
    const reach = empty ? 14 : 0;
    string.label.hitArea = new this.PIXI.Rectangle(-w / 2 - reach, -h / 2 - reach, w + reach * 2, h + reach * 2);
    for (const child of string.badges.removeChildren()) child.destroy({ children: true });
    this.#drawBadges(string.badges, string.data, w);
    string.badges.position.set(-w / 2, -h / 2);
    // Anything not public is drawn a little fainter, so it reads as set apart.
    string.line.alpha = string.data.visibility && string.data.visibility !== "everyone" ? 0.6 : 1;
  }

  #wireLabel(string) {
    const { label } = string;
    this.#wireContextMenu(label, "string", () => string.data.id);
    // Hovering a label holds both its cards still, so it does not slide away mid-read.
    label.on("pointerenter", () => { string.hover = true; this.#hold(string, 1); });
    label.on("pointerleave", () => { string.hover = false; this.#hold(string, -1); });
    label.on("pointerdown", (event) => event.stopPropagation());
    label.on("pointertap", () => {
      const now = performance.now();
      if (now - string.lastTap < DOUBLE_TAP_MS) this.#editLabel(string);
      string.lastTap = now;
    });
  }

  #hold(string, delta) {
    for (const id of [string.data.from, string.data.to]) {
      const card = this.cards.get(id);
      if (card) card.holds = Math.max(0, card.holds + delta);
    }
  }

  async #editLabel(string, initial) {
    if (string.editing || !this.editText || !this.canModify(string.data)) return;
    string.editing = true;
    this.#hold(string, 1);
    string.label.visible = false;
    const value = await this.editText({
      id: string.data.id,
      kind: "string",
      x: string.label.position.x,
      y: string.label.position.y,
      value: initial ?? string.data.label ?? "",
      placeholder: "Say how they're connected",
      color: this.#colorOf(string),
      fontSize: this.theme.label.text.fontSize
    });
    string.editing = false;
    this.#hold(string, -1);
    if (!this.alive || !this.strings.has(string.data.id)) return; // Torn down or deleted while open.
    string.label.visible = true;
    if (value === null || value === string.data.label) return;
    string.data.label = value;
    string.text.text = value;
    this.#layoutLabel(string);
    this.onLabelChanged?.(string.data.id, value);
  }

  #colorOf(string) {
    return string.data.color ?? this.theme.string.color;
  }

  /**
   * A right-click opens the menu only if the pointer did not move, because a
   * right-drag pans the board. The press is not stopped, so panning from on
   * top of a card still works.
   */
  #wireContextMenu(target, kind, id) {
    let pressed = null;
    target.on("rightdown", (event) => { pressed = { x: event.global.x, y: event.global.y }; });
    target.on("rightclick", (event) => {
      const still = pressed && Math.hypot(event.global.x - pressed.x, event.global.y - pressed.y) < 6;
      pressed = null;
      if (still) this.onContextMenu?.({ kind, id: id(), clientX: event.clientX, clientY: event.clientY });
    });
  }

  /* -------------------------------------------- */
  /*  Animation                                   */
  /* -------------------------------------------- */

  /** Advance every animation by `dt` seconds and redraw what moved. */
  update(dt) {
    if (!this.alive) return;
    this.time += dt;
    const reduced = this.reducedMotion;

    if (!reduced) {
      for (const star of this.stars) if (star.data.twinkle) star.sprite.alpha = starAlpha(star.data, this.time);
    }

    for (const frame of this.frames.values()) {
      const smooth = frame.dragging ? CARD_SMOOTH : SETTLE_SMOOTH;
      dampPoint(frame.pos, frame.target, reduced ? smooth / 3 : smooth, dt);
      frame.appear = Math.min(1, frame.appear + dt / APPEAR_SECONDS);
      frame.container.alpha = easeOut(frame.appear);
      frame.container.position.set(frame.pos.x, frame.pos.y);
    }

    for (const card of this.cards.values()) {
      const still = card.hover || card.dragging || card.carried || card.holds > 0;
      stepClock(card.clock, dt, !still && !reduced);
      const smooth = card.dragging || card.carried ? CARD_SMOOTH : SETTLE_SMOOTH;
      dampPoint(card.pos, card.target, reduced ? smooth / 3 : smooth, dt);
      const drift = reduced ? { x: 0, y: 0 } : driftOffset(card.data.id, card.clock.time);
      card.box = { x: card.pos.x + drift.x, y: card.pos.y + drift.y, w: card.data.w, h: card.data.h };
      card.appear = Math.min(1, card.appear + dt / APPEAR_SECONDS);
      const shown = easeOut(card.appear);
      card.container.alpha = shown;
      card.container.scale.set(0.9 + 0.1 * shown);
      card.container.position.set(card.box.x + card.data.w / 2, card.box.y + card.data.h / 2);
      card.handles.visible = card.hover || this.connecting?.from === card;
    }

    for (const string of this.strings.values()) this.#updateString(string, dt, reduced);
    for (const item of this.leaving) this.#updateLeaving(item, dt);
    drawGuides(this.guideLines, this.guides, this.theme, this.#scale);
    if (this.connecting) this.#drawConnecting();
  }

  /** A removed card or frame shrinks and fades; a removed string draws itself back toward its start. */
  #updateLeaving(item, dt) {
    if (item.leavingKind !== "string") {
      item.appear -= dt / LEAVE_SECONDS;
      const shown = easeOut(Math.max(0, item.appear));
      item.container.alpha = shown;
      if (item.leavingKind === "card") item.container.scale.set(0.85 + 0.15 * shown);
      if (item.appear <= 0) {
        this.leaving.delete(item);
        if (item.leavingKind === "card") this.#destroyCard(item);
        else this.#destroyFrame(item);
      }
      return;
    }
    item.grow -= dt / LEAVE_SECONDS;
    const shown = easeOut(Math.max(0, item.grow));
    drawString(item.line, splitCurve(item.lastCurve, Math.max(0.001, shown)), this.theme, { color: this.#colorOf(item), arrows: item.data.arrows });
    item.flow.clear();
    item.label.alpha = shown;
    if (item.grow <= 0) {
      this.leaving.delete(item);
      this.#destroyString(item);
    }
  }

  #updateString(string, dt, reduced) {
    const from = this.cards.get(string.data.from)?.box;
    const to = this.cards.get(string.data.to)?.box;
    if (!from || !to) {
      // A card was just removed and this string's own removal is on its way:
      // hold its last shape rather than blinking out a moment early.
      if (!string.lastCurve) {
        string.line.clear();
        string.label.visible = false;
      }
      string.flow.clear();
      return;
    }
    const target = controlPoint(from, to, string);
    string.control ??= { ...target, vx: 0, vy: 0 };
    dampPoint(string.control, target, reduced ? CARD_SMOOTH / 3 : CONTROL_SMOOTH, dt);
    const full = curveThrough(from, to, string.control, this.theme.string.pad);
    string.lastCurve = full;
    string.grow = Math.min(1, string.grow + dt / GROW_SECONDS);
    const grown = easeOut(string.grow);
    const curve = grown < 1 ? splitCurve(full, grown) : full;
    const color = this.#colorOf(string);
    drawString(string.line, curve, this.theme, { color, arrows: string.data.arrows });
    if (reduced || grown < 1) string.flow.clear();
    else {
      const length = quadLength(curve);
      string.phase = advanceFlow(string.phase, dt, this.theme.string.flow.speed, length);
      drawFlow(string.flow, curve, this.theme, string.phase, length, { both: string.data.arrows === "none" });
    }
    const mid = quadPoint(full, 0.5);
    string.label.position.set(mid.x, mid.y);
    string.label.visible = !string.editing;
    string.label.alpha = grown < 1 ? 0 : 1;
  }

  /** The string being drawn: from its card to the pointer, or to the card it will snap to. */
  #drawConnecting() {
    const { from, point, target, g } = this.connecting;
    const to = target?.box ?? { x: point.x - 1, y: point.y - 1, w: 2, h: 2 };
    const control = controlPoint(from.box, to);
    const curve = curveThrough(from.box, to, control, this.theme.string.pad);
    drawString(g, curve, this.theme, { color: this.userColor ?? this.theme.string.color, arrows: "forward" });
    g.alpha = target ? 1 : 0.7;
  }

  /* -------------------------------------------- */
  /*  Setup                                       */
  /* -------------------------------------------- */

  /**
   * PIXI draws text with whatever face the browser has ready, so a weight that
   * has not loaded yet silently falls back to a serif. Load every face used first.
   */
  async #loadFonts() {
    const t = this.theme;
    const styles = [t.card.name, t.card.caption, t.label.text, t.hub.text, t.note.text, t.frame.title, t.badge.text];
    const faces = styles.map((s) => `${s.fontWeight ?? "400"} ${s.fontSize}px ${s.fontFamily}`);
    await Promise.all(faces.map((face) => globalThis.document?.fonts?.load(face).catch(() => null)));
  }

  #buildSky() {
    const { PIXI, theme, rect } = this;
    // Nebulae are far bigger than the board; keep them inside it.
    const clip = this.layers.sky.addChild(new PIXI.Graphics());
    clip.beginFill(0xffffff, 1);
    clip.drawRect(rect.x, rect.y, rect.width, rect.height);
    clip.endFill();
    this.layers.sky.mask = clip;
    const backdrop = this.layers.sky.addChild(new PIXI.Graphics());
    backdrop.beginFill(theme.background, 1);
    backdrop.drawRect(rect.x, rect.y, rect.width, rect.height);
    backdrop.endFill();
    const { stars, nebulae } = starfieldData(rect, theme);
    for (const n of nebulae) {
      const sprite = this.layers.sky.addChild(new PIXI.Sprite(this.glowTexture));
      sprite.anchor.set(0.5);
      sprite.position.set(n.x, n.y);
      sprite.width = sprite.height = n.r * 2;
      sprite.tint = n.color;
      sprite.alpha = n.alpha;
    }
    for (const data of stars) {
      const sprite = this.layers.sky.addChild(new PIXI.Sprite(this.glowTexture));
      sprite.anchor.set(0.5);
      sprite.position.set(data.x, data.y);
      // The dot's bright core is about a seventh of the texture.
      sprite.width = sprite.height = data.r * 7;
      sprite.tint = data.color;
      sprite.alpha = data.base;
      this.stars.push({ data, sprite });
    }
  }
}
