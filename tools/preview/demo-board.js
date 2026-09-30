// The preview's board: the M1 feel-test cards and string, plus a third
// character, a note, a concept and a frame, placed around the middle of the
// preview's rect. In Foundry the board comes from the journal instead.

const ICONICS = "systems/pf2e/icons/iconics";

export function demoBoard(rect) {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const doc = (id, name, caption, img, x, y, extra = {}) => ({ id, kind: "document", name, caption, img: `${ICONICS}/${img}`, x, y, w: 380, h: 132, ...extra });
  return {
    frames: [
      { id: "grayce", x: cx - 660, y: cy - 290, w: 520, h: 640, title: "Troubles in Grayce", color: null, visibility: "everyone", locked: false }
    ],
    cards: [
      doc("valeros", "Valeros", "Fighter, owes a life", "Valeros.webp", cx - 600, cy - 190),
      doc("seelah", "Seelah", "Champion of Iomedae", "Seelah.webp", cx + 220, cy + 60, { locked: true }),
      doc("kyra", "Kyra", "Cleric of Sarenrae", "Kyra.webp", cx - 600, cy + 100, { visibility: "private" }),
      { id: "oath", kind: "hub", name: "Concept", caption: "The oath at the ford", x: cx + 180, y: cy - 320, w: 440, h: 150, color: 0xffa46b },
      { id: "rumour", kind: "text", name: "Note", caption: "Someone paid the ferryman twice. Ask Oskar who.", x: cx + 260, y: cy + 290, w: 340, h: 96, visibility: "gm" }
    ],
    strings: [
      { id: "debt", from: "valeros", to: "seelah", label: "owes a life debt", arrows: "forward", color: null },
      { id: "sworn", from: "valeros", to: "oath", label: "swore it", arrows: "forward", color: 0xffa46b },
      { id: "sworn2", from: "seelah", to: "oath", label: "witnessed", arrows: "none", color: 0xffa46b }
    ]
  };
}
