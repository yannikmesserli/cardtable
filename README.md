# Cardtable

Logic and animated components for building card games (War, Blackjack, Cribbage…).

> Early work in progress.

## Packages

| Package | Description |
| --- | --- |
| [`@cardtable/core`](packages/core) | Cards, decks, seeded RNG. Zero dependencies. |
| [`@cardtable/engine`](packages/engine) | Deterministic, serializable game engine: matches, validation, replay, player views, bots. |
| [`@cardtable/games`](packages/games) | Game rules. `@cardtable/games/war` for now. |
| [`@cardtable/react`](packages/react) | `useMatch` hook and animated cards (Motion): `PlayingCard`, `IconCard` for custom cards, `Pile`, `Arrange`. Import `@cardtable/react/styles.css`. |
| [`apps/playground`](apps/playground) | Vite + React + Motion playground (private). |
| [`apps/scenarios`](apps/scenarios) | Interactive terminal scenarios to test rules by hand (private). |

Dependencies only point downward: `games → engine → core`, and `react → engine → core`. Rules never import UI code.

## Getting started

```sh
pnpm install
pnpm dev          # playground on http://localhost:5173 (card gallery at /#cards, deck tools at /#tools)
pnpm test         # unit tests (Vitest)
pnpm scenarios    # interactive scenario picker
pnpm scenarios war-tie   # run a scenario directly
pnpm typecheck
pnpm build        # build publishable packages with tsdown
```

## Engine model

A game is a set of pure functions over plain, serializable state:

```ts
const myGame = defineGame<State, Action, Event, View, Options>({
  name: 'my-game',
  players: { min: 2, max: 4 },
  setup({ players, rng, options, emit }) { /* return initial state */ },
  activePlayers(state) { /* who may act now (can be several) */ },
  legalActions(state, player) { /* list of allowed actions */ },
  apply(draft, action, { player, rng, emit }) { /* mutate the draft copy */ },
  outcome(state) { /* null while playing */ },
  playerView(state, player) { /* redact hidden cards */ },
});

let { match, events } = createMatch(myGame, { players: ['a', 'b'], seed: 42 });
const result = applyAction(myGame, match, 'a', { type: 'play' }); // { ok, match, events } | { ok: false, error }
```

- **Deterministic**: all randomness comes from the seeded `rng`, whose state is stored in the match. `replay(game, config, log)` rebuilds any match.
- **Validated**: `applyAction` rejects actions from inactive players and actions not in `legalActions`.
- **Hidden information**: `playerView` replaces unknown cards with `{ id, hidden: true }`. Card ids are assigned after shuffling, so they never leak faces, and they stay stable so renderers can animate them. Because they are stable, use `hidePile` for face-down piles: it also hides their order, so a card seen face up cannot be tracked after a shuffle.
- **Events**: `apply` emits events such as `{ type: 'move', cardId, from, to, faceUp }` or `{ type: 'shuffle', zone }`. They drive animations and logs. `moveCard` and `shuffleZone` update zones and emit these events in one call. `drawAccepted` draws while setting some cards aside (e.g. a hand without special cards), and `shuffleBack` returns them to the deck.
- **Bots**: `simulate(game, config)` plays full matches. It's useful for property tests (see `war.test.ts`).

### Choices in the middle of a rule

Some rules stop halfway to ask a player something, e.g. "a card was drawn: keep it or bury it?", and then go on. The engine has no special support for this; games follow a convention:

1. Keep the open question in the state (e.g. `pending`), with the card it is about in a real zone so views and animations stay consistent.
2. While it is set, `activePlayers` and `legalActions` only offer the answers.
3. Write the interrupted rule as a resumable function (e.g. `refill`) that stops when it opens a question. Applying the answer resolves it and calls the function again.

See `packages/engine/src/pending.test.ts` for a small example.

`startArrange`, `arrangeActions` and `applyArrange` implement a common choice of this kind: look at the top cards of the deck, discard some, and put the rest back in any order, one card per action. See `packages/engine/src/arrange.test.ts`.

## Scenarios

`pnpm scenarios` opens a menu of hand-crafted situations (ties, double wars, running out of cards…). Inside a scenario:

```
<n> / Enter   play an option         a [n]   auto-play
u             undo                   r       restart
v <player>    print a player's view  s       print the full state
l             action log             e       toggle events
m             menu                   q       quit
```

Add scenarios in `apps/scenarios/src/`. `stackDeck` and `takeCards` from `@cardtable/core` put chosen cards on top of a deck, using picks such as `faceIs('K♠')` or any predicate for custom faces. `rigPiles` from `@cardtable/games/war/testing` stacks War piles.

