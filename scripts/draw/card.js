// Card plates. Each function draws into a PIXI.Graphics it is given, in the
// card's own coordinates (top-left at 0, 0), and reads every look from the theme.

/**
 * The glowing plate behind a card's contents. `color` tints its border and
 * glow; `hub` is the brighter, heavier plate of a concept card.
 */
export function drawCardPlate(g, w, h, theme, { hover = false, color = null, hub = false } = {}) {
  const c = theme.card;
  const style = hub ? { ...c, ...theme.hub } : c;
  const glow = hover ? style.hoverGlowAlpha : style.glowAlpha;
  const tint = color ?? c.glow;
  g.clear();
  // Stacked outer strokes: the inner ones overlap, so the glow fades outward.
  const rings = hub ? 5 : 4;
  for (let ring = rings; ring >= 1; ring--) {
    g.lineStyle({ width: ring * (hub ? 9 : 7), color: tint, alpha: glow / ring, alignment: 1 });
    g.drawRoundedRect(0, 0, w, h, c.radius);
  }
  g.lineStyle({ width: style.borderWidth, color: hover ? c.hoverBorder : (color ?? c.border), alpha: c.borderAlpha, alignment: 0.5 });
  g.beginFill(c.fill, c.fillAlpha);
  g.drawRoundedRect(0, 0, w, h, c.radius);
  g.endFill();
}

/** A small pill with a word in it, top-left at 0, 0; returns its width. */
export function drawBadge(g, width, height, color) {
  g.clear();
  g.beginFill(color, 0.95);
  g.drawRoundedRect(0, 0, width, height, height / 2);
  g.endFill();
  return width;
}

/** A connection handle, centred on 0, 0: drag from it to draw a string. */
export function drawHandle(g, theme, color = theme.string.color) {
  g.clear();
  g.lineStyle({ width: 8, color, alpha: 0.25, alignment: 1 });
  g.drawCircle(0, 0, 9);
  g.lineStyle({ width: 2, color: theme.card.handleRing, alpha: 0.9, alignment: 0.5 });
  g.beginFill(color, 1);
  g.drawCircle(0, 0, 9);
  g.endFill();
}

/**
 * A pin pushed through the top of a card, centred on 0, 0: a shadow cast down
 * the card, the steel shaft, then the domed head with a highlight on it. Only
 * themes whose cards are physical objects draw one (`theme.pin.show`).
 */
export function drawPin(g, theme) {
  const p = theme.pin;
  g.clear();
  // The shadow falls below and right of the head, so the light reads as coming
  // from the top left — the same direction the card plates already assume.
  g.beginFill(p.shadow, p.shadowAlpha);
  g.drawEllipse(p.radius * 0.5, p.radius * 0.9, p.radius * 0.9, p.radius * 0.5);
  g.endFill();
  g.lineStyle({ width: p.shaft, color: p.steel, alpha: 1, cap: "round" });
  g.moveTo(0, 0);
  g.lineTo(p.radius * 0.18, p.radius * 1.15);
  g.lineStyle(0);
  g.beginFill(p.head, 1);
  g.drawCircle(0, 0, p.radius);
  g.endFill();
  g.beginFill(p.shine, p.shineAlpha);
  g.drawCircle(-p.radius * 0.3, -p.radius * 0.32, p.radius * 0.38);
  g.endFill();
}

/** The halo ring around a portrait centred at x, y. */
export function drawPortraitRing(g, x, y, r, theme) {
  const c = theme.card;
  g.clear();
  g.lineStyle({ width: 10, color: c.glow, alpha: 0.22, alignment: 1 });
  g.drawCircle(x, y, r);
  g.lineStyle({ width: 2.5, color: c.ring, alpha: 0.95, alignment: 0.5 });
  g.beginFill(c.portraitBack, 1);
  g.drawCircle(x, y, r);
  g.endFill();
}

/**
 * Where a card's emblem sits: on the portrait's rim at its lower right, the
 * way a seal is pressed onto the corner of a photograph. Clear of the name,
 * which starts to the right of the portrait.
 */
export function emblemCentre(px, py, r) {
  const along = Math.SQRT1_2 * r;
  return { x: px + along, y: py + along };
}

/** The disc behind an emblem's symbol, centred on 0, 0. */
export function drawEmblemDisc(g, theme) {
  const e = theme.emblem;
  g.clear();
  g.lineStyle({ width: 7, color: e.glow, alpha: e.glowAlpha, alignment: 1 });
  g.drawCircle(0, 0, e.radius);
  g.lineStyle({ width: e.ringWidth, color: e.ring, alpha: 1, alignment: 0.5 });
  g.beginFill(e.fill, 1);
  g.drawCircle(0, 0, e.radius);
  g.endFill();
}
