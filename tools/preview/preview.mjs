// Runs the board's real drawing and motion code (scripts/board-view.js) in a
// plain PIXI 7.4.3 app, without Foundry. The board is centred in the window at
// 1:1; the label editor is an input over the canvas, like the HUD in Foundry.
import { BoardView } from "../../scripts/board-view.js";
import { prefersReducedMotion } from "../../scripts/motion.js";
import { spikeBoard } from "../../scripts/spike-data.js";
import { constellation } from "../../scripts/themes/constellation.js";

await document.fonts.load(`${constellation.card.name.fontSize}px Signika`);

const app = new PIXI.Application({
  resizeTo: window,
  antialias: true,
  backgroundColor: constellation.background,
  resolution: window.devicePixelRatio,
  autoDensity: true
});
document.getElementById("board").append(app.view);
app.stage.eventMode = "static";
app.stage.hitArea = app.screen;

// Big enough for the spike's two cards; scaled down to fit a smaller window,
// never up, so on a large screen it is 1:1 like the board at default zoom.
const rect = { x: 0, y: 0, width: 1700, height: 1000 };
const root = app.stage.addChild(new PIXI.Container());
const hud = document.getElementById("hud");
const centre = () => {
  const scale = Math.min(1, window.innerWidth / rect.width, window.innerHeight / rect.height);
  root.scale.set(scale);
  root.position.set(Math.round((window.innerWidth - rect.width * scale) / 2), Math.round((window.innerHeight - rect.height * scale) / 2));
  hud.style.transform = `translate(${root.position.x}px, ${root.position.y}px) scale(${scale})`;
};
centre();
window.addEventListener("resize", centre);

const hex = (color) => `#${color.toString(16).padStart(6, "0")}`;

function editText({ x, y, value, color, fontSize }) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "threadwork-label-input";
  input.value = value;
  Object.assign(input.style, { left: `${x}px`, top: `${y}px`, fontSize: `${fontSize}px`, borderColor: hex(color) });
  hud.append(input);
  input.focus();
  input.select();
  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(result);
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") finish(input.value);
      else if (event.key === "Escape") finish(null);
    });
    input.addEventListener("blur", () => finish(input.value));
  });
}

const view = new BoardView({
  PIXI,
  root,
  theme: constellation,
  rect,
  ...spikeBoard(rect),
  makeText: (text, style) => {
    const t = new PIXI.Text(text, style);
    t.resolution = 2 * window.devicePixelRatio;
    return t;
  },
  // Relative paths are Foundry data paths; the local Foundry serves them from its root.
  loadTexture: (src) => PIXI.Assets.load(/^(\/|https?:)/.test(src) ? src : `/${src}`),
  editText,
  reducedMotion: prefersReducedMotion()
});
await view.build();
app.ticker.add(() => view.update(app.ticker.deltaMS / 1000));

const motion = document.getElementById("motion");
const label = () => { motion.textContent = view.reducedMotion ? "Full motion" : "Reduce motion"; };
motion.addEventListener("click", () => { view.setReducedMotion(!view.reducedMotion); label(); });
label();

/**
 * Freeze the board `seconds` into its animation, render, and save the frame
 * through serve.mjs. Ticker-driven pages can time out ordinary screenshots,
 * and a background window may not draw at all; this works either way.
 */
async function snapshot(name = "frame", seconds = 1.3) {
  app.ticker.stop();
  view.update(seconds);
  app.render();
  const dataUrl = await app.renderer.extract.base64(app.stage);
  const saved = await fetch(`/__snapshot?name=${encodeURIComponent(name)}`, { method: "POST", body: dataUrl }).then((r) => r.text());
  app.ticker.start();
  return saved;
}

// For screenshots and debugging from the console.
globalThis.threadworkPreview = { app, view, snapshot };
