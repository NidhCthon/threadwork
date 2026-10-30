// The second theme (SPEC.md 5.6): a detective's corkboard — brown cork, cream
// index cards, red twine, dark ink. Same shape as constellation.js, key for
// key, because that shape is the whole contract between a theme and the board.
//
// Two keys keep their constellation names for what cork uses them as, since
// the generator in draw/starfield.js makes exactly what both themes need —
// soft blobs and small dots from a seed:
//   `nebula` is the cork's mottling, patches where the surface is lighter or darker
//   `stars`  is its grain, small dark flecks that do not twinkle

export const cork = {
  id: "cork",
  // Not `label`: that key is the string-tag config further down.
  title: "Cork",
  background: 0x6b4a2c,
  // Broad patches of lighter and darker cork, so a big board is never a flat
  // brown field. Baked into the backdrop texture, like constellation's clouds.
  nebula: {
    density: 1 / 1500000,
    minCount: 4,
    minRadius: 420,
    maxRadius: 1100,
    colors: [
      { color: 0x8a6440, alpha: 0.22 },
      { color: 0x5a3d22, alpha: 0.18 },
      { color: 0x9c7550, alpha: 0.14 },
      { color: 0x4d3419, alpha: 0.12 }
    ]
  },
  // Cork grain: smaller than stars and dark rather than bright, with
  // twinkleShare 0 so none of it moves — the board's life comes from the cards
  // drifting and the light on the twine, not from the surface.
  //
  // The density deliberately matches constellation's. Grain is one static
  // sprite each, and that is the sky budget M4 profiled; a finer grain looked
  // better and cost 55% more sprites, which is the wrong trade on a board that
  // already stutters slightly on this laptop.
  stars: {
    density: 1 / 14000,
    colors: [0x4a3219, 0x3d2912, 0x5c4026, 0x2f2010],
    minRadius: 0.5,
    maxRadius: 1.7,
    twinkleShare: 0
  },
  // Index cards: cream paper, square-ish corners, a soft drop shadow where
  // constellation has a glow.
  card: {
    radius: 5,
    fill: 0xf2e8d5,
    fillAlpha: 1,
    border: 0x8a7556,
    borderAlpha: 0.9,
    borderWidth: 2,
    glow: 0x2a1b0c,
    glowAlpha: 0.18,
    hoverGlowAlpha: 0.32,
    hoverBorder: 0xb4342a,
    handleRing: 0xfff8e8,
    portrait: 104,
    portraitBack: 0xe3d6bd,
    ring: 0xb09a74,
    name: { fontFamily: "Signika", fontSize: 34, fontWeight: "600", fill: 0x2b2118 },
    nameMinSize: 22,
    caption: { fontFamily: "Signika", fontSize: 22, fill: 0x6b5a45 }
  },
  // Red twine. The travelling light stays, because it is how a confirmed
  // string reads at a glance, but it is a warm sheen rather than starlight.
  string: {
    color: 0xb4342a,
    width: 3,
    midWidth: 7,
    midAlpha: 0.2,
    glowWidth: 12,
    glowAlpha: 0.08,
    pad: 10,
    arrow: 20,
    flow: { color: 0xffe8b8, alpha: 0.45, pulses: 3, speed: 170, trail: 9, spacing: 7, radius: 4.2 },
    certainty: {
      rumored: { alpha: 0.6, dash: 17, gap: 13, flow: false },
      suspected: { alpha: 0.82, dash: 0, gap: 0, flow: false },
      confirmed: { alpha: 1, dash: 0, gap: 0, flow: true }
    }
  },
  shadow: { alpha: 0.72 },
  // Light surface, dark ink: the inverse of constellation, which the
  // stylesheet handles because it reads every colour from these properties.
  ui: {
    surface: 0xf2e8d5,
    text: 0x2b2118,
    muted: 0x6b5a45,
    accent: 0xb4342a,
    border: 0x8a7556,
    glow: 0x2a1b0c,
    danger: 0xa8201a
  },
  palette: [0xb4342a, 0x1f6f5c, 0x2b4a8a, 0x8a5a1f, 0x6b3a7a, 0x3d6b1f, 0x2b2118, 0xf2e8d5],
  hub: {
    borderWidth: 3,
    glowAlpha: 0.26,
    hoverGlowAlpha: 0.42,
    padX: 26,
    padY: 24,
    text: { fontFamily: "Signika", fontSize: 40, fontWeight: "600", fill: 0x2b2118, align: "center", wordWrap: true, lineHeight: 48 }
  },
  note: {
    padX: 22,
    padY: 18,
    text: { fontFamily: "Signika", fontSize: 24, fill: 0x2b2118, wordWrap: true, lineHeight: 31 },
    placeholder: 0x9c8a70
  },
  // A frame's border and title sit on the cork itself, not on paper, so both
  // are light enough to read against brown.
  frame: {
    fill: 0x3d2912,
    fillAlpha: 0.14,
    borderAlpha: 0.7,
    borderWidth: 2,
    radius: 8,
    titleBand: 64,
    grip: 30,
    minW: 360,
    minH: 240,
    color: 0xc9b48e,
    title: { fontFamily: "Signika", fontSize: 32, fontWeight: "600", fill: 0xf5ecd8 }
  },
  badge: {
    text: { fontFamily: "Signika", fontSize: 15, fontWeight: "700", fill: 0x2b2118, letterSpacing: 1 },
    gm: 0xe0a93b,
    private: 0xa878bd,
    locked: 0xc9b48e,
    shadowed: 0x5fb89a,
    rumored: 0xb3a38c,
    suspected: 0xd9a24a
  },
  guide: { color: 0xb4342a, alpha: 0.85, width: 1.5 },
  // A paper tag tied to the twine.
  label: {
    fill: 0xf2e8d5,
    fillAlpha: 0.96,
    borderAlpha: 0.8,
    radius: 4,
    padX: 16,
    padY: 8,
    minWidth: 44,
    text: { fontFamily: "Signika", fontSize: 24, fill: 0x2b2118 }
  }
};
