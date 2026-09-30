// The board as PIXI objects: sky, strings, flowing light, cards and labels,
// plus the motion and pointer handling that make it feel alive. It knows
// nothing about Foundry. The canvas layer and tools/preview each build one,
// hand it their own text, texture and text-editing helpers (SPEC.md 5.1), and
// listen for what the user did through the on* callbacks.
import { boxContains, controlPoint, curveThrough, quadLength, quadPoint, splitCurve } from "./geometry.js";
import {
  APPEAR_SECONDS, CARD_SMOOTH, CONTROL_SMOOTH, GROW_SECONDS, LEAVE_SECONDS, SETTLE_SMOOTH,
  advanceFlow, dampPoint, driftOffset, easeOut, stepClock
} from "./motion.js";
import { drawCardPlate, drawHandle, drawPortraitRing } from "./draw/card.js";
import { drawFlow, drawLabelPlate, drawString } from "./draw/string.js";
import { makeGlowTexture, starAlpha, starfieldData } from "./draw/starfield.js";

const DOUBLE_TAP_MS = 350;
const GLOW_TEXTURE_SIZE = 64;
/** How far outside a card its handles reach, and how close a dropped string must land to snap. */
const HANDLE_REACH = 18;
const SNAP_PAD = 14;

export class BoardView {
  /** Called when the user finishes dragging a card: (cardId, {x, y}). */
  onCardMoved = null;
  /** Called when the user commits a label: (stringId, label). */
  onLabelChanged = null;
  /** Called when the user draws a string between two cards: (fromId, toId) => Promise<stringId|null>. */
  onConnect = null;
  /** Called on a right-click that did not pan: ({kind: "card"|"string", id, clientX, clientY}). */
  onContextMenu = null;

  /**
   * @param {object} options
   * @param {typeof PIXI} options.PIXI
   * @param {PIXI.Container} options.root       Container the board draws into, in board coordinates
   * @param {object} options.theme
   * @param {{x, y, width, height}} options.rect  Area the sky covers
   * @param {object[]} [options.cards]          {id, name, caption, img, x, y, w, h, missing}
   * @param {object[]} [options.strings]        {id, from, to, label, arrows, color}
   * @param {(text: string, style: object) => PIXI.Text} options.makeText
   * @param {(src: string) => Promise<PIXI.Texture>} options.loadTexture
   * @param {(request: object) => Promise<string|null>} [options.editText]  Resolves the new text, or null to cancel
   * @param {number|null} [options.userColor]   Colour for strings this user draws
   * @param {boolean} [options.reducedMotion]
   */
  constructor({ PIXI, root, theme, rect, cards = [], strings = [], makeText, loadTexture, editText, userColor = null, reducedMotion = false }) {
    Object.assign(this, { PIXI, root, theme, rect, makeText, loadTexture, editText, userColor, reducedMotion });
    this.initialCards = cards;
    this.initialStrings = strings;
    this.cards = new Map();
    this.strings = new Map();
    this.stars = [];
    this.time = 0;
    this.topZ = 0;
    this.connecting = null;
    this.pendingEdit = null;
    /** Cards and strings fading out after removal; no longer in `cards` or `strings`. */
    this.leaving = new Set();
  }

  async build() {
    const { PIXI } = this;
    await this.#loadFonts();
    this.glowTexture = makeGlowTexture(PIXI, GLOW_TEXTURE_SIZE);
    const layer = () => this.root.addChild(new PIXI.Container());
    this.layers = { sky: layer(), strings: layer(), flow: layer(), cards: layer(), labels: layer() };
    this.layers.cards.sortableChildren = true;
    this.#buildSky();
    for (const data of this.initialCards) await this.addCard(data, { animate: false });
    for (const data of this.initialStrings) this.addString(data, { animate: false });
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

  /* -------------------------------------------- */
  /*  Cards                                       */
  /* -------------------------------------------- */

  async addCard(data, { animate = true } = {}) {
    if (!this.alive || this.cards.has(data.id)) return this.updateCard(data);
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
      hover: false, dragging: null, holds: 0, drawToken: 0
    };
    this.cards.set(data.id, card);
    this.#layoutCard(card);
    this.#wireCard(card);
    await this.#drawCardBody(card);
    return card;
  }

  async updateCard(data) {
    const card = this.cards.get(data.id);
    if (!card) return this.addCard(data);
    const before = card.data;
    card.data = { ...before, ...data };
    // Your own drag wins over an echo of an older position.
    if (!card.dragging) card.target = { x: card.data.x, y: card.data.y };
    const looks = ["name", "img", "caption", "missing", "w", "h"].some((k) => before[k] !== card.data[k]);
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

  #destroyCard(card) {
    card.container.parent?.removeChild(card.container);
    card.container.destroy({ children: true });
  }

  /** What the pointer is over, for the Delete key: a string's label wins over the card under it. */
  hovered() {
    for (const string of this.strings.values()) if (string.hover) return { kind: "string", id: string.data.id };
    for (const card of this.cards.values()) if (card.hover) return { kind: "card", id: card.data.id };
    return null;
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

  /** Portrait, name and caption. Redrawn whenever the document behind the card changes. */
  async #drawCardBody(card) {
    const { PIXI, theme } = this;
    const c = theme.card;
    const { data, body } = card;
    const token = ++card.drawToken;
    const texture = data.img ? await this.loadTexture(data.img).catch(() => null) : null;
    // A newer redraw started while this texture loaded, or the board went away.
    if (token !== card.drawToken || !this.alive || body.destroyed) return;

    for (const child of body.removeChildren()) child.destroy({ children: true });
    card.plate = body.addChild(new PIXI.Graphics());
    drawCardPlate(card.plate, data.w, data.h, theme, { hover: card.hover });

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
    const caption = body.addChild(this.makeText(data.missing ? "(no longer exists)" : (data.caption ?? ""), c.caption));
    caption.position.set(textX, 72);
    body.alpha = data.missing ? 0.5 : 1;
  }

  #wireCard(card) {
    const { container } = card;
    this.#wireContextMenu(container, "card", () => card.data.id);
    container.on("pointerenter", () => this.#setHover(card, true));
    container.on("pointerleave", () => this.#setHover(card, false));
    container.on("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const p = event.getLocalPosition(this.root);
      const start = { ...card.target };
      card.dragging = { dx: p.x - card.target.x, dy: p.y - card.target.y };
      container.cursor = "grabbing";
      container.zIndex = ++this.topZ;
      const move = (e) => {
        const q = e.getLocalPosition(this.root);
        card.target.x = q.x - card.dragging.dx;
        card.target.y = q.y - card.dragging.dy;
      };
      const end = () => {
        container.off("globalpointermove", move);
        container.off("pointerup", end);
        container.off("pointerupoutside", end);
        card.dragging = null;
        container.cursor = "grab";
        const moved = Math.hypot(card.target.x - start.x, card.target.y - start.y) > 1;
        if (moved) this.onCardMoved?.(card.data.id, { x: Math.round(card.target.x), y: Math.round(card.target.y) });
      };
      container.on("globalpointermove", move);
      container.on("pointerup", end);
      container.on("pointerupoutside", end);
    });
  }

  #setHover(card, on) {
    if (card.hover === on) return;
    card.hover = on;
    if (card.plate && !card.plate.destroyed) drawCardPlate(card.plate, card.data.w, card.data.h, this.theme, { hover: on });
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
    const string = {
      data: { ...data }, index: 0, count: 1, flip: data.from > data.to,
      line: this.layers.strings.addChild(new PIXI.Graphics()),
      flow, label, plate, text, control: null, phase: 0, lastTap: 0, editing: false,
      grow: animate && !this.reducedMotion ? 0 : 1
    };
    this.strings.set(data.id, string);
    this.#reindexStrings();
    this.#layoutLabel(string);
    this.#wireLabel(string);
    if (this.pendingEdit?.id === data.id) {
      const { value } = this.pendingEdit;
      this.pendingEdit = null;
      this.editString(data.id, value);
    }
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
    const w = Math.max(l.minWidth, string.text.width + l.padX * 2);
    const h = Math.max(l.text.fontSize, string.text.height) + l.padY * 2;
    drawLabelPlate(string.plate, w, h, this.theme, this.#colorOf(string));
    string.label.hitArea = new this.PIXI.Rectangle(-w / 2, -h / 2, w, h);
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
    if (string.editing || !this.editText) return;
    string.editing = true;
    this.#hold(string, 1);
    string.label.visible = false;
    const value = await this.editText({
      id: string.data.id,
      x: string.label.position.x,
      y: string.label.position.y,
      value: initial ?? string.data.label ?? "",
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

    for (const card of this.cards.values()) {
      const still = card.hover || card.dragging || card.holds > 0;
      stepClock(card.clock, dt, !still && !reduced);
      const smooth = card.dragging ? CARD_SMOOTH : SETTLE_SMOOTH;
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
    if (this.connecting) this.#drawConnecting();
  }

  /** A removed card shrinks and fades; a removed string draws itself back toward its start. */
  #updateLeaving(item, dt) {
    if (item.leavingKind === "card") {
      item.appear -= dt / LEAVE_SECONDS;
      const shown = easeOut(Math.max(0, item.appear));
      item.container.alpha = shown;
      item.container.scale.set(0.85 + 0.15 * shown);
      if (item.appear <= 0) {
        this.leaving.delete(item);
        this.#destroyCard(item);
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
    const { card, label } = this.theme;
    const faces = [card.name, card.caption, label.text].map((s) => `${s.fontWeight ?? "400"} ${s.fontSize}px ${s.fontFamily}`);
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
