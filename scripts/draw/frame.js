// Frames: titled boxes that group cards (SPEC.md 5.6). Drawn behind the
// strings and cards, in the frame's own coordinates (top-left at 0, 0).

/** The frame's box, its title band, and a hint of glow. */
export function drawFramePlate(g, w, h, theme, { hover = false, color = null } = {}) {
  const f = theme.frame;
  const tint = color ?? f.color;
  g.clear();
  g.lineStyle({ width: 14, color: tint, alpha: hover ? 0.14 : 0.07, alignment: 1 });
  g.drawRoundedRect(0, 0, w, h, f.radius);
  g.lineStyle({ width: f.borderWidth, color: tint, alpha: hover ? 0.95 : f.borderAlpha, alignment: 0.5 });
  g.beginFill(f.fill, f.fillAlpha);
  g.drawRoundedRect(0, 0, w, h, f.radius);
  g.endFill();
  // The title band is where you grab it.
  g.lineStyle(0);
  g.beginFill(tint, hover ? 0.16 : 0.09);
  g.drawRoundedRect(0, 0, w, f.titleBand, f.radius);
  g.endFill();
}

/** The resize grip in the bottom-right corner: three short diagonal strokes. */
export function drawGrip(g, theme, color = null) {
  const f = theme.frame;
  const size = f.grip;
  g.clear();
  g.lineStyle({ width: 2.5, color: color ?? f.color, alpha: 0.9, cap: "round" });
  for (const inset of [8, 15, 22]) {
    g.moveTo(size - 4, size - inset);
    g.lineTo(size - inset, size - 4);
  }
}

/** Alignment guides while a card is dragged. */
export function drawGuides(g, guides, theme, scale = 1) {
  const s = theme.guide;
  g.clear();
  if (!guides.length) return;
  g.lineStyle({ width: s.width / scale, color: s.color, alpha: s.alpha });
  for (const { x1, y1, x2, y2 } of guides) {
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
  }
}
