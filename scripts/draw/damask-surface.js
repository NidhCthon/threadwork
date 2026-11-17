// Elysium's surface: crimson velvet with a damask pattern woven into it, as
// one seamless tile repeated across the board, like cork's (see
// cork-surface.js for why a tile and not sprites).
//
// The pattern is the classic ogee: wavy vertical lines whose bulges alternate,
// so neighbouring columns enclose a row of lozenges, and a stylised flower sits
// in every other lozenge. It repeats every two columns and two rows, which is
// exactly one tile.
import { mulberry32 } from "./starfield.js";

/**
 * Everything on one tile, as plain data. `waves` are the column segments, each
 * running one row down from (x0, y0) and bulging `dir` (+1 right, -1 left).
 * Column 2 is column 0 again at the tile's right edge, drawn so a bulge that
 * leaves the left edge comes back in on the right. `motifs` are flower
 * centres; `nap` is the velvet's fine speckle. Pure and seeded.
 */
export function damaskTile(surface, seed = 20261116) {
  const { w: cw, h: ch } = surface.cell;
  const width = cw * 2;
  const height = ch * 2;
  const odd = (n) => n % 2 === 1;
  const waves = [];
  for (let i = 0; i <= 2; i++) {
    for (let j = 0; j < 2; j++) waves.push({ x0: i * cw, y0: j * ch, dir: odd(i + j) ? 1 : -1 });
  }
  const motifs = [{ x: cw / 2, y: ch / 2 }, { x: cw * 1.5, y: ch * 1.5 }];
  const rand = mulberry32(seed);
  const nap = [];
  for (let k = 0; k < surface.nap.count; k++) nap.push({ x: rand() * width, y: rand() * height, light: k % 2 === 0 });
  return { width, height, cell: { w: cw, h: ch }, waves, motifs, nap };
}

const css = (color, alpha) => `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha.toFixed(3)})`;

/** A damask flower: a pointed bud, two side leaves and a stem, centred on cx, cy. */
function flower(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.bezierCurveTo(cx + s * 0.55, cy - s * 0.55, cx + s * 0.75, cy + s * 0.25, cx, cy + s * 0.85);
  ctx.bezierCurveTo(cx - s * 0.75, cy + s * 0.25, cx - s * 0.55, cy - s * 0.55, cx, cy - s);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * s * 0.66, cy + s * 0.12, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(cx - s * 0.04, cy + s * 0.8, s * 0.08, s * 0.32);
}

/** Paint the tile onto a 2D context the tile's size. */
export function paintDamaskTile(ctx, tile, surface) {
  const { w: cw, h: ch } = tile.cell;
  ctx.fillStyle = css(surface.base, 1);
  ctx.fillRect(0, 0, tile.width, tile.height);
  const { line, motif, nap } = surface;
  ctx.strokeStyle = css(line.color, line.alpha);
  ctx.lineWidth = line.width;
  for (const { x0, y0, dir } of tile.waves) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0 + dir * cw * 0.42, y0 + ch * 0.18, x0 + dir * cw * 0.42, y0 + ch * 0.82, x0, y0 + ch);
    ctx.stroke();
  }
  ctx.fillStyle = css(motif.color, motif.alpha);
  for (const { x, y } of tile.motifs) flower(ctx, x, y, motif.size);
  for (const { x, y, light } of tile.nap) {
    ctx.fillStyle = light ? css(nap.light, nap.lightAlpha) : css(nap.dark, nap.darkAlpha);
    ctx.fillRect(x, y, nap.size, nap.size);
  }
}

/** The tile as a PIXI texture. Browser only. */
export function makeDamaskTexture(PIXI, theme) {
  const tile = damaskTile(theme.surface);
  const canvas = document.createElement("canvas");
  canvas.width = tile.width;
  canvas.height = tile.height;
  paintDamaskTile(canvas.getContext("2d"), tile, theme.surface);
  return PIXI.Texture.from(canvas);
}
