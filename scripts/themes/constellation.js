// The default theme (SPEC.md 5.6). Every colour, size and glow the board
// draws comes from here, so a second theme is one more file like this.
// On-board text is sized big on purpose: it has to read at table zoom.

export const constellation = {
  id: "constellation",
  background: 0x060818,
  // Many medium clouds rather than a few huge ones, so every view of a big
  // board has colour in it, not one faint smudge.
  nebula: {
    density: 1 / 1500000,
    minCount: 3,
    minRadius: 500,
    maxRadius: 1300,
    colors: [
      { color: 0x2b43a8, alpha: 0.26 },
      { color: 0x7a2fa0, alpha: 0.2 },
      { color: 0x1d7f9e, alpha: 0.18 },
      { color: 0xa0306e, alpha: 0.12 }
    ]
  },
  stars: {
    density: 1 / 14000,
    colors: [0xffffff, 0xd4e3ff, 0xffe9c9, 0xbcd2ff],
    minRadius: 0.6,
    maxRadius: 2.4,
    twinkleShare: 0.35
  },
  card: {
    radius: 18,
    fill: 0x0d1330,
    fillAlpha: 0.94,
    border: 0x86aaff,
    borderAlpha: 0.85,
    borderWidth: 2,
    glow: 0x5a82ff,
    glowAlpha: 0.16,
    hoverGlowAlpha: 0.34,
    portrait: 104,
    ring: 0xa9c4ff,
    name: { fontFamily: "Signika", fontSize: 34, fontWeight: "600", fill: 0xf2f5ff },
    caption: { fontFamily: "Signika", fontSize: 22, fill: 0xa9b6de }
  },
  string: {
    color: 0x8ec5ff,
    width: 3,
    midWidth: 7,
    midAlpha: 0.26,
    glowWidth: 14,
    glowAlpha: 0.12,
    pad: 10,
    arrow: 20,
    flow: { color: 0xffffff, alpha: 0.9, pulses: 3, speed: 170, trail: 9, spacing: 7, radius: 4.2 }
  },
  label: {
    fill: 0x0a0f26,
    fillAlpha: 0.94,
    borderAlpha: 0.85,
    radius: 12,
    padX: 16,
    padY: 8,
    minWidth: 44,
    text: { fontFamily: "Signika", fontSize: 24, fill: 0xe9eeff }
  }
};
