# Cardtable

Logic and animated components for building card games (War, Blackjack, Cribbage…).

> Early work in progress.

## Packages

| Package | Description |
| --- | --- |
| [`@cardtable/core`](packages/core) | Cards, decks, seeded RNG. Zero dependencies. |
| [`@cardtable/engine`](packages/engine) | Deterministic, serializable game engine: matches, validation, replay, player views, bots. |
| [`@cardtable/games`](packages/games) | Game rules. `@cardtable/games/war` for now. |
| [`apps/playground`](apps/playground) | Vite + React + Motion playground (private). |
| [`apps/scenarios`](apps/scenarios) | Interactive terminal scenarios to test rules by hand (private). |

Dependencies only point downward: `games → engine → core`. Rules never import UI code.

## Getting started

```sh
pnpm install
pnpm dev          # playground on http://localhost:5173
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
- **Hidden information**: `playerView` replaces unknown cards with `{ id, hidden: true }`. Card ids are assigned after shuffling, so they never leak faces, and they stay stable so renderers can animate them.
- **Events**: `apply` emits events such as `{ type: 'move', cardId, from, to, faceUp }` or `{ type: 'shuffle', zone }`. They drive animations and logs. `moveCard` and `shuffleZone` update zones and emit these events in one call.
- **Bots**: `simulate(game, config)` plays full matches. It's useful for property tests (see `war.test.ts`).

## Scenarios

`pnpm scenarios` opens a menu of hand-crafted situations (ties, double wars, running out of cards…). Inside a scenario:

```
<n> / Enter   play an option         a [n]   auto-play
u             undo                   r       restart
v <player>    print a player's view  s       print the full state
l             action log             e       toggle events
m             menu                   q       quit
```

Add scenarios in `apps/scenarios/src/`. `rigPiles` from `@cardtable/games/war/testing` stacks the deck.

