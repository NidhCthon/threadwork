// A crowded board for M4's performance check (SPEC.md Goal 3): 60 cards and
// 100 strings by default, spread over `rect`, the same every time.
import { mulberry32 } from "../../scripts/draw/starfield.js";

const ICONICS = "systems/pf2e/icons/iconics";
const PORTRAITS = ["Valeros", "Seelah", "Kyra", "Merisiel", "Amiri", "Ezren", "Harsk", "Feiya", "Daji", "Droven"];
const WORDS = ["owes a debt", "sworn enemy", "old friends", "suspects", "loves", "serves", "fears", "", "hunts", "saved", "", "trusts"];

export function stressBoard(rect, cardCount = 60, stringCount = 100) {
  const rand = mulberry32(60100);
  const columns = Math.ceil(Math.sqrt(cardCount * (rect.width / rect.height)));
  const rows = Math.ceil(cardCount / columns);
  const cellW = rect.width / columns;
  const cellH = rect.height / rows;
  const cards = [];
  for (let i = 0; i < cardCount; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const kind = i % 10 === 9 ? "hub" : (i % 5 === 4 ? "text" : "document");
    const size = { document: [380, 132], text: [340, 96], hub: [440, 150] }[kind];
    cards.push({
      id: `c${i}`,
      kind,
      name: kind === "document" ? `${PORTRAITS[i % PORTRAITS.length]} ${i}` : kind === "hub" ? "Concept" : "Note",
      caption: kind === "document" ? "A character of some note" : kind === "hub" ? `Shared idea ${i}` : `A note about thing ${i}, with a second line`,
      img: kind === "document" ? `${ICONICS}/${PORTRAITS[i % PORTRAITS.length]}.webp` : null,
      x: rect.x + col * cellW + (cellW - size[0]) * rand(),
      y: rect.y + row * cellH + (cellH - size[1]) * rand(),
      w: size[0],
      h: size[1],
      visibility: "everyone"
    });
  }
  const strings = [];
  for (let i = 0; i < stringCount; i++) {
    const a = Math.floor(rand() * cardCount);
    // Mostly to nearby cards, like a real board, with some long ones.
    const near = rand() < 0.75;
    let b = near ? a + 1 + Math.floor(rand() * 4) + (rand() < 0.5 ? columns : 0) : Math.floor(rand() * cardCount);
    b = ((b % cardCount) + cardCount) % cardCount;
    if (b === a) b = (a + 1) % cardCount;
    strings.push({ id: `s${i}`, from: `c${a}`, to: `c${b}`, label: WORDS[i % WORDS.length], arrows: ["forward", "both", "none"][i % 3], color: null });
  }
  const frames = [0, 1, 2, 3, 4].map((i) => ({
    id: `f${i}`, x: rect.x + (i % 3) * rect.width / 3 + 40, y: rect.y + Math.floor(i / 3) * rect.height / 2 + 40,
    w: rect.width / 3 - 80, h: rect.height / 2 - 80, title: `Frame ${i + 1}`, color: null, visibility: "everyone", locked: false
  }));
  return { cards, strings, frames };
}
