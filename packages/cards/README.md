# @yannikmesserli/cards

Logic and animated React components for building card games: cards, decks, a seeded RNG, a deterministic and serializable game engine, bots, and ready-made game rules.

```sh
npm install @yannikmesserli/cards
# for the React components:
npm install react motion
```

## Entry points

| Import | Contents |
| --- | --- |
| `@yannikmesserli/cards/core` | Cards, decks, seeded RNG, helpers to stack decks in tests. No dependencies. |
| `@yannikmesserli/cards/engine` | `defineGame`, `createMatch`, `applyAction`, `replay`, player views, zone helpers (`moveCard`, `shuffleZone`, `moveMatching`…), bots. |
| `@yannikmesserli/cards/games/war` | War rules. `@yannikmesserli/cards/games/war/testing` rigs War piles. |
| `@yannikmesserli/cards/games/match` | Match, a solitaire with custom cards. |
| `@yannikmesserli/cards/react` | `useMatch` and animated cards built with Motion: `PlayingCard`, `IconCard`, `Pile`, `Arrange`, `useCardDrag` and `DropSlot`. |
| `@yannikmesserli/cards/react/styles.css` | Styles for the React components. Import it once. |

`react` and `motion` are optional peer dependencies: they are only needed for `/react`. The other entry points run anywhere, including Node.

```ts
import { createMatch, applyAction } from '@yannikmesserli/cards/engine';
import { match, PLAYER } from '@yannikmesserli/cards/games/match';

let { match: m } = createMatch(match, { players: [PLAYER], seed: 42 });
const [first] = match.legalActions(m.state, PLAYER);
const result = applyAction(match, m, PLAYER, first!); // { ok, match, events } | { ok: false, error }
```

```tsx
import { IconCard, useMatch } from '@yannikmesserli/cards/react';
import '@yannikmesserli/cards/react/styles.css';
```

See the [repository](https://github.com/yannikmesserli/cardtable) for the engine model and examples.

## License

MIT
