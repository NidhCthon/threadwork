// Frames: titled boxes that group cards (SPEC.md 5.6). Drawn behind the
// strings and cards, in the frame's own coordinates (top-left at 0, 0).

/** The frame's box, its title band, and a hint of glow. */
export function drawFramePlate(g, w, h, theme, { hover = false, color = null } = {}) {
  const f = theme.frame;
  const tint = color ?? f.color;
  if (f.gilt) return drawGiltFrame(g, w, h, f, tint, hover);
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

/**
 * A picture frame's moulding (a theme with `frame.gilt`): a heavy gilt border
 * with a fine light line outside it and a dark one inside, a dark band for
 * the title with a rule under it, and a stud on each corner. `tint` is the
 * gilt, so a frame given a colour is gilded in it.
 */
function drawGiltFrame(g, w, h, f, tint, hover) {
  const k = f.gilt;
  const b = f.borderWidth;
  g.clear();
  g.lineStyle({ width: 18, color: tint, alpha: hover ? 0.2 : 0.07, alignment: 1 });
  g.drawRect(0, 0, w, h);
  g.lineStyle(0);
  g.beginFill(f.fill, f.fillAlpha);
  g.drawRect(0, 0, w, h);
  g.endFill();
  g.beginFill(k.band, k.bandAlpha);
  g.drawRect(b / 2, b / 2, w - b, f.titleBand - b / 2);
  g.endFill();
  g.lineStyle({ width: 1.5, color: tint, alpha: 0.5 });
  g.moveTo(b + 24, f.titleBand);
  g.lineTo(w - b - 24, f.titleBand);
  g.lineStyle({ width: 1.5, color: k.outer, alpha: k.outerAlpha, alignment: 0.5 });
  g.drawRect(-b / 2 - 6, -b / 2 - 6, w + b + 12, h + b + 12);
  g.lineStyle({ width: b, color: tint, alpha: hover ? 1 : f.borderAlpha, alignment: 0.5 });
  g.drawRect(0, 0, w, h);
  // A sheen along the moulding, nearer its outer edge, where the light catches.
  g.lineStyle({ width: Math.max(1, b * 0.22), color: k.outer, alpha: 0.55, alignment: 0.5 });
  g.drawRect(-b * 0.22, -b * 0.22, w + b * 0.44, h + b * 0.44);
  g.lineStyle({ width: 2, color: k.inner, alpha: 1, alignment: 0.5 });
  g.drawRect(b / 2 + 2, b / 2 + 2, w - b - 4, h - b - 4);
  const s = k.stud;
  for (const [x, y] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    g.lineStyle({ width: 1.5, color: k.inner, alpha: 1, alignment: 0.5 });
    g.beginFill(k.outer, 1);
    g.drawPolygon([x, y - s, x + s, y, x, y + s, x - s, y]);
    g.endFill();
  }
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
