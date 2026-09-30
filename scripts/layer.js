// The canvas layer that hosts the board on the board scene (SPEC.md 5.1).
// All drawing and motion live in BoardView; this file only connects it to
// Foundry: the scene, the ticker, PreciseText, textures, and the HUD for typing.
import { MODULE_ID } from "./constants.js";
import { BoardView } from "./board-view.js";
import { isBoardScene } from "./board-scene.js";
import { prefersReducedMotion } from "./motion.js";
import { spikeBoard } from "./spike-data.js";
import { constellation } from "./themes/constellation.js";

const hex = (color) => `#${color.toString(16).padStart(6, "0")}`;

export class ThreadworkLayer extends foundry.canvas.layers.InteractionLayer {
  /** @type {BoardView|null} */
  view = null;

  #tick = null;
  #closeEditor = null;

  static get layerOptions() {
    return Object.assign(super.layerOptions, { name: MODULE_ID, zIndex: 150 });
  }

  static prepareSceneControls() {
    return {
      name: MODULE_ID,
      order: 20,
      title: "Threadwork",
      layer: MODULE_ID,
      icon: "fa-solid fa-diagram-project",
      onChange: (_event, active) => {
        if (active) canvas[MODULE_ID].activate();
      },
      tools: {
        board: { name: "board", order: 1, title: "Party Board", icon: "fa-solid fa-hand-pointer", interaction: true }
      }
    };
  }

  async _draw(options) {
    await super._draw(options);
    if (!isBoardScene(canvas.scene)) return;
    const rect = canvas.dimensions.sceneRect;
    this.view = new BoardView({
      PIXI,
      root: this,
      theme: constellation,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      ...spikeBoard(rect),
      makeText: (text, style) => new foundry.canvas.containers.PreciseText(text, new PIXI.TextStyle(style)),
      loadTexture: (src) => foundry.canvas.loadTexture(src),
      editText: (request) => this.#editInHud(request),
      reducedMotion: prefersReducedMotion()
    });
    await this.view.build();
    this.#tick = () => this.view?.update(canvas.app.ticker.deltaMS / 1000);
    canvas.app.ticker.add(this.#tick);
  }

  async _tearDown(options) {
    if (this.#tick) canvas.app.ticker.remove(this.#tick);
    this.#tick = null;
    this.#closeEditor?.(null);
    this.view?.destroy();
    this.view = null;
    return super._tearDown(options);
  }

  /**
   * Type into an HTML input placed in the canvas HUD at board coordinates. The
   * HUD is re-aligned on every pan and zoom, so the input stays on the label.
   */
  #editInHud({ x, y, value, color, fontSize }) {
    const hud = canvas.hud?.element;
    if (!hud) return Promise.resolve(null);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "threadwork-label-input";
    input.value = value;
    Object.assign(input.style, { left: `${x}px`, top: `${y}px`, fontSize: `${fontSize}px`, borderColor: hex(color) });
    hud.append(input);
    input.focus();
    input.select();
    return new Promise((resolve) => {
      const finish = (result) => {
        if (!this.#closeEditor) return;
        this.#closeEditor = null;
        input.remove();
        resolve(result);
      };
      this.#closeEditor = finish;
      input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(input.value);
        else if (event.key === "Escape") finish(null);
      });
      input.addEventListener("blur", () => finish(input.value));
    });
  }
}
