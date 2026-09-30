// The preview's board: the M1 feel-test cards and string, plus a third card to
// draw strings to, placed around the middle of the preview's rect. In Foundry
// the board comes from the journal instead.

const ICONICS = "systems/pf2e/icons/iconics";

export function demoBoard(rect) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    cards: [
      { id: "valeros", name: "Valeros", caption: "Fighter, owes a life", img: `${ICONICS}/Valeros.webp`, x: cx - 600, y: cy - 190, w: 380, h: 132 },
      { id: "seelah", name: "Seelah", caption: "Champion of Iomedae", img: `${ICONICS}/Seelah.webp`, x: cx + 220, y: cy + 60, w: 380, h: 132 },
      { id: "kyra", name: "Kyra", caption: "Cleric of Sarenrae", img: `${ICONICS}/Kyra.webp`, x: cx - 540, y: cy + 250, w: 380, h: 132 }
    ],
    strings: [
      { id: "debt", from: "valeros", to: "seelah", label: "owes a life debt", arrows: "forward", color: null }
    ]
  };
}
