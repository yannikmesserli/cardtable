import { type CardFace, parseFace, sameFace } from './card';

/** Selects a card, e.g. `faceIs('K♠')` or `(c) => c.color === 'red'`. */
export type CardPick<C> = (card: C) => boolean;

/**
 * Removes from `pool` the first card matching each pick, in order, and
 * returns them. Throws when a pick matches no remaining card.
 */
export function takeCards<C>(pool: C[], picks: readonly CardPick<C>[]): C[] {
  return picks.map((pick, i) => {
    const index = pool.findIndex(pick);
    if (index === -1) throw new Error(`No card left for pick #${i} (listed twice?)`);
    return pool.splice(index, 1)[0] as C;
  });
}

/**
 * Returns a copy of `cards` with the picked cards on top (index 0), in
 * order; the other cards keep their order. Handy to rig decks in tests and
 * scenarios.
 */
export function stackDeck<C>(cards: readonly C[], picks: readonly CardPick<C>[]): C[] {
  const rest = [...cards];
  return [...takeCards(rest, picks), ...rest];
}

/** Picks a standard card by label, e.g. `K♠` or `10h`. */
export function faceIs(label: string): CardPick<CardFace> {
  const face = parseFace(label);
  return (card) => sameFace(card, face);
}
