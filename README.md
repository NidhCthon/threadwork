# Threadwork

A shared, animated relationship board for Foundry VTT v14, drawn on its own scene.

Players drag characters, items and journals onto the board, draw labeled strings between them, and group them into frames. It is meant for character relationships, party planning and storyboarding. Cards follow Foundry's ownership, so players edit their own characters, while NPCs and journals stay the GM's. The board itself is shared, with undo for everyone and a lock for the GM. The default Constellation theme is always in motion: stars twinkle, light runs along the strings, and cards drift.

**Status:** in development and not yet usable. See [SPEC.md](SPEC.md) for the plan and its milestones.

Works with any game system. It is being built in a Pathfinder Second Edition world first.

## Development

```
node --test tests/*.test.mjs
```

Pass the glob, not a bare `tests/`.

## License

[MIT](LICENSE). Code adapted from other MIT projects is credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
