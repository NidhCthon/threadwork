// Strings, the light that runs along them, and their label plates. Each
// function draws into a PIXI.Graphics it is given, in board coordinates.
import { arrowHead, quadPoint, reverseCurve } from "../geometry.js";

function stroke(g, curve, width, color, alpha) {
  g.lineStyle({ width, color, alpha, cap: "round", join: "round" });
  g.moveTo(curve.p0.x, curve.p0.y);
  g.quadraticCurveTo(curve.p1.x, curve.p1.y, curve.p2.x, curve.p2.y);
}

function fillArrow(g, head, color) {
  g.lineStyle(0);
  g.beginFill(color, 1);
  g.drawPolygon([head.tip.x, head.tip.y, head.left.x, head.left.y, head.right.x, head.right.y]);
  g.endFill();
}

/** The string itself: a wide faint glow, a softer halo, then the bright core, and its arrowheads. */
export function drawString(g, curve, theme, { color, arrows = "forward" } = {}) {
  const s = theme.string;
  g.clear();
  stroke(g, curve, s.glowWidth, color, s.glowAlpha);
  stroke(g, curve, s.midWidth, color, s.midAlpha);
  stroke(g, curve, s.width, color, 0.95);
  if (arrows === "forward" || arrows === "both") fillArrow(g, arrowHead(curve, s.arrow), color);
  if (arrows === "both") fillArrow(g, arrowHead(reverseCurve(curve), s.arrow), color);
}

/** Fade light in and out near the ends so it never pops on or off at a card's edge. */
const endFade = (t) => Math.max(0, Math.min(1, t / 0.08, (1 - t) / 0.08));

/**
 * Pulses of light travelling along the string. `phase` (0-1) is how far the
 * lead pulse has come; `length` keeps the trail's spacing constant in pixels.
 * Undirected strings send light both ways.
 */
export function drawFlow(g, curve, theme, phase, length, { both = false } = {}) {
  const f = theme.string.flow;
  g.clear();
  if (length < 1) return;
  const step = f.spacing / length;
  for (const backwards of both ? [false, true] : [false]) {
    // The return run is offset half a gap so the two directions interleave.
    const offset = backwards ? 0.5 / f.pulses : 0;
    for (let k = 0; k < f.pulses; k++) {
      const head = (phase + offset + k / f.pulses) % 1;
      for (let j = 0; j < f.trail; j++) {
        let t = head - j * step;
        if (t < 0) continue;
        if (backwards) t = 1 - t;
        const fade = 1 - j / f.trail;
        const p = quadPoint(curve, t);
        g.beginFill(f.color, f.alpha * fade * fade * endFade(t));
        g.drawCircle(p.x, p.y, f.radius * (0.45 + 0.55 * fade));
        g.endFill();
      }
    }
  }
}

/** An unlabelled string's handle: a small glowing dot where its label would be. */
export function drawLabelDot(g, color) {
  g.clear();
  g.lineStyle({ width: 8, color, alpha: 0.2, alignment: 1 });
  g.drawCircle(0, 0, 7);
  g.lineStyle({ width: 2, color, alpha: 0.9, alignment: 0.5 });
  g.beginFill(0x0a0f26, 1);
  g.drawCircle(0, 0, 7);
  g.endFill();
}

/** A label's plate, centred on 0, 0. */
export function drawLabelPlate(g, w, h, theme, color) {
  const l = theme.label;
  g.clear();
  g.lineStyle({ width: 8, color, alpha: 0.14, alignment: 1 });
  g.drawRoundedRect(-w / 2, -h / 2, w, h, l.radius);
  g.lineStyle({ width: 1.5, color, alpha: l.borderAlpha, alignment: 0.5 });
  g.beginFill(l.fill, l.fillAlpha);
  g.drawRoundedRect(-w / 2, -h / 2, w, h, l.radius);
  g.endFill();
}
