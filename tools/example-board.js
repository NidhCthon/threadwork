// A worked example of M6 (SPEC.md 10): one small mystery laid out on the board
// so every state can be seen at once, and seen from both sides of the screen.
//
// On the Party Board scene, as GM, open the console (F12) and run:
//   await (await import("/modules/threadwork/tools/example-board.js")).run()
//
// Unlike the stress tool this one SAVES: it creates real pages, so a player can
// sign in and see what the table sees. Take it off again with:
//   await (await import("/modules/threadwork/tools/example-board.js")).clear()
import { CARD_SIZE, isBoardJournal, pageType } from "../scripts/data.js";

const FLAG = "example";

/**
 * The mystery. Positions are the centre of each card in board coordinates, in
 * a clear patch away from the middle, so this can be dropped onto a board that
 * already has things on it. `state: "shadowed"` is what the GM knows and the
 * table does not.
 */
export const CARDS = {
  killing: { kind: "hub", x: 2300, y: 1800, words: "A killing on the Nexus docks" },
  kadriss: { kind: "text", x: 1450, y: 1400, words: "Kadriss, dock factor.\nFound the body, reported it late." },
  caravan: { kind: "text", x: 3150, y: 1400, words: "A Guild caravan, three days overdue" },
  ledger: { kind: "text", x: 1450, y: 2300, words: "A salt-stained ledger, half its pages torn" },
  hand: { kind: "text", x: 3150, y: 2300, words: "Vaneha of the Bronze, who pays Kadriss", state: "shadowed" },
  truth: { kind: "text", x: 2300, y: 2700, words: "The ledger records tribute, not cargo", state: "shadowed" }
};

export const STRINGS = [
  { from: "kadriss", to: "killing", label: "found the body at dawn", certainty: "confirmed" },
  { from: "ledger", to: "caravan", label: "lists a shipment that never arrived", certainty: "confirmed" },
  { from: "caravan", to: "kadriss", label: "paid him to look away", certainty: "suspected" },
  { from: "killing", to: "caravan", label: "the Guild wanted him quiet", certainty: "rumored" },
  { from: "kadriss", to: "hand", label: "takes his orders from", state: "shadowed" },
  { from: "ledger", to: "truth", label: "is really a tally of", state: "shadowed" }
];

export const FRAME = { x: 1150, y: 1150, w: 2450, h: 1800, title: "Example: a killing on the Nexus docks" };

const flags = { threadwork: { [FLAG]: true } };

function board() {
  const journal = game.journal.find(isBoardJournal);
  if (!journal) throw new Error("Threadwork | No Party Board journal. Open the Party Board scene once as GM first.");
  return journal;
}

export async function run() {
  if (!game.user.isGM) throw new Error("Threadwork | Only the GM can set up the example.");
  const journal = board();
  if (journal.pages.some((p) => p.getFlag("threadwork", FLAG))) {
    console.warn("Threadwork | The example is already on this board. Run clear() first to replace it.");
    return null;
  }
  const author = game.user.id;

  const [frame] = await journal.createEmbeddedDocuments("JournalEntryPage", [{
    type: pageType("frame"), name: FRAME.title, flags,
    system: { x: FRAME.x, y: FRAME.y, w: FRAME.w, h: FRAME.h, title: FRAME.title, author }
  }]);

  const cardData = Object.entries(CARDS).map(([key, c]) => {
    const { w, h } = CARD_SIZE[c.kind];
    return {
      type: pageType("card"), name: key, flags,
      system: {
        kind: c.kind, uuid: null,
        x: Math.round(c.x - w / 2), y: Math.round(c.y - h / 2), w, h,
        caption: c.words, lastName: "", state: c.state ?? "revealed", author
      }
    };
  });
  const made = await journal.createEmbeddedDocuments("JournalEntryPage", cardData);
  const byKey = new Map(Object.keys(CARDS).map((key, i) => [key, made[i]]));

  const stringData = STRINGS.map((s) => ({
    type: pageType("string"), name: `${s.from} → ${s.to}`, flags,
    system: {
      from: byKey.get(s.from).id, to: byKey.get(s.to).id,
      label: s.label, arrows: "forward",
      state: s.state ?? "revealed", certainty: s.certainty ?? "confirmed",
      author
    }
  }));
  await journal.createEmbeddedDocuments("JournalEntryPage", stringData);

  await canvas.pan({ x: FRAME.x + FRAME.w / 2, y: FRAME.y + FRAME.h / 2, scale: 0.45 });
  console.log(
    "Threadwork | Example set up. You are seeing it as the GM: the two shadowed cards show their real words " +
    "with a SHADOWED badge. Sign in as a player to see ??? instead. clear() takes it off again."
  );
  return { frame: frame.id, cards: made.length, strings: stringData.length };
}

/** Take the example off the board again, leaving anything else on it alone. */
export async function clear() {
  const journal = board();
  const ids = journal.pages.filter((p) => p.getFlag("threadwork", FLAG)).map((p) => p.id);
  if (!ids.length) {
    console.warn("Threadwork | No example pages on this board.");
    return 0;
  }
  await journal.deleteEmbeddedDocuments("JournalEntryPage", ids);
  console.log(`Threadwork | Removed ${ids.length} example pages.`);
  return ids.length;
}
