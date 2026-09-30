# Working on Threadwork

- `SPEC.md` is the plan of record. Its section 2 is decided; do not relitigate it. Work milestone by milestone. **M1 is a feel gate**: build nothing past it until James says it feels right.
- **Commit identity.** Commit as `NidhCthon <NidhCthon@users.noreply.github.com>`, which is the repo-local config, not the global Pugjc one. From PowerShell 5.1, commit with `git commit -F <file>`, because a here-string containing quotes gets split into pathspecs.
- **Tests.** Run `node --test tests/*.test.mjs`. A bare `tests/` argument fails with a misleading single failure. Every file under `scripts/` must load under `tests/foundry.mjs`; extend the stub rather than guarding code against it.
- **Pure functions.** Drawing, geometry and motion live in pure functions that take plain data and a PIXI container. The layer only wires Foundry data and the ticker to them. That keeps them testable in node and viewable in `tools/preview`.
- **Copying code.** Only copy from MIT or similarly permissive sources: PWD Relationship Map, Gus77 Investigation Board, sargas79 Investigation Board, perfect-arrows. Add each one to `THIRD_PARTY_NOTICES.md` in the same commit. Never copy from Foundry Graph (AGPL) or from repos with no license (Simple MindMap, ClueBook).
- **Dependencies.** Ask before adding any dependency the spec does not name.
- **Line endings.** Blobs are LF (see `.gitattributes`). If `git diff` shows a whole-file rewrite, compare with `--ignore-cr-at-eol` and fix the line endings before committing.
- **On-board text.** Size it big from the start. On earlier modules James asked for text to be made larger every time.
- **Secrecy.** Foundry sends every world document to every client, so "hidden" in v1 means not drawn, never secret. Do not claim secrecy anywhere in the UI or docs.
- **HUD inputs.** The canvas re-renders `#hud` (replacing its contents) after every layer has drawn. Never open an input from `_draw`; open it on `canvasReady` or later. The label editor keeps its text as a draft if anything removes it.
- **Faking pointer input in tests.** Send `pointerdown` and `pointerup` to `canvas.app.view`, not `window`. PIXI treats a release whose target isn't the canvas as "outside" and generates no tap.
- **Previews.** A screenshot of a canvas with running PIXI tickers can time out. Freeze the frame first (`canvas.app.ticker.stop()`, then step it) and retry.
