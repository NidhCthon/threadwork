// Just enough of Foundry for scripts/threadwork.js, and every module it
// imports, to load outside it. The pattern comes from Poise & Break: node --test
// runs each test file in its own process, so every file gets a freshly
// imported module and a fresh copy of this state.
//
// Everything a test needs to steer or inspect is exported.

export const hooks = { once: new Map(), on: new Map() };

const listFor = (map, event) => {
  if (!map.has(event)) map.set(event, []);
  return map.get(event);
};

globalThis.Hooks = {
  once(event, fn) { listFor(hooks.once, event).push(fn); },
  on(event, fn) { listFor(hooks.on, event).push(fn); return fn; },
  off(event, fn) {
    const list = hooks.on.get(event) ?? [];
    const at = list.indexOf(fn);
    if (at !== -1) list.splice(at, 1);
  },
  callAll(event, ...args) {
    for (const fn of [...(hooks.on.get(event) ?? [])]) fn(...args);
  }
};

/** Run every handler registered with Hooks.once for an event. */
export async function fireOnce(event, ...args) {
  for (const fn of hooks.once.get(event) ?? []) await fn(...args);
}

globalThis.foundry = {
  abstract: {
    TypeDataModel: class {
      static defineSchema() { return {}; }
    }
  },
  canvas: {
    layers: {
      InteractionLayer: class {
        static get layerOptions() { return { name: "", zIndex: 0 }; }
      }
    }
  }
};

globalThis.CONFIG = { JournalEntryPage: { dataModels: {} }, Canvas: { layers: {} } };

export const keybindings = [];
globalThis.game = { keybindings: { register: (module, name, options) => keybindings.push({ module, name, options }) } };

globalThis.CONST = {
  DOCUMENT_OWNERSHIP_LEVELS: { INHERIT: -1, NONE: 0, LIMITED: 1, OBSERVER: 2, OWNER: 3 },
  GRID_TYPES: { GRIDLESS: 0, SQUARE: 1 },
  FOG_EXPLORATION_MODES: { DISABLED: 0, INDIVIDUAL: 1, SHARED: 2 }
};

export const threadwork = await import(new URL("../scripts/threadwork.js", import.meta.url));
