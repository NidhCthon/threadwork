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
  // Cork is a surface, not a sky: one seamless tile repeated across the board
  // (scripts/draw/cork-surface.js). `nebula` and `stars` are the sky generator's
  // keys and cork has no use for either, so they are null.
  nebula: null,
  stars: null,
  surface: {
    tile: 512,
    // The speckle. Small stretched flecks, light and dark, thick enough to
    // read as a material at table zoom rather than as noise.
    fleck: {
      count: 1500,
      minRadius: 1.2,
      maxRadius: 6.5,
      minStretch: 0.35,
      maxStretch: 1.0,
      colors: [
        { color: 0x8f6a44, alpha: 0.55 },
        { color: 0xa98259, alpha: 0.45 },
        { color: 0x4f3519, alpha: 0.45 },
        { color: 0x3c2711, alpha: 0.38 },
        { color: 0xbb9a72, alpha: 0.3 }
      ]
    },
    // The deeper holes, fewer and darker, that stop it reading as fabric.
    pit: {
      count: 110,
      minRadius: 5,
      maxRadius: 15,
      minStretch: 0.45,
      maxStretch: 1.0,
      colors: [
        { color: 0x33210d, alpha: 0.5 },
        { color: 0x241704, alpha: 0.42 }
      ]
    }
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
    // Paper does not glow. These are a drop shadow under the card, so they
    // stay low: a card given a colour gets a soft edge, not a halo.
    glowAlpha: 0.1,
    hoverGlowAlpha: 0.2,
    hoverBorder: 0xb4342a,
    handleRing: 0xfff8e8,
    portrait: 104,
    portraitBack: 0xe3d6bd,
    ring: 0xb09a74,
    name: { fontFamily: "Signika", fontSize: 34, fontWeight: "600", fill: 0x2b2118 },
    nameMinSize: 22,
    caption: { fontFamily: "Signika", fontSize: 22, fill: 0x6b5a45 }
  },
  // Twine, not light. The colour is the material's, never the author's, and
  // nothing travels along it: a glowing rope is the sky theme's idea. The
  // three certainties separate by how solid the cord looks instead.
  string: {
    color: 0xa8392b,
    authorColours: false,
    width: 7,
    midWidth: 7,
    midAlpha: 0.2,
    glowWidth: 0,
    glowAlpha: 0,
    pad: 10,
    arrow: 22,
    fibre: {
      edge: 0x47180f,
      edgeWidth: 10,
      edgeAlpha: 0.85,
      sheen: 0xe8a07f,
      sheenWidth: 2.4,
      sheenAlpha: 0.5
    },
    flow: { color: 0xffe8b8, alpha: 0, pulses: 1, speed: 170, trail: 1, spacing: 7, radius: 1 },
    certainty: {
      rumored: { alpha: 0.75, dash: 15, gap: 12, flow: false },
      suspected: { alpha: 0.88, dash: 0, gap: 0, flow: false },
      confirmed: { alpha: 1, dash: 0, gap: 0, flow: false }
    }
  },
  shadow: { alpha: 0.72 },
  // A pin through the top of every card.
  pin: {
    show: true,
    radius: 11,
    shaft: 3,
    head: 0xc23a2b,
    shine: 0xffd9cf,
    shineAlpha: 0.75,
    steel: 0x9aa3ad,
    shadow: 0x2a1b0c,
    shadowAlpha: 0.38
  },
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
    glowAlpha: 0.12,
    hoverGlowAlpha: 0.22,
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
