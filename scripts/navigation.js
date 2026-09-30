// Board and Back (SPEC.md 5.4). Board remembers which scene you were on and
// takes you to the board; Back returns you there. Scene#view() has no
// permission check for players, so this works for everyone. The memory is per
// browser tab, so it survives a reload of that tab.
import { MODULE_ID } from "./constants.js";
import { isBoardScene } from "./board-scene.js";

const RETURN_KEY = `${MODULE_ID}.returnTo`;

// sessionStorage can be missing or throw (private windows, tests); fall back to memory.
let remembered = null;
const store = {
  get() {
    try { return globalThis.sessionStorage?.getItem(RETURN_KEY) ?? remembered; } catch { return remembered; }
  },
  set(id) {
    remembered = id;
    try { globalThis.sessionStorage?.setItem(RETURN_KEY, id); } catch { /* memory is enough */ }
  }
};

export const boardScene = () => game.scenes.find(isBoardScene) ?? null;

/** The scene Back should return to: the one you left, or the active scene if that is gone. */
export function returnScene(scenes = game.scenes) {
  return scenes.get(store.get()) ?? scenes.active ?? null;
}

export async function goToBoard() {
  const board = boardScene();
  if (!board) {
    ui.notifications.warn("There is no Party Board yet. It is created the first time a GM logs in with Threadwork enabled.");
    return null;
  }
  if (canvas.scene && canvas.scene.id !== board.id) store.set(canvas.scene.id);
  if (canvas.scene?.id === board.id) return board;
  return board.view();
}

export async function goBack() {
  const scene = returnScene();
  if (!scene || scene.id === canvas.scene?.id || isBoardScene(scene)) return null;
  return scene.view();
}

/** For tests: forget the remembered scene. */
export function forgetReturnScene() {
  remembered = null;
  try { globalThis.sessionStorage?.removeItem(RETURN_KEY); } catch { /* nothing stored */ }
}

export const rememberReturnScene = (id) => store.set(id);
