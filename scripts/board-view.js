// The board as PIXI objects: sky, strings, flowing light, cards and labels,
// plus the motion and pointer handling that make it feel alive. It knows
// nothing about Foundry. The canvas layer and tools/preview each build one and
// hand it their own text, texture and text-editing helpers (SPEC.md 5.1).
import { controlPoint, curveThrough, quadLength, quadPoint } from "./geometry.js";
import { CARD_SMOOTH, CONTROL_SMOOTH, advanceFlow, dampPoint, driftOffset, stepClock } from "./motion.js";
import { drawCardPlate, drawPortraitRing } from "./draw/card.js";
import { drawFlow, drawLabelPlate, drawString } from "./draw/string.js";
import { makeGlowTexture, starAlpha, starfieldData } from "./draw/starfield.js";

const DOUBLE_TAP_MS = 350;
const GLOW_TEXTURE_SIZE = 64;

export class BoardView {
  /**
   * @param {object} options
   * @param {typeof PIXI} options.PIXI
   * @param {PIXI.Container} options.root       Container the board draws into, in board coordinates
   * @param {object} options.theme
   * @param {{x, y, width, height}} options.rect  Area the sky covers
   * @param {object[]} options.cards            {id, name, caption, img, x, y, w, h}
   * @param {object[]} options.strings          {id, from, to, label, arrows, color}
   * @param {(text: string, style: object) => PIXI.Text} options.makeText
   * @param {(src: string) => Promise<PIXI.Texture>} options.loadTexture
   * @param {(request: object) => Promise<string|null>} [options.editText]  Resolves the new text, or null to cancel
   * @param {boolean} [options.reducedMotion]
   */
  constructor({ PIXI, root, theme, rect, cards, strings, makeText, loadTexture, editText, reducedMotion = false }) {
    Object.assign(this, { PIXI, root, theme, rect, makeText, loadTexture, editText, reducedMotion });
    this.cardData = cards;
    this.stringData = strings;
    this.cards = new Map();
    this.strings = [];
    this.stars = [];
    this.time = 0;
    this.topZ = 0;
  }

  async build() {
    const { PIXI } = this;
    await this.#loadFonts();
    this.glowTexture = makeGlowTexture(PIXI, GLOW_TEXTURE_SIZE);
    const layer = () => this.root.addChild(new PIXI.Container());
    this.layers = { sky: layer(), strings: layer(), flow: layer(), cards: layer(), labels: layer() };
    this.layers.cards.sortableChildren = true;
    this.#buildSky();
    for (const data of this.cardData) this.cards.set(data.id, await this.#buildCard(data));
    this.#buildStrings();
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

  setReducedMotion(on) {
    this.reducedMotion = on;
  }

  /** Advance every animation by `dt` seconds and redraw what moved. */
  update(dt) {
    this.time += dt;
    const reduced = this.reducedMotion;

    if (!reduced) {
      for (const star of this.stars) if (star.data.twinkle) star.sprite.alpha = starAlpha(star.data, this.time);
    }

    for (const card of this.cards.values()) {
      const still = card.hover || card.dragging || card.holds > 0;
      stepClock(card.clock, dt, !still && !reduced);
      dampPoint(card.pos, card.target, reduced ? CARD_SMOOTH / 3 : CARD_SMOOTH, dt);
      const drift = reduced ? { x: 0, y: 0 } : driftOffset(card.data.id, card.clock.time);
      card.box = { x: card.pos.x + drift.x, y: card.pos.y + drift.y, w: card.data.w, h: card.data.h };
      card.container.position.set(card.box.x, card.box.y);
    }

    for (const string of this.strings) {
      const from = this.cards.get(string.data.from)?.box;
      const to = this.cards.get(string.data.to)?.box;
      if (!from || !to) continue;
      const target = controlPoint(from, to, string);
      string.control ??= { ...target, vx: 0, vy: 0 };
      dampPoint(string.control, target, reduced ? CARD_SMOOTH / 3 : CONTROL_SMOOTH, dt);
      const curve = curveThrough(from, to, string.control, this.theme.string.pad);
      const color = this.#colorOf(string);
      drawString(string.line, curve, this.theme, { color, arrows: string.data.arrows });
      if (reduced) string.flow.clear();
      else {
        const length = quadLength(curve);
        string.phase = advanceFlow(string.phase, dt, this.theme.string.flow.speed, length);
        drawFlow(string.flow, curve, this.theme, string.phase, length, { both: string.data.arrows === "none" });
      }
      const mid = quadPoint(curve, 0.5);
      string.label.position.set(mid.x, mid.y);
    }
  }

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

  async #buildCard(data) {
    const { PIXI, theme } = this;
    const c = theme.card;
    const container = new PIXI.Container();
    container.eventMode = "static";
    container.cursor = "grab";
    container.hitArea = new PIXI.Rectangle(0, 0, data.w, data.h);
    const plate = container.addChild(new PIXI.Graphics());
    drawCardPlate(plate, data.w, data.h, theme);

    const r = c.portrait / 2;
    const px = 14 + r;
    const py = data.h / 2;
    drawPortraitRing(container.addChild(new PIXI.Graphics()), px, py, r, theme);
    const texture = data.img ? await this.loadTexture(data.img).catch(() => null) : null;
    if (texture) {
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.position.set(px, py);
      sprite.scale.set((r * 2) / Math.min(texture.width, texture.height));
      const mask = container.addChild(new PIXI.Graphics());
      mask.beginFill(0xffffff, 1);
      mask.drawCircle(px, py, r - 2);
      mask.endFill();
      sprite.mask = mask;
      container.addChild(sprite);
    }

    const textX = 14 + c.portrait + 22;
    const name = container.addChild(this.makeText(data.name ?? "", c.name));
    name.position.set(textX, 20);
    const caption = container.addChild(this.makeText(data.caption ?? "", c.caption));
    caption.position.set(textX, 72);

    this.layers.cards.addChild(container);
    const card = {
      data, container, plate,
      target: { x: data.x, y: data.y },
      pos: { x: data.x, y: data.y, vx: 0, vy: 0 },
      clock: { time: 0, rate: 1 },
      box: { x: data.x, y: data.y, w: data.w, h: data.h },
      hover: false, dragging: null, holds: 0
    };
    this.#wireCard(card);
    return card;
  }

  #wireCard(card) {
    const { container } = card;
    container.on("pointerover", () => this.#setHover(card, true));
    container.on("pointerout", () => this.#setHover(card, false));
    container.on("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      const p = event.getLocalPosition(this.root);
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
        this.onCardMoved?.(card.data, { ...card.target });
      };
      container.on("globalpointermove", move);
      container.on("pointerup", end);
      container.on("pointerupoutside", end);
    });
  }

  #setHover(card, on) {
    if (card.hover === on) return;
    card.hover = on;
    drawCardPlate(card.plate, card.data.w, card.data.h, this.theme, { hover: on });
  }

  #buildStrings() {
    const { PIXI } = this;
    // Strings sharing a pair of cards fan out, so count each pair first.
    const pairs = new Map();
    const pairKey = (s) => [s.from, s.to].sort().join("|");
    for (const data of this.stringData) pairs.set(pairKey(data), (pairs.get(pairKey(data)) ?? 0) + 1);
    const seen = new Map();
    for (const data of this.stringData) {
      const key = pairKey(data);
      const index = seen.get(key) ?? 0;
      seen.set(key, index + 1);
      const flow = this.layers.flow.addChild(new PIXI.Graphics());
      flow.blendMode = PIXI.BLEND_MODES.ADD;
      const label = this.layers.labels.addChild(new PIXI.Container());
      label.eventMode = "static";
      label.cursor = "text";
      const plate = label.addChild(new PIXI.Graphics());
      const text = label.addChild(this.makeText(data.label ?? "", this.theme.label.text));
      text.anchor.set(0.5);
      const string = {
        data, index, count: pairs.get(key), flip: data.from > data.to,
        line: this.layers.strings.addChild(new PIXI.Graphics()),
        flow, label, plate, text, control: null, phase: 0, lastTap: 0, editing: false
      };
      this.#layoutLabel(string);
      this.#wireLabel(string);
      this.strings.push(string);
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
    // Hovering a label holds both its cards still, so it does not slide away mid-read.
    label.on("pointerover", () => this.#hold(string, 1));
    label.on("pointerout", () => this.#hold(string, -1));
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

  async #editLabel(string) {
    if (string.editing || !this.editText) return;
    string.editing = true;
    this.#hold(string, 1);
    string.label.visible = false;
    const value = await this.editText({
      x: string.label.position.x,
      y: string.label.position.y,
      value: string.data.label ?? "",
      color: this.#colorOf(string),
      fontSize: this.theme.label.text.fontSize
    });
    string.editing = false;
    this.#hold(string, -1);
    if (!this.layers) return; // Torn down while the editor was open.
    string.label.visible = true;
    if (value === null || value === string.data.label) return;
    string.data.label = value;
    string.text.text = value;
    this.#layoutLabel(string);
    this.onLabelChanged?.(string.data);
  }

  #colorOf(string) {
    return string.data.color ?? this.theme.string.color;
  }
}
