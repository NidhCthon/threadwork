// Pure geometry for the board: where a string leaves a card, how it bows, and
// where its label and arrowhead sit. Points are {x, y}; boxes are
// {x, y, w, h} with x, y at the top-left corner. Nothing here touches PIXI or
// Foundry, so it runs the same in node, the preview and the canvas.

/** Space between strings that share the same two cards, in pixels of bow. */
export const STRING_SPACING = 56;

export const center = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

/**
 * Where a ray from the box's centre toward `toward` crosses the box's edge,
 * pushed `pad` pixels further out so a string stops just short of the card.
 */
export function edgePoint(box, toward, pad = 0) {
  const c = center(box);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = box.w / 2 + pad;
  const hh = box.h / 2 + pad;
  const s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

/**
 * How far a string's control point sits off the straight line between its
 * cards. A lone string gets a gentle bow that grows with distance; strings
 * sharing a pair fan out around it.
 */
export function bowFor(distance, index = 0, count = 1) {
  const base = Math.min(120, Math.max(24, distance * 0.1));
  return base + (index - (count - 1) / 2) * STRING_SPACING;
}

/**
 * The control point for a string between two cards. The bow's side comes from
 * the pair in a fixed order: `flip` is true when the string runs from the later
 * card to the earlier one, so strings in both directions between the same two
 * cards fan out instead of lying on top of each other.
 */
export function controlPoint(fromBox, toBox, { index = 0, count = 1, flip = false } = {}) {
  const a = center(fromBox);
  const b = center(toBox);
  const [s, e] = flip ? [b, a] : [a, b];
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const length = Math.hypot(dx, dy) || 1;
  const bow = bowFor(length, index, count);
  return { x: (a.x + b.x) / 2 - (dy / length) * bow, y: (a.y + b.y) / 2 + (dx / length) * bow };
}

/** A quadratic curve {p0, p1, p2} from card edge to card edge, bent through `control`. */
export function curveThrough(fromBox, toBox, control, pad = 0) {
  return {
    p0: edgePoint(fromBox, control, pad),
    p1: { x: control.x, y: control.y },
    p2: edgePoint(toBox, control, pad)
  };
}

export function stringCurve(fromBox, toBox, options = {}) {
  return curveThrough(fromBox, toBox, controlPoint(fromBox, toBox, options), options.pad ?? 0);
}

export function quadPoint({ p0, p1, p2 }, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
  };
}

export function quadTangent({ p0, p1, p2 }, t) {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y)
  };
}

export function quadLength(curve, segments = 24) {
  let length = 0;
  let last = curve.p0;
  for (let i = 1; i <= segments; i++) {
    const p = quadPoint(curve, i / segments);
    length += Math.hypot(p.x - last.x, p.y - last.y);
    last = p;
  }
  return length;
}

export const reverseCurve = ({ p0, p1, p2 }) => ({ p0: p2, p1, p2: p0 });

/**
 * The part of a curve from its start to `t`, as a curve of its own (de
 * Casteljau). A new string grows by drawing more of itself each frame.
 */
export function splitCurve(curve, t) {
  const { p0, p1 } = curve;
  return {
    p0,
    p1: { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t },
    p2: quadPoint(curve, t)
  };
}

/** Whether point `p` is on or within `pad` pixels of box `b`. */
export const boxContains = (b, p, pad = 0) =>
  p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;

/** The triangle for an arrowhead whose tip sits on the curve's end point. */
export function arrowHead(curve, size) {
  const tangent = quadTangent(curve, 1);
  const length = Math.hypot(tangent.x, tangent.y) || 1;
  const ux = tangent.x / length;
  const uy = tangent.y / length;
  const tip = curve.p2;
  const base = { x: tip.x - ux * size, y: tip.y - uy * size };
  const half = size * 0.55;
  return {
    tip,
    base,
    left: { x: base.x - uy * half, y: base.y + ux * half },
    right: { x: base.x + uy * half, y: base.y - ux * half }
  };
}
