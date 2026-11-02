import { type Card, type CardFace, RANKS, SUITS } from './card';
import type { Rng } from './rng';

/** Fisher–Yates shuffle. Returns a new array. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** The 52 faces of a standard deck, in a fixed order. */
export function standardFaces(): CardFace[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

export interface CreateDeckOptions<F extends object = CardFace> {
  /** Faces to use, in any shape. Defaults to a standard 52 card deck. */
  faces?: readonly F[];
  /** Number of decks combined (e.g. a 6-deck blackjack shoe). */
  copies?: number;
  /** Prefix for generated ids. */
  idPrefix?: string;
}

/**
 * Creates a shuffled deck. Ids are assigned *after* shuffling, so a card's id
 * reveals nothing about its face, even when rendered face down.
 */
export function createDeck<F extends object = CardFace>(
  rng: Rng,
  { faces = standardFaces() as unknown as F[], copies = 1, idPrefix = 'c' }: CreateDeckOptions<F> = {},
): Card<F>[] {
  const all = Array.from({ length: copies }, () => faces).flat();
  return shuffle(rng, all).map((face, i) => ({ ...face, id: `${idPrefix}${i}` }));
}
