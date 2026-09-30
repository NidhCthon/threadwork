// The night sky behind the board: plain star and nebula data from a seed,
// plus the one soft-dot texture every star and nebula sprite is cut from.

const TAU = Math.PI * 2;

/** A small seeded random generator, so the same board always gets the same sky. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stars and nebulae for `rect` ({x, y, width, height}). */
export function starfieldData(rect, theme, seed = 1348) {
  const sky = theme.stars;
  const rand = mulberry32(seed);
  const count = Math.round(rect.width * rect.height * sky.density);
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rect.x + rand() * rect.width,
      y: rect.y + rand() * rect.height,
      // Cubed so most stars are faint pinpricks and a few are bright.
      r: sky.minRadius + (sky.maxRadius - sky.minRadius) * rand() ** 3,
      color: sky.colors[Math.floor(rand() * sky.colors.length)],
      base: 0.35 + 0.65 * rand(),
      twinkle: rand() < sky.twinkleShare,
      speed: 0.6 + rand() * 1.8,
      phase: rand() * TAU
    });
  }
  const cloud = theme.nebula;
  const clouds = Math.max(cloud.minCount, Math.round(rect.width * rect.height * cloud.density));
  const nebulae = [];
  for (let i = 0; i < clouds; i++) {
    const { color, alpha } = cloud.colors[i % cloud.colors.length];
    nebulae.push({
      x: rect.x + rand() * rect.width,
      y: rect.y + rand() * rect.height,
      r: cloud.minRadius + (cloud.maxRadius - cloud.minRadius) * rand(),
      color,
      alpha
    });
  }
  return { stars, nebulae };
}

/** A star's brightness at `time` seconds. Twinkling stars never fall below 10% of their base. */
export function starAlpha(star, time) {
  if (!star.twinkle) return star.base;
  return star.base * (0.55 + 0.45 * Math.sin(time * star.speed + star.phase));
}

/** A white radial dot, bright in the middle and gone at the rim. Browser only. */
export function makeGlowTexture(PIXI, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas);
}
