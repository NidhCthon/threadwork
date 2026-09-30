// Runs the board's real drawing and motion code (scripts/board-view.js) in a
// plain PIXI 7.4.3 app, without Foundry. The board is centred in the window at
// 1:1; the label editor is an input over the canvas, like the HUD in Foundry.
import { BoardView } from "../../scripts/board-view.js";
import { prefersReducedMotion } from "../../scripts/motion.js";
import { applyThemeCss } from "../../scripts/theme-css.js";
import { constellation } from "../../scripts/themes/constellation.js";
import { demoBoard } from "./demo-board.js";
import { stressBoard } from "./stress-board.js";

// ?stress (or ?stress=60,100) builds a crowded board for the M4 performance check.
const stress = new URL(location.href).searchParams.get("stress");
const [stressCards, stressStrings] = (stress || "60,100").split(",").map(Number);

await document.fonts.load(`${constellation.card.name.fontSize}px Signika`);
applyThemeCss(constellation);

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
const rect = stress === null ? { x: 0, y: 0, width: 1800, height: 1100 } : { x: 0, y: 0, width: 5200, height: 3200 };
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

function editText({ x, y, value, color, fontSize, width = null, multiline = false, placeholder = "" }) {
  const input = document.createElement(multiline ? "textarea" : "input");
  if (!multiline) input.type = "text";
  input.className = "threadwork-label-input";
  input.value = value;
  input.placeholder = placeholder;
  Object.assign(input.style, { left: `${x}px`, top: `${y}px`, fontSize: `${fontSize}px`, borderColor: hex(color) });
  if (width) input.style.width = `${width}px`;
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
      if (event.key === "Enter" && !(multiline && event.shiftKey)) {
        event.preventDefault();
        finish(input.value);
      } else if (event.key === "Escape") finish(null);
    });
    input.addEventListener("blur", () => finish(input.value));
  });
}

const view = new BoardView({
  PIXI,
  root,
  theme: constellation,
  rect,
  ...(stress === null ? demoBoard(rect) : stressBoard(rect, stressCards, stressStrings)),
  makeText: (text, style) => {
    const t = new PIXI.Text(text, style);
    t.resolution = 2 * window.devicePixelRatio;
    return t;
  },
  // Relative paths are Foundry data paths; the local Foundry serves them from its root.
  loadTexture: (src) => PIXI.Assets.load(/^(\/|https?:)/.test(src) ? src : `/${src}`),
  editText,
  userColor: 0xffa46b,
  renderer: app.renderer,
  reducedMotion: prefersReducedMotion()
});
// No journal here: new strings live only in this page.
let made = 0;
view.onConnect = async (from, to) => {
  const id = `drawn-${++made}`;
  view.addString({ id, from, to, label: "", arrows: "forward", color: 0xffa46b });
  return id;
};
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

/**
 * Time `frames` frames of the board: BoardView#update (our CPU work) and the
 * render (PIXI's CPU work plus the GPU, forced to finish with gl.finish so the
 * number is real). Runs with the ticker stopped, so it works in a hidden tab.
 */
function profile(frames = 300) {
  app.ticker.stop();
  const gl = app.renderer.gl;
  const update = [];
  const render = [];
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now();
    view.update(1 / 60);
    const t1 = performance.now();
    app.renderer.render(app.stage);
    gl.finish();
    render.push(performance.now() - t1);
    update.push(t1 - t0);
  }
  app.ticker.start();
  const stats = (list) => {
    const sorted = [...list].sort((a, b) => a - b);
    const avg = list.reduce((s, v) => s + v, 0) / list.length;
    return { avg: +avg.toFixed(2), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2), max: +sorted.at(-1).toFixed(2) };
  };
  const total = update.map((u, i) => u + render[i]);
  return {
    cards: view.cards.size, strings: view.strings.size, frames: view.frames.size,
    screen: [app.screen.width, app.screen.height], resolution: app.renderer.resolution,
    update: stats(update), render: stats(render), total: stats(total)
  };
}

// For screenshots, profiling and debugging from the console.
globalThis.threadworkPreview = { app, view, snapshot, profile };
