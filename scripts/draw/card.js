// Card plates. Each function draws into a PIXI.Graphics it is given, in the
// card's own coordinates (top-left at 0, 0), and reads every look from the theme.
import { mulberry32 } from "./starfield.js";

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
  g.beginFill(style.fill, c.fillAlpha);
  g.drawRoundedRect(0, 0, w, h, c.radius);
  g.endFill();
  // A ruled line just inside the edge, like a printed invitation's.
  if (c.rule) {
    const { inset, width, color: ruleColor, alpha } = c.rule;
    g.lineStyle({ width, color: ruleColor, alpha, alignment: 0.5 });
    g.drawRect(inset, inset, w - inset * 2, h - inset * 2);
  }
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

/**
 * The halo ring around a portrait centred at x, y. A theme with a `cameo`
 * frames it as an oval instead, `aspect` as wide as it is tall, in a ring
 * with a fine second line outside it and no halo.
 */
export function drawPortraitRing(g, x, y, r, theme) {
  const c = theme.card;
  g.clear();
  const cameo = c.cameo;
  if (cameo) {
    const rx = r * cameo.aspect;
    g.lineStyle({ width: cameo.ringWidth, color: c.ring, alpha: 1, alignment: 0.5 });
    g.beginFill(c.portraitBack, 1);
    g.drawEllipse(x, y, rx, r);
    g.endFill();
    g.lineStyle({ width: 1, color: cameo.outer, alpha: cameo.outerAlpha, alignment: 0.5 });
    g.drawEllipse(x, y, rx + cameo.outerGap, r + cameo.outerGap);
    return;
  }
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

/* -------------------------------------------- */
/*  Wax seals (a theme with `seal`)             */
/* -------------------------------------------- */

/** A stable 32-bit number from a string (FNV-1a), so a card's seal keeps its shape. */
export function seedOf(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A seal's edge, as a flat [x, y, x, y, …] polygon around 0, 0: `points`
 * corners, each pushed in or out by up to half of `jitter` of the radius, the
 * way wax spreads unevenly under the stamp. Pure, and the same for one seed.
 */
export function sealOutline(radius, points, jitter, seed) {
  const rand = mulberry32(seed);
  const outline = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const r = radius * (1 - jitter / 2 + rand() * jitter);
    outline.push(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  return outline;
}

/** Where a card's seal sits: across its top edge, near the right-hand corner. */
export function sealCentre(w, theme) {
  return { x: w - theme.seal.right, y: theme.seal.top };
}

/** A rotated ellipse as a polygon, since PIXI's own ellipse cannot turn. */
function ellipsePolygon(cx, cy, rx, ry, rotation, steps = 18) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const points = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const ex = Math.cos(t) * rx;
    const ey = Math.sin(t) * ry;
    points.push(cx + ex * cos - ey * sin, cy + ex * sin + ey * cos);
  }
  return points;
}

/**
 * A wax seal centred on 0, 0: its cast shadow, the uneven wax lit from the
 * top left (the same light the plates assume), the ring the stamp left, and a
 * glint. `seed` shapes the edge, so each card's seal is its own.
 */
export function drawSeal(g, theme, radius, seed) {
  const s = theme.seal;
  const outline = sealOutline(radius, s.points, s.jitter, seed);
  g.clear();
  // A soft shadow: the outline, grown a little each time and fainter.
  for (const [grow, share] of [[1.12, 0.3], [1.06, 0.35], [1, 0.35]]) {
    g.beginFill(s.shadow, s.shadowAlpha * share);
    g.drawPolygon(outline.map((v, i) => v * grow + (i % 2 ? radius * 0.14 : radius * 0.06)));
    g.endFill();
  }
  g.beginFill(s.dark, 1);
  g.drawPolygon(outline);
  g.endFill();
  // The wax's light, as rings stacked towards the top left: a gradient PIXI
  // cannot fill, drawn in steps too fine to see.
  const steps = 8;
  for (let k = 0; k < steps; k++) {
    g.beginFill(s.wax, s.waxAlpha);
    g.drawCircle(-radius * 0.16, -radius * 0.2, radius * 0.7 * (1 - k / steps));
    g.endFill();
  }
  g.beginFill(s.light, s.lightAlpha);
  g.drawCircle(-radius * 0.24, -radius * 0.3, radius * 0.3);
  g.endFill();
  g.lineStyle({ width: Math.max(1.2, radius * 0.07), color: s.ring, alpha: s.ringAlpha, alignment: 0.5 });
  g.drawCircle(0, 0, radius * 0.72);
  g.lineStyle(0);
  g.beginFill(s.shine, s.shineAlpha);
  g.drawPolygon(ellipsePolygon(-radius * 0.42, -radius * 0.46, radius * 0.26, radius * 0.14, -0.6));
  g.endFill();
}

/** The flower a seal is stamped with when it carries no emblem, centred on 0, 0. */
export function drawSealMark(g, theme, radius) {
  const s = theme.seal;
  const size = radius * 0.42;
  const cy = -radius * 0.04;
  g.clear();
  g.beginFill(s.mark, s.markAlpha);
  g.moveTo(0, cy - size);
  g.bezierCurveTo(size * 0.55, cy - size * 0.55, size * 0.75, cy + size * 0.25, 0, cy + size * 0.85);
  g.bezierCurveTo(-size * 0.75, cy + size * 0.25, -size * 0.55, cy - size * 0.55, 0, cy - size);
  g.closePath();
  g.endFill();
  g.beginFill(s.mark, s.markAlpha);
  for (const side of [-1, 1]) g.drawCircle(side * size * 0.66, cy + size * 0.12, size * 0.2);
  g.drawRect(-size * 0.04, cy + size * 0.8, size * 0.08, size * 0.32);
  g.endFill();
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
