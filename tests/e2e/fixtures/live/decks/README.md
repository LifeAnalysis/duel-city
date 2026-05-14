# Live Interaction Deck Fixtures

This directory is reserved for tiny, deterministic decks used by Playwright
tests that connect to a real ygopro server.

Live decks should be organized by interaction scenario:

```text
tests/e2e/fixtures/live/decks/
  select-position.ydk
  select-place.ydk
  select-yesno.ydk
  select-chain.ydk
  select-card.ydk
  select-option.ydk
```

These decks are test fixtures, not normal playable decks. Prefer the smallest
deck that reliably triggers the target UI interaction. The live tests use custom
room codes such as `NS` and `NC`, so deck order can be fixed and normal deck
size or forbidden-list constraints do not need to drive fixture design.

`select-place.ydk` intentionally contains repeated copies of `Mystical Elf`
(`15025844`) so the opening hand has a normal summonable monster with no effect
branches. The related test clears the browser deck IndexedDB and installs this
fixture as the only deck before entering the live room.
