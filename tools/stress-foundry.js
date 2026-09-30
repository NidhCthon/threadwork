// M4's hands-on performance check (SPEC.md Goal 3), for a real, visible browser.
//
// On the board scene, open the browser console (F12) and run:
//   await (await import("/modules/threadwork/tools/stress-foundry.js")).run()
//
// It adds a 60-card, 100-string board to your view only (nothing is saved, and
// a reload clears it), lets you pan and drag for a few seconds, then reports
// the real frame rate from requestAnimationFrame. Pass {seconds, cards,
// strings} to change the test, e.g. run({ seconds: 10 }).
import { stressBoard } from "./preview/stress-board.js";

const PREFIX = "stress-";

export async function run({ seconds = 5, cards = 60, strings = 100 } = {}) {
  const view = globalThis.canvas?.threadwork?.view;
  if (!view) {
    console.warn("Threadwork | Open the Party Board scene first.");
    return null;
  }
  const rect = { x: 900, y: 1300, width: 5200, height: 3200 };
  const board = stressBoard(rect, cards, strings);
  for (const f of board.frames) view.addFrame({ ...f, id: PREFIX + f.id }, { animate: false });
  for (const c of board.cards) await view.addCard({ ...c, id: PREFIX + c.id }, { animate: false });
  for (const s of board.strings) view.addString({ ...s, id: PREFIX + s.id, from: PREFIX + s.from, to: PREFIX + s.to }, { animate: false });
  await canvas.pan({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, scale: 0.5 });
  console.log(`Threadwork | Measuring for ${seconds} s. Pan, zoom and drag cards while it runs.`);

  const frames = [];
  await new Promise((done) => {
    let last = performance.now();
    const end = last + seconds * 1000;
    const tick = (now) => {
      frames.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });

  const sorted = [...frames].sort((a, b) => a - b);
  const avg = frames.reduce((s, v) => s + v, 0) / frames.length;
  const result = {
    cards: view.cards.size,
    strings: view.strings.size,
    fps: Math.round(1000 / avg),
    averageFrameMs: +avg.toFixed(1),
    slowest5PercentMs: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
    framesOver33ms: frames.filter((f) => f > 33.4).length,
    frames: frames.length
  };
  console.table(result);
  return result;
}

/** Take the stress board back off, without reloading. */
export function clear() {
  const view = globalThis.canvas?.threadwork?.view;
  if (!view) return;
  for (const id of [...view.strings.keys()]) if (id.startsWith(PREFIX)) view.removeString(id, { animate: false });
  for (const id of [...view.cards.keys()]) if (id.startsWith(PREFIX)) view.removeCard(id, { animate: false });
  for (const id of [...view.frames.keys()]) if (id.startsWith(PREFIX)) view.removeFrame(id, { animate: false });
}
