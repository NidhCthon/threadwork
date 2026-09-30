// Card plates. Each function draws into a PIXI.Graphics it is given, in the
// card's own coordinates (top-left at 0, 0), and reads every look from the theme.

/** The glowing plate behind a card's portrait and text. */
export function drawCardPlate(g, w, h, theme, { hover = false } = {}) {
  const c = theme.card;
  const glow = hover ? c.hoverGlowAlpha : c.glowAlpha;
  g.clear();
  // Stacked outer strokes: the inner ones overlap, so the glow fades outward.
  for (let ring = 4; ring >= 1; ring--) {
    g.lineStyle({ width: ring * 7, color: c.glow, alpha: glow / ring, alignment: 1 });
    g.drawRoundedRect(0, 0, w, h, c.radius);
  }
  g.lineStyle({ width: c.borderWidth, color: hover ? 0xffffff : c.border, alpha: c.borderAlpha, alignment: 0.5 });
  g.beginFill(c.fill, c.fillAlpha);
  g.drawRoundedRect(0, 0, w, h, c.radius);
  g.endFill();
}

/** A connection handle, centred on 0, 0: drag from it to draw a string. */
export function drawHandle(g, theme, color = theme.string.color) {
  g.clear();
  g.lineStyle({ width: 8, color, alpha: 0.25, alignment: 1 });
  g.drawCircle(0, 0, 9);
  g.lineStyle({ width: 2, color: 0xffffff, alpha: 0.9, alignment: 0.5 });
  g.beginFill(color, 1);
  g.drawCircle(0, 0, 9);
  g.endFill();
}

/** The halo ring around a portrait centred at x, y. */
export function drawPortraitRing(g, x, y, r, theme) {
  const c = theme.card;
  g.clear();
  g.lineStyle({ width: 10, color: c.glow, alpha: 0.22, alignment: 1 });
  g.drawCircle(x, y, r);
  g.lineStyle({ width: 2.5, color: c.ring, alpha: 0.95, alignment: 0.5 });
  g.beginFill(0x050816, 1);
  g.drawCircle(x, y, r);
  g.endFill();
}
