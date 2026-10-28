# Threadwork

A shared, animated relationship board for Foundry VTT v14, drawn on its own scene.

Players drag characters, items and journals onto the board, draw labeled strings between them, and group them into frames. It is meant for character relationships, party planning and storyboarding. Cards follow Foundry's ownership, so players edit their own characters, while NPCs and journals stay the GM's. The board itself is shared, with undo for everyone and a lock for the GM. The default Constellation theme is always in motion: stars twinkle, light runs along the strings, and cards drift.

The GM can also **shadow** a card or a string, so the table sees that something is there — a `???` plate, a dashed line to nowhere — without seeing what. Strings say how sure the table is: a player marks a hunch as a rumour, and the GM confirming it is what makes it canon. Shadowing decides what is drawn, not what is secret; Foundry sends every page to every client, so anything that must not be read belongs outside the world until it is revealed.

**Status:** in use, and still being built. See [SPEC.md](SPEC.md) for the plan and its milestones.

Works with any game system. It is being built in a Pathfinder Second Edition world first.

## Development

```
node --test tests/*.test.mjs
```

Pass the glob, not a bare `tests/`.

## License

[MIT](LICENSE). Code adapted from other MIT projects is credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
