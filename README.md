# Threadwork

A shared, animated relationship board for Foundry VTT v14, drawn on its own scene.

Players drag characters, items and journals onto the board, draw labeled strings between them, and group them into frames. It is meant for character relationships, party planning and storyboarding. Cards follow Foundry's ownership, so players edit their own characters, while NPCs and journals stay the GM's. The board itself is shared, with undo for everyone and a lock for the GM. The default Constellation theme is always in motion: stars twinkle, light runs along the strings, and cards drift.

The GM can also **shadow** a card or a string, so the table sees that something is there — a `???` plate, a dashed line to nowhere — without seeing what. Strings say how sure the table is: a player marks a hunch as a rumour, and the GM confirming it is what makes it canon. Shadowing decides what is drawn, not what is secret; Foundry sends every page to every client, so anything that must not be read belongs outside the world until it is revealed.

### On the board

- Drag an actor, item or journal from the sidebar to add its card. Double-click a card to open its sheet.
- Make a note, concept or frame with the Party Board tools on the left, or press **N** to make one where the pointer is. Double-clicking empty board also makes a note.
- Drag from the handles on a card's edge to draw a string to another card.
- Right-click a card, string or frame for its menu. Right-dragging pans the board, as it does on any scene.
- Ctrl+Z and Ctrl+Shift+Z undo and redo your own changes. Delete removes whatever the pointer is over.

### Looks

Three looks, chosen for the whole world in the module settings: **Constellation**, a night sky where light runs along the strings; **Cork**, a detective's board of brown cork, cream index cards and red twine; and **Elysium**, a court's salon of crimson damask, cream cards with wax seals, sepia cameo portraits and silk ribbons in gilt frames.

Elysium can hang a painting behind its damask. Pick an image from your Data folder in **Party Board painting**. It stays still behind the view while the board pans and zooms over it, so an ordinary illustration is big enough. Threadwork ships no paintings; use art you are allowed to use at your table.

### Emblems

A character's card can wear a small emblem on its portrait, such as a clan, house or faction symbol. Threadwork comes with no symbols. To use them, point **Card emblems: image folder** at a folder of images in your Data directory. Each one is drawn in the board's colours, so transparent PNG, WebP or SVG files work best. Then right-click a card and choose **Emblem…**.

To have cards pick their own, set **Card emblems: chosen by** to the actor data that names one. With `system.clan`, a Toreador wears `toreador.png`. A name that has no file of its own uses the longest file name it starts with, so a Brujah antitribu wears `brujah.png` unless the folder has a `brujah-antitribu.png`. You can list several fields, separated by commas (`system.clan, system.sect`), and they are tried in order.

The GM's client lists the folder when the GM loads the world, because players can't browse files. Images added to the folder later appear after the GM reloads.

Respect the licence of the symbols you use. Most game publishers' symbols are licensed to you for your own table and not for redistribution, so keep them in your own Data folder rather than in a shared module.

**Status:** in use, and still being built. See [SPEC.md](SPEC.md) for the plan and its milestones.

Works with any game system. It is being built in a Pathfinder Second Edition world first.

## Development

```
node --test tests/*.test.mjs
```

Pass the glob, not a bare `tests/`.

## License

[MIT](LICENSE). Code adapted from other MIT projects is credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
