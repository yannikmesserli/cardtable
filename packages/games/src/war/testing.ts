import { type Card, faceIs, takeCards } from '@cardtable/core';
import type { PlayerId } from '@cardtable/engine';
import type { WarState } from './war';

export interface RigOptions {
  /** These players get exactly the listed cards; the rest goes to the others. */
  exactly?: readonly PlayerId[];
}

/**
 * Returns a copy of a fresh War state with stacked piles, for tests and
 * scenarios. Listed cards (e.g. `['K♠', '2h']`) go on top of the given
 * player's pile, in order. Remaining cards are dealt alternately to the
 * players not listed in `exactly`. The battle area must be empty.
 */
export function rigPiles(state: WarState, tops: Partial<Record<PlayerId, readonly string[]>>, { exactly = [] }: RigOptions = {}): WarState {
  if (state.players.some((p) => state.battle[p]!.length > 0)) throw new Error('Cannot rig piles during a battle');

  const pool: Card[] = state.players.flatMap((p) => state.piles[p]!);
  const piles: Record<PlayerId, Card[]> = {};
  for (const p of state.players) piles[p] = takeCards(pool, (tops[p] ?? []).map(faceIs));

  const fillers = state.players.filter((p) => !exactly.includes(p));
  if (fillers.length === 0 && pool.length > 0) throw new Error(`${pool.length} cards left over`);
  pool.forEach((card, i) => piles[fillers[i % fillers.length]!]!.push(card));

  return { ...structuredClone(state), piles };
}
