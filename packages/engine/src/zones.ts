import { type CardId, type Rng, shuffle } from '@cardtable/core';
import type { MoveEvent, ShuffleEvent, ZoneId } from './types';

/** A zone as seen by the helpers below: its id and its cards. Index 0 is the top. */
export interface ZoneRef<C extends { readonly id: CardId }> {
  readonly zone: ZoneId;
  readonly cards: C[];
}

export interface MoveCardOptions {
  readonly emit: (event: MoveEvent) => void;
  readonly faceUp: boolean;
  /** Card to move. Defaults to the top card. */
  readonly cardId?: CardId;
  /** Insertion index in the destination. Defaults to the end; use 0 for the top. */
  readonly at?: number;
}

/** Moves a card between zones, mutating both arrays, and emits the move event. */
export function moveCard<C extends { readonly id: CardId }>(
  from: ZoneRef<C>,
  to: ZoneRef<C>,
  { emit, faceUp, cardId, at = to.cards.length }: MoveCardOptions,
): C {
  const index = cardId === undefined ? 0 : from.cards.findIndex((c) => c.id === cardId);
  const card = from.cards[index];
  if (index === -1 || !card) throw new Error(`No card ${cardId ?? 'on top'} in ${from.zone}`);
  from.cards.splice(index, 1);
  to.cards.splice(at, 0, card);
  emit({ type: 'move', cardId: card.id, from: from.zone, to: to.zone, faceUp });
  return card;
}

/** Shuffles a zone in place and emits the shuffle event. */
export function shuffleZone<C extends { readonly id: CardId }>(
  rng: Rng,
  { zone, cards }: ZoneRef<C>,
  emit: (event: ShuffleEvent) => void,
): void {
  cards.splice(0, cards.length, ...shuffle(rng, cards));
  emit({ type: 'shuffle', zone });
}
