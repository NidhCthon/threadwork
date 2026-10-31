// A cork surface, as one small seamless tile repeated across the board.
//
// Constellation's sky is thousands of sprites because its stars twinkle
// individually. Cork does not move, so sprites would be pure cost: a tile
// drawn once and repeated is a single draw call whatever the board's size,
// and it can carry grain far finer than the quarter-resolution bake the sky
// uses, because the tile is painted at its own full resolution.
import { mulberry32 } from "./starfield.js";

/**
 * The grains on one tile: cork's speckle, as small rotated ellipses in varied
 * browns, plus a few larger pits. Pure, and seeded, so the surface is the same
 * every time. Coordinates are within `tile`; wrapping is the painter's job.
 */
export function corkGrains(tile, surface, seed = 20261031) {
  const rand = mulberry32(seed);
  const grains = [];
  const make = (spec, count, kind) => {
    for (let i = 0; i < count; i++) {
      const { color, alpha } = spec.colors[Math.floor(rand() * spec.colors.length)];
      // Cork's flecks are stretched, not round, and all lie at their own angle.
      const r = spec.minRadius + (spec.maxRadius - spec.minRadius) * rand() ** 1.6;
      grains.push({
        kind,
        x: rand() * tile,
        y: rand() * tile,
        rx: r,
        ry: r * (spec.minStretch + (spec.maxStretch - spec.minStretch) * rand()),
        rotation: rand() * Math.PI,
        color,
        alpha: alpha * (0.55 + 0.45 * rand())
      });
    }
  };
  make(surface.fleck, surface.fleck.count, "fleck");
  make(surface.pit, surface.pit.count, "pit");
  return grains;
}

const css = (color, alpha) => `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha.toFixed(3)})`;

/**
 * Paint the grains onto a tile-sized 2D context. Every grain is drawn again at
 * each wrapped offset, so a grain crossing an edge continues on the far side
 * and the tile repeats with no visible seam or grid.
 */
export function paintCorkTile(ctx, tile, grains, background) {
  ctx.fillStyle = css(background, 1);
  ctx.fillRect(0, 0, tile, tile);
  for (const g of grains) {
    ctx.fillStyle = css(g.color, g.alpha);
    for (const dx of [-tile, 0, tile]) {
      for (const dy of [-tile, 0, tile]) {
        // Only the grains near an edge need their wrapped copies drawn.
        if (dx !== 0 && Math.min(g.x, tile - g.x) > g.rx + g.ry) continue;
        if (dy !== 0 && Math.min(g.y, tile - g.y) > g.rx + g.ry) continue;
        ctx.beginPath();
        ctx.ellipse(g.x + dx, g.y + dy, g.rx, g.ry, g.rotation, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/** The tile as a PIXI texture. Browser only. */
export function makeCorkTexture(PIXI, theme) {
  const { tile } = theme.surface;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = tile;
  paintCorkTile(canvas.getContext("2d"), tile, corkGrains(tile, theme.surface), theme.background);
  return PIXI.Texture.from(canvas);
}
