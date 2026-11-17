// The third theme (SPEC.md 14): Elysium, a court's salon. Crimson damask
// velvet, cream cards ruled in gilt, oval sepia cameos, wax seals and crimson
// silk ribbons, set in gilt picture frames. A world can hang a painting
// behind the velvet (the "Party Board painting" setting); without one the
// pattern stands alone. Same shape as constellation.js, key for key.

export const elysium = {
  id: "elysium",
  // Not `label`: that key is the string-tag config further down.
  title: "Elysium",
  background: 0x1a080d,
  nebula: null,
  stars: null,
  // Velvet, as one seamless tile (scripts/draw/damask-surface.js): a dark
  // crimson ground, the damask's wavy columns and flowers a shade lighter,
  // and a fine nap of light and dark specks.
  surface: {
    kind: "damask",
    cell: { w: 160, h: 224 },
    base: 0x1f0a10,
    line: { color: 0x96344a, alpha: 0.24, width: 2.4 },
    motif: { color: 0x96344a, alpha: 0.18, size: 50 },
    nap: { count: 2600, size: 1.8, light: 0xffd2d7, lightAlpha: 0.035, dark: 0x000000, darkAlpha: 0.18 }
  },
  // The painting behind the velvet, when the world has one: toned down so it
  // sits behind the cards, with the velvet laid over it at `veil` opacity.
  backdrop: {
    tone: { brightness: 0.7, saturate: 0.85, sepia: 0.15 },
    veil: 0.5
  },
  // Cream card stock with a gilt edge and a gilt rule inside it. Paper does
  // not glow: the "glow" is a dark drop shadow, as on cork.
  card: {
    radius: 3,
    fill: 0xefe6d2,
    fillAlpha: 1,
    border: 0xb8933e,
    borderAlpha: 0.9,
    borderWidth: 1.5,
    glow: 0x000000,
    glowAlpha: 0.2,
    hoverGlowAlpha: 0.34,
    hoverBorder: 0x9e1b2c,
    handleRing: 0xfff4dc,
    portrait: 104,
    portraitBack: 0x2a1117,
    ring: 0xc9a24a,
    rule: { inset: 7, width: 1.5, color: 0xb8933e, alpha: 1 },
    // Portraits as oval cameos, toned sepia and darkened towards the rim, so
    // art from anywhere looks like one set.
    cameo: {
      aspect: 0.84,
      ringWidth: 3.5,
      outer: 0x7a5a1e,
      outerAlpha: 0.85,
      outerGap: 4.5,
      tone: { brightness: 0.95, contrast: 1.06, sepia: 0.55 },
      shade: 0x321408,
      shadeAlpha: 0.45
    },
    name: { fontFamily: "Cinzel", fontSize: 28, fontWeight: "600", fill: 0x2b1a14 },
    nameMinSize: 20,
    caption: { fontFamily: "Cormorant Garamond", fontSize: 25, fontStyle: "italic", fontWeight: "500", fill: 0x6e4f43 }
  },
  // Crimson silk ribbon: the material's colour, never the author's, with a
  // cast shadow so it lies on the painting. A slow gold glint travels along
  // a confirmed one.
  string: {
    color: 0x7a0e1c,
    authorColours: false,
    width: 6,
    midWidth: 6,
    midAlpha: 0.2,
    glowWidth: 0,
    glowAlpha: 0,
    pad: 10,
    arrow: 20,
    fibre: {
      edge: 0x2a0308,
      edgeWidth: 8,
      edgeAlpha: 0.55,
      sheen: 0xec5c6c,
      sheenWidth: 2.1,
      sheenAlpha: 0.7,
      drop: { x: 2, y: 4, color: 0x000000, alpha: 0.42 }
    },
    flow: { color: 0xfff4cd, alpha: 0.85, pulses: 2, speed: 55, trail: 1, spacing: 7, radius: 5 },
    certainty: {
      rumored: { alpha: 0.85, dash: 12, gap: 13, flow: false },
      suspected: { alpha: 0.85, dash: 0, gap: 0, flow: false },
      confirmed: { alpha: 1, dash: 0, gap: 0, flow: true }
    }
  },
  shadow: { alpha: 0.72 },
  // Sealed, not pinned.
  pin: null,
  // A wax seal across the top of every card but a concept's, near its right
  // corner. It carries the card's emblem when it has one (`emblem.place`),
  // and a stamped flower when it does not.
  seal: {
    radius: 20,
    right: 44,
    // Centred just above the edge, so even a two-line name clears it.
    top: -2,
    points: 24,
    jitter: 0.18,
    dark: 0x5e0a14,
    wax: 0x9a1a29,
    waxAlpha: 0.16,
    light: 0xc23345,
    lightAlpha: 0.28,
    ring: 0x3c040a,
    ringAlpha: 0.8,
    shine: 0xffaaaa,
    shineAlpha: 0.22,
    shadow: 0x000000,
    shadowAlpha: 0.5,
    mark: 0x3c040a,
    markAlpha: 0.75
  },
  // The emblem goes in the seal, as gold leaf pressed into the wax: a dark
  // shadow under it, the gold, then a faint shine. `radius` is the seal's
  // size when it carries one. `fill`, `ring` and `glow` are the rim disc's,
  // which a seal never draws; they match the wax.
  emblem: {
    place: "seal",
    radius: 26,
    fill: 0x5e0a14,
    ring: 0x3c040a,
    ringWidth: 1.6,
    glow: 0x000000,
    glowAlpha: 0.5,
    ink: 0xe2bd62,
    inset: 0.6,
    leaf: { shadow: 0x280206, shadowAlpha: 0.85, shine: 0xfff6d6, shineAlpha: 0.35, offset: 1.2 }
  },
  // The menus and editors: velvet with gold lettering.
  ui: {
    surface: 0x1c0a0f,
    text: 0xf3e7c9,
    muted: 0xc4ad86,
    accent: 0xe2bd62,
    border: 0xc9a24a,
    glow: 0x9e1b2c,
    danger: 0xff9a9a
  },
  palette: [0x9e1b2c, 0xc9a24a, 0x2f6b5a, 0x2b4a8a, 0x6b3a7a, 0x8a5a1f, 0x2b1a14, 0xefe6d2],
  // A concept: a crimson plate in a gilt edge, its words in gilt capitals.
  hub: {
    fill: 0x5a0b16,
    borderWidth: 3,
    glowAlpha: 0.24,
    hoverGlowAlpha: 0.36,
    padX: 28,
    padY: 26,
    text: { fontFamily: "Cinzel", fontSize: 34, fontWeight: "700", fill: 0xf3e7c9, align: "center", wordWrap: true, lineHeight: 44, letterSpacing: 2 }
  },
  note: {
    padX: 24,
    padY: 20,
    text: { fontFamily: "Cormorant Garamond", fontSize: 28, fontWeight: "500", fill: 0x2b1a14, wordWrap: true, lineHeight: 34 },
    placeholder: 0x9c8466
  },
  // A gilt picture frame with a dark band for its title.
  frame: {
    fill: 0x000000,
    fillAlpha: 0.28,
    borderAlpha: 1,
    borderWidth: 11,
    radius: 0,
    titleBand: 70,
    grip: 30,
    minW: 360,
    minH: 240,
    color: 0xc9a24a,
    title: { fontFamily: "Cinzel", fontSize: 30, fontWeight: "700", fill: 0xe6c66f, letterSpacing: 4 },
    gilt: { inner: 0x5a3f12, outer: 0xf0d78c, outerAlpha: 0.55, band: 0x0c0507, bandAlpha: 0.85, stud: 8 }
  },
  badge: {
    text: { fontFamily: "Signika", fontSize: 15, fontWeight: "700", fill: 0x2b1a14, letterSpacing: 1 },
    gm: 0xe2bd62,
    private: 0xb48cc8,
    locked: 0xc4ad86,
    shadowed: 0x7fc4a8,
    rumored: 0xb8a58a,
    suspected: 0xd9a24a
  },
  guide: { color: 0xe2bd62, alpha: 0.85, width: 1.5 },
  // A cream tag on the ribbon, its words in italic.
  label: {
    fill: 0xefe6d2,
    fillAlpha: 0.97,
    borderAlpha: 0.9,
    radius: 3,
    padX: 16,
    padY: 7,
    minWidth: 44,
    text: { fontFamily: "Cormorant Garamond", fontSize: 26, fontStyle: "italic", fontWeight: "500", fill: 0x3a241b }
  }
};
