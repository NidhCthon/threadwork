// Per-user undo (SPEC.md 5.3): a local stack of this user's own board edits,
// kept as data so undoing one is just applying its inverse. It lives in this
// browser tab only and is gone on reload.
//
// An operation is one of:
//   { kind: "create", pages: [pageData with _id] }
//   { kind: "delete", pages: [pageData with _id] }
//   { kind: "update", changes: [{ _id, before, after }] }

export const UNDO_LIMIT = 50;

/** The operation that reverses `op`. */
export function invert(op) {
  switch (op.kind) {
    case "create": return { kind: "delete", pages: op.pages };
    case "delete": return { kind: "create", pages: op.pages };
    case "update": return { kind: "update", changes: op.changes.map(({ _id, before, after }) => ({ _id, before: after, after: before })) };
    default: throw new Error(`Unknown undo operation: ${op.kind}`);
  }
}

export class UndoStack {
  constructor(limit = UNDO_LIMIT) {
    this.limit = limit;
    this.done = [];
    this.undone = [];
  }

  /** Remember something the user just did. A new action clears the redo trail. */
  record(op) {
    this.done.push(op);
    if (this.done.length > this.limit) this.done.shift();
    this.undone.length = 0;
  }

  /** The operation to apply to undo the latest action, or null if there is none. */
  takeUndo() {
    const op = this.done.pop();
    if (!op) return null;
    this.undone.push(op);
    return invert(op);
  }

  /** The operation to apply to redo the latest undone action, or null if there is none. */
  takeRedo() {
    const op = this.undone.pop();
    if (!op) return null;
    this.done.push(op);
    return op;
  }

  get canUndo() { return this.done.length > 0; }
  get canRedo() { return this.undone.length > 0; }
}

/**
 * The current values of exactly the fields an update will change, so undoing
 * it puts back only those. `current` is plain page data; `after` is the update.
 */
export function beforeOf(current, after) {
  const before = {};
  for (const [key, value] of Object.entries(after)) {
    const now = current?.[key];
    before[key] = value && typeof value === "object" && !Array.isArray(value) ? beforeOf(now, value) : structuredClone(now ?? null);
  }
  return before;
}

/**
 * The pages to delete when a card goes: the card and every string attached to
 * it, so no string is left pointing at nothing. `pages` are plain page data.
 */
export function cascadeFor(cardId, pages, stringType) {
  return pages.filter((p) => p._id === cardId || (p.type === stringType && (p.system?.from === cardId || p.system?.to === cardId)));
}
