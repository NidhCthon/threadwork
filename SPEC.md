# Threadwork — Build Spec

**Status:** v0.1 · 29 Sep 2026 · designed through a grilling session; M0 in progress
**Owner:** James (NidhCthon)
**Repo:** `K:\threadwork` → `github.com/NidhCthon/threadwork` (public, MIT)

---

## 0. Handoff prompt for Claude Code

> Read `SPEC.md` in full before doing anything. We are building **Threadwork**, a Foundry VTT v14 module: a shared, animated relationship board drawn on its own scene. Work through the milestones in order and do not start M(N+1) until M(N)'s acceptance criteria pass. **M1 is a feel gate: nothing after it gets built until James says it feels right.** Keep drawing and geometry in pure functions so they run under `node --test` and in the preview harness. Only copy code from MIT-licensed sources and record each one in `THIRD_PARTY_NOTICES.md`. Ask before adding any dependency not named here. Commit as `NidhCthon <NidhCthon@users.noreply.github.com>`.

---

## 1. Problem

Players forget who is who, and they plan their characters' ties in their heads or in Discord. Foundry has several relationship-board modules (§11), but each one looks flat, or makes players go through setup to edit, or both. PWD's accepts only Actors and runs in a window. Gus77's needs Drawing mode plus drawing and upload permissions, and its strings have no arrows or labels. None of them feel alive.

Threadwork is a **players' planning board**: character relationships, party planning, and storyboarding. It is drawn on its own scene, anyone can edit it, and it moves like it is alive. Feel is the product.

A GM **mystery board** (staged reveals, real secrecy) is a later board kind in the same module (§10). It is not v1.

## 2. Fixed inputs (decided — do not relitigate)

| Input | Decision |
|---|---|
| Platform | Foundry **v14** (min 14.365, verified 14.368), any system. **Pathfinder (pf2e 8.5.1) world first.** |
| Purpose | Players' planning board: characters, relationships, storyboarding. Not a reveal board. |
| Differentiator | **Feel**: fluid, neat, always alive. |
| Where it lives | A **real Scene** with a custom canvas layer, not a window. |
| Boards | **One party board per world** in v1. |
| Who edits | Everyone. The board is shared: anyone can move any card and draw, edit or delete any string. **What is inside a document follows Foundry ownership**: players edit their own PC, while NPCs and journals stay the GM's. Per-user **undo**. The GM can **lock** a card, string or frame. |
| Visibility | Each item is visible to **Everyone**, **GM only**, or **Private** (its author plus GMs). **Trust the table**: hidden means not drawn, not secret. |
| Cards | Actors, Items and Journals (entries and pages) dragged in, plus free **text** cards and **hub** cards for shared concepts. |
| Strings | A **free-text label** and **arrows** (none, one way, or both). No relationship-type palette. |
| Frames | In v1: titled boxes that group cards and move with them. |
| Interaction | **Modeless.** The board layer is always active on the board scene, so there is no tool picking. |
| Look | **Constellation** is the default theme. Cork comes after v1. Themes are a swappable layer. |
| Motion | **Always alive**: stars twinkle, light flows along every string, cards drift gently. |
| Storage | A hidden **"Party Board" JournalEntry**; every card, string and frame is its own page sub-type. |
| Navigation | A Board button (remembers where you were) and a Back button, plus a scene-bar tab. When the GM activates a scene, everyone is pulled back to it, and that is a feature. |
| Build | New, public, **MIT**. Code may be copied from MIT sources (PWD, Gus77, sargas79) with notices. Foundry Graph is AGPL, so ideas only. |
| Dev env | A **local Foundry copy** (14.368 + pf2e 8.5.1) with a passwordless test world. Then a final check on the Lightsail server. |
| Success | **Use**: at least 2 players add or change something on the board unprompted in the first three Grayce sessions. |

## 3. Goals

1. **Use (the success test).** In the first three Grayce sessions, at least 2 of 3–4 players edit the board on their own, and James never has to maintain it for them.
2. **No friction.** A player with default PLAYER permissions drags their PC onto the board and draws a labeled string to an NPC in under 15 seconds, with no help and no permission changes.
3. **Smooth.** A board with 60 cards and 100 strings holds a steady frame rate while panning, dragging and drawing on James's machine, and does not stutter on an ordinary player laptop. This is an engineering limit, not the success test.

## 4. Non-goals for v1

- The cork theme (it comes next; the theme layer must make it a drop-in).
- The mystery board: reveal states, prepared reveal beats, the encrypted vault, per-player knowledge (§10).
- Personal or multiple boards.
- Templates (bonds, goals, fears).
- Automatic layout ("tidy up") and routing lines around cards.
- A pop-out window. Players with the canvas turned off cannot see the board, which is an accepted limitation of choosing a Scene.
- Localisation beyond English.
- The Foundry package listing. It stays a GitHub manifest install until it has held up through real sessions.

## 5. Architecture

```
threadwork/
  SPEC.md                 ← this document
  CLAUDE.md               ← working conventions
  module.json             ← documentTypes: JournalEntryPage card / string / frame
  scripts/
    threadwork.js         ← entry: settings, hooks, data models; re-exports everything for tests
    data.js               ← TypeDataModels and the board/scene bootstrap
    layer.js              ← ThreadworkLayer (InteractionLayer): input, render loop
    draw/                 ← pure draw functions: card, string, frame, starfield, flow
    geometry.js           ← edge-attached curves, bowing, label placement, alignment guides
    motion.js             ← springs, drift, flow timing, reduced motion
    undo.js               ← per-user undo stack
    themes/constellation.js
  styles/threadwork.css   ← HUD text boxes, context menu
  tests/                  ← node:test against a stubbed Foundry (pattern from Poise & Break)
  tools/preview/          ← real PIXI 7.4.3 in a browser, rendering the pure draw functions
  THIRD_PARTY_NOTICES.md
```

### 5.1 Rendering

- **The board scene** is created by the module on the first GM login if it is missing. It is named "Party Board" and carries the flag `flags.threadwork.board = true`, plus these settings:
  - `navigation: true`, with players at LIMITED so it shows in their scene bar
  - `tokenVision: false`, which is required: with it on, players without a token see black, and pf2e vision rules only run when it is on
  - fog `DISABLED`, grid `GRIDLESS`
  - no background image (`levels[0].background.src: null`) and a theme colour
  - about 8000×6000 px
- **`ThreadworkLayer`** extends `foundry.canvas.layers.InteractionLayer`. It is registered as `CONFIG.Canvas.layers.threadwork` in the `interface` group, and it only draws when the viewed scene is the board. On `canvasReady` for the board scene it calls `canvas.threadwork.activate()`, so players never pick a tool. Pointer input goes through `_onClickLeft`, `_onDragLeftStart` and related methods. `_canDragLeftStart(user, event)` enforces locks.
- **All drawing lives in pure functions** (`draw/*`, `geometry.js`) that take a PIXI container and plain data. The layer only wires data and the ticker to them. That is what makes them testable in node and viewable in `tools/preview`. PIXI is Foundry's global **7.4.3**.
- **Text editing** uses HTML inside `canvas.hud`, placed at scene-pixel coordinates. `hud.align()` keeps it matched to pan and zoom. Labels are *displayed* as PIXI text and *edited* in the HUD.
- **One ticker callback** drives every animation. It is removed on `canvasTearDown`, following Poise & Break's bonfire-aura pattern.

### 5.2 Data model

The board is one JournalEntry named **"Party Board"**, with the flag `flags.threadwork.board = { kind: "party", sceneId }`. It is hidden from the Journal sidebar (a cosmetic filter). Its ownership gives players **OWNER**, because creating pages requires OWNER on the entry. Pages inherit that ownership. **Locking** an item gives its page explicit ownership, with players at OBSERVER, and also sets `locked: true` (a `gmOnly` field). Players cannot change ownership after creation, so only the GM can lock or unlock.

The page types are `threadwork.card`, `threadwork.string` and `threadwork.frame`. Their fields sit on `system`, and these fields are common to all three:

- `visibility`: `"everyone" | "gm" | "private"`
- `author`: user id
- `locked`: boolean, `gmOnly`

| Type | Fields |
|---|---|
| card | `kind` (`"document" \| "text" \| "hub"`), `uuid` (nullable), `x`, `y`, `w`, `h`, `caption`, `lastName`, `lastImg` (so a card can still show when its document is deleted), `color` (nullable) |
| string | `from` / `to` (card page ids), `label`, `arrows` (`"none" \| "forward" \| "both"`), `color` (nullable; defaults to the author's user colour) |
| frame | `x`, `y`, `w`, `h`, `title`, `color` |

- **Frame membership is geometric.** When a frame starts moving, it takes the cards whose centres are inside it. There is no stored list, so there is nothing to keep in sync.
- **Deleting a card deletes its strings** in the same action. Undo restores them all.
- **Missing documents.** If a card's document is gone, the card shows `lastName`/`lastImg` greyed out and marked missing until someone removes it.

### 5.3 Sync and permissions

- **Every edit is an ordinary page create, update or delete** that the player makes directly. Foundry validates it and broadcasts it to all clients, and each client redraws in `createJournalEntryPage`, `updateJournalEntryPage` and `deleteJournalEntryPage`. **There is no socket in v1, and no GM needs to be online.**
- **Card contents.** Clicking a card opens its document's own sheet, so Foundry's ownership decides whether the player can edit it. Name and portrait are read live from the document. Only `caption` belongs to the board.
- **Concurrent drags.** If two users drag the same card, the last write wins. That is acceptable.
- **Undo** is a local stack of inverse operations per user, covering only that user's own actions. It holds 50 steps and is cleared on reload.

### 5.4 Navigation

- **Board and Back.** A Threadwork scene-control group has a **Board** tool on every scene. It saves `canvas.scene.id` in the client and calls `board.view()`. On the board, a **Back** tool returns to the saved scene. `Scene#view()` has no permission check for players.
- **Pull-back.** When the GM activates a scene, every client moves to it. Any HUD text being typed is kept as a draft keyed by page id and restored when that player comes back.
- **Reload** lands a player on the active scene, which is Foundry's normal behaviour.

### 5.5 Interaction (modeless)

- **Adding cards:**
  - Drag an Actor, Item, JournalEntry or JournalEntryPage from the sidebar onto the board to make a document card. This uses the `dropCanvasData` hook, which returns `false` so core does not try to create a token.
  - Double-click empty space to make a text card.
  - Double-click a card to edit its caption or text.
- **Drawing strings:** hover a card to show its edge handles, then drag from a handle. A live curve follows the cursor and snaps onto the card you drop on, and the label box opens straight away. Press Enter or click away to commit. An empty label is allowed.
- **Right-click menu:** visibility, colour, arrows, hub on/off, lock (GM only), delete, and "open sheet".
- **Frames:** made from a small toolbar button or the right-click menu on empty space, and resized by dragging their edges.
- **Alignment guides:** while you drag, a card snaps to the edges and centres of nearby cards within 8 screen px, and guide lines show. We write this ourselves, about 100 lines.
- **Keys:** Ctrl+Z / Ctrl+Shift+Z for undo/redo, and Delete to remove the selection.

### 5.6 Look and motion (Constellation)

- **Board:** a deep night background and a starfield that twinkles, with stars drawn procedurally rather than from an image.
- **Cards:** glowing plates. Document cards show a portrait or icon, the name, and the caption. Hub cards are larger and glow more strongly. Text cards are plain glowing notes.
- **Strings:** curves attached at card **edges** (box-to-box, as in perfect-arrows or PWD's rim-trimmed curves). When two cards share several strings, the curves bow apart. Labels sit on a plate at the midpoint, and arrowheads sit at the edge. A slow light runs along every string in its arrow's direction, or both ways for strings with no direction.
- **Drift:** each card floats a few pixels on its own slow cycle. Drift is **render-only**, so it is never written to data. **It pauses for the card under the cursor and for anything being edited**, so labels never move while you are reading or typing them.
- **Springs:** when a card's position changes, whether from your own drag or someone else's edit, the drawn position eases toward it on a critically damped spring. Strings follow the drawn position, and that gives them their springy lag.
- **Hover** lights up a card's whole web (M4).
- **Reduced motion:** if the OS asks for reduced motion, or a player turns on the client setting, twinkle, flow and drift stop. Springs become quick eases.
- **Theme layer:** colours, textures, glow and string style live in `themes/constellation.js`, and nothing else hard-codes them. Cork will be a second file.

## 6. Milestones

### M0 — Setup
Create the repo, `module.json` with the three page types, and an entry that registers empty data models. Add the node:test stub (adapted from Poise & Break's `tests/foundry.mjs`) plus a manifest test, and CI. Set up local Foundry. (`tools/preview` arrives in M1, along with the first draw functions it renders.)
**Accept:**
- `node --test tests/*.test.mjs` passes, locally and in CI.
- Local Foundry 14.368 runs on `localhost` only, with pf2e 8.5.1 and a `threadwork-dev` world. The world has a passwordless Gamemaster and two passwordless players.
- The module, junctioned into `Data/modules/threadwork`, enables with no console errors.
- A GM tab and a player tab can both be logged in at once.

### M1 — Feel test (gate)
Set up `tools/preview`, which renders the draw functions in real PIXI 7.4.3. Then build the board scene and layer with **two hard-coded cards and one string**. It needs springy dragging, an edge-attached curve, a label typed in the HUD, the starfield, flowing light, and drift that pauses under the cursor.
**Accept:** it runs smoothly in the local world, and **James tries it and says it feels right.** The M1 code may be thrown away or rewritten. The point is to judge the feel.

### M2 — Real data and sync
Add the TypeDataModels and bootstrap the journal and scene. Cards come from drops, strings from dragging a handle. Clients redraw from page hooks. Add Board and Back, and keep drafts on pull-back.
**Accept:**
- Goal 2 passes. In the player tab, with default PLAYER permissions, a player drops their own PC and an NPC and draws a labeled string in under 15 seconds.
- The GM tab shows it within a second.
- It survives a reload.
- Board and Back work.
- A GM activation pulls the player off the board, and their half-typed label is back when they return.

### M3 — Full editing
Add frames that move with their cards, hub and text cards, the three visibility settings, GM lock, per-user undo and redo, the right-click menu, alignment guides, and missing-document cards.
**Accept:**
- A private card from Player One does not appear in Player Two's tab.
- A player cannot move or delete a locked item.
- Undo only reverses your own actions.
- Deleting an Actor leaves a greyed-out missing card.

### M4 — Polish and performance
Add hover lighting of a card's web and the reduced-motion fallback. Check the theme layer is isolated. Build a 60-card, 100-string test board and profile it.
**Accept:** Goal 3 is met: frame time is measured on James's machine, with a quick check on an ordinary laptop. The reduced-motion setting and the OS setting both stop ambient motion.

### M5 — Live
Deploy to the Lightsail box by hand, following the Poise & Break routine, and install it in the pathfinder world. James runs a ten-minute check with one player. The first Grayce session starts the Goal 1 test.
**Accept:** no errors in the live world, and the check passes.

## 7. Testing

- **Unit tests** (`node --test tests/*.test.mjs`) cover geometry (edge attachment, bowing offsets, label placement, snapping), data validation, undo inversion, visibility and lock rules, and drop handling. They run against a stubbed Foundry and fake PIXI. Run them with the glob; a bare `tests/` argument fails misleadingly.
- **Preview harness** (`tools/preview`): real PIXI 7.4.3 from jsDelivr, running the pure draw functions and the motion loop. This is where visual changes get reviewed and screenshotted. Use the ticker-freeze trick for mid-animation frames.
- **Two-tab local test:** GM and player tabs in the local world, driven from the browser pane, to check sync and permissions.
- **Live:** only at M5, with James driving, because the pathfinder GM account has a password.

## 8. Dev environment

- **Foundry Node.js build 14.368** is unpacked to `K:\foundry-dev\app`, with data in `K:\foundry-dev\data`. It is started with `node main.js --dataPath=K:\foundry-dev\data --hostname=localhost --port=30001`. It stays bound to localhost, which is what the license allows for a dev copy.
- **James does these steps himself:** download the build (it needs his foundryvtt.com sign-in), then enter the license key and accept the EULA on first launch.
- **pf2e 8.5.1** is installed from its versioned manifest.
- **The module** is linked into `data/modules/threadwork` with a directory junction.
- **Node 24 on Windows cannot spawn `.cmd` shims.** Call tools as libraries or run them with `node` directly.

## 9. Deploy

This follows Poise & Break:
1. `git archive` module.json, LICENSE, README.md, THIRD_PARTY_NOTICES.md, scripts and styles.
2. scp the archive to the server.
3. Stop foundryvtt and move the old folder to `/tmp/threadwork.previous`. Never put a rollback copy inside `Data/modules/`.
4. Untar into `Data/modules/threadwork`, run `chown --reference`, and start the service.

JS/CSS-only updates need only a browser refresh, not a restart. **A manifest change needs a restart, so check who is connected first.** Bump `version` on every release.

## 10. Later: the mystery board (same module)

This is a second board kind that shares the renderer, data model and themes. It is already designed:

- **States:** hidden, shadowed ("???" stub) and revealed, on both cards and strings. Strings also carry certainty: rumored, suspected or confirmed.
- **Prepared reveal beats:** the GM queues them during prep. Firing one broadcasts a staged reveal: the string draws itself in, the camera pans, and a sound plays.
- **Real secrecy:** Foundry sends every document, pack index, user setting and `Data/` file to every client. So secrets live in an **encrypted vault** in world data, sealed with a GM passphrase (Web Crypto AES-GCM, key derived with PBKDF2), plus a "download readable backup" button. A beat is decrypted and written into the board only at the moment of reveal.
- **Per-player knowledge**, and GM confirmation that turns a player's theory into canon.

Other items after v1: the cork theme, personal boards, templates, a tidy-up layout, and obstacle routing.

## 11. Research record (29 Sep 2026)

**Competitors on v14:**

| Module | License | Notes |
|---|---|---|
| Relationship Map (PWD) | MIT | Actors only, round portraits, captions in a dialog, windowed. Good: rim-trimmed curves, glide pan/zoom, undo. |
| Investigation Board (Gus77, © Mordachai) | MIT | On-scene Drawings. Needs Drawing mode plus DRAWING_CREATE and upload. One top pin, no arrows or labels, no undo. |
| Investigation Board (sargas79) | MIT | AppV2 window, JournalEntryPage sub-types. Its secrecy claim is contradicted by core source. |
| Foundry Graph | AGPL-3.0 | D3 window with a WoD template. Ideas only. |
| Stylish Relationship Tracker | Paid | The only animated one. Cut-ins, built around one character. |
| Simple MindMap, ClueBook | No license | Do not copy. |
| Target Tree | Closed source | — |

**Code worth copying (MIT):**
- PWD's `module/utils/relmap-geometry.js` (rim-trimmed curves and caption placement) and `zoom-pan-surface.js`.
- perfect-arrows (2.7 KB), for box-to-box arrow geometry.

**Verified in the 14.368 source:**
- PIXI is 7.4.3 and global.
- Scene-embedded document types are fixed, so there are no custom placeables.
- `gmOnly` DataFields exist.
- `User#query` with `CONFIG.queries` exists.
- `Scene#view()` has no permission check for players.
- GM `activate()` moves every client.
- `canvas.hud` stays aligned to pan and zoom.
- Every world document reaches every client.

## 12. Risks and open checks

- **`dropCanvasData` for players.** Confirm that the hook fires and that returning `false` stops core's token creation when a PLAYER drops an Actor (M2).
- **Always-on motion on weak laptops.** Measure it at M4. Reduced motion is the fallback.
- **The pathfinder world's history of loading problems.** Part 1 runs with the Bastion module off. The board scene is light, but recheck after Bastion or pf2e updates.
- **The board journal in the sidebar.** It is hidden cosmetically. Trusting the table covers anyone who opens it anyway.
