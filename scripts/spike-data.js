// M1's hard-coded board (SPEC.md section 6): two cards and one string, placed
// around the middle of whatever rect the board covers. M2 replaces this with
// journal pages.

const ICONICS = "systems/pf2e/icons/iconics";

export function spikeBoard(rect) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    cards: [
      { id: "valeros", name: "Valeros", caption: "Fighter, owes a life", img: `${ICONICS}/Valeros.webp`, x: cx - 600, y: cy - 190, w: 380, h: 132 },
      { id: "seelah", name: "Seelah", caption: "Champion of Iomedae", img: `${ICONICS}/Seelah.webp`, x: cx + 220, y: cy + 60, w: 380, h: 132 }
    ],
    strings: [
      { id: "debt", from: "valeros", to: "seelah", label: "owes a life debt", arrows: "forward", color: null }
    ]
  };
}
