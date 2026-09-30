// The dedicated board scene (SPEC.md 5.1). The module makes it on the first GM
// login and finds it again by flag, so renaming it is harmless.
import { MODULE_ID } from "./constants.js";

export const BOARD_FLAG = "board";
export const BOARD_SIZE = { width: 8000, height: 6000 };

export const isBoardScene = (scene) => !!scene?.getFlag?.(MODULE_ID, BOARD_FLAG);

const hex = (color) => `#${color.toString(16).padStart(6, "0")}`;

/**
 * Creation data for the board scene. Token vision must be off, or a player with
 * no token on it sees black; pf2e's vision rules also only run when it is on.
 */
export function boardSceneData(theme) {
  return {
    name: "Party Board",
    ...BOARD_SIZE,
    padding: 0,
    navigation: true,
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED },
    grid: { type: CONST.GRID_TYPES.GRIDLESS },
    tokenVision: false,
    fog: { mode: CONST.FOG_EXPLORATION_MODES.DISABLED },
    initial: { x: BOARD_SIZE.width / 2, y: BOARD_SIZE.height / 2, scale: 0.9 },
    flags: { [MODULE_ID]: { [BOARD_FLAG]: true } }
  };
}

/** Find the board scene, creating it if this is the GM who should. */
export async function ensureBoardScene(theme) {
  const existing = game.scenes.find(isBoardScene);
  if (existing || !game.user.isGM) return existing ?? null;
  // With several GMs online, only the active one creates it.
  if (game.users.activeGM && !game.users.activeGM.isSelf) return null;
  const scene = await Scene.create(boardSceneData(theme));
  await paintBackground(scene, theme);
  return scene;
}

/**
 * v14 keeps a scene's background on its Level, not the Scene, and ignores a
 * backgroundColor passed at creation. Without this the board flashes Foundry's
 * default grey before the sky draws.
 */
export async function paintBackground(scene, theme) {
  const level = scene?.levels?.contents[0];
  if (level && level.background?.color?.css !== hex(theme.background)) {
    await level.update({ "background.color": hex(theme.background) });
  }
}
