// Let players drag actors out of the sidebar while they are on the board.
//
// v14's actor directory only lets a drag start if the user may create tokens
// (ActorDirectory#_canDragStart returns game.user.can("TOKEN_CREATE")), and
// that permission is limited to Assistant GMs and GMs: it cannot be granted to
// players at all. Items and journals have no such check. On the board a dropped
// actor becomes a card and never a token (see drops.js), so the drag is safe
// there. Everywhere else the directory keeps its own rule.
import { isBoardScene } from "./board-scene.js";

const PATCHED = Symbol.for("threadwork.actorDrag");

let renderedOnBoard = null;

/**
 * The directory decides whether entries are draggable when it renders (it sets
 * each entry's draggable attribute then), not when a drag starts. So re-render
 * the actor list whenever someone who cannot create tokens moves on or off the
 * board. Returns true if it asked for a render.
 */
export function refreshActorDrag(onBoard, user = game.user, directory = globalThis.ui?.actors) {
  if (user?.can?.("TOKEN_CREATE")) return false;
  if (onBoard === renderedOnBoard) return false;
  renderedOnBoard = onBoard;
  directory?.render();
  return true;
}

/** Wrap a directory class's _canDragStart. Returns false if it was already wrapped. */
export function allowActorDragOnBoard(DirectoryClass, onBoard = () => isBoardScene(globalThis.canvas?.scene)) {
  const proto = DirectoryClass?.prototype;
  if (!proto || proto[PATCHED]) return false;
  const original = proto._canDragStart;
  proto._canDragStart = function (selector) {
    return onBoard() || original.call(this, selector);
  };
  proto[PATCHED] = true;
  return true;
}
