import { type CardId, type CardPick, type Rng, shuffle } from '@cardtable/core';
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

/**
 * Moves the first card of `from` (from the top) that matches `pick`, e.g. to
 * search the deck for a given card. Returns it, or null when none matches.
 */
export function moveMatching<C extends { readonly id: CardId }>(
  from: ZoneRef<C>,
  to: ZoneRef<C>,
  pick: CardPick<C>,
  options: Omit<MoveCardOptions, 'cardId'>,
): C | null {
  const card = from.cards.find(pick);
  return card ? moveCard(from, to, { ...options, cardId: card.id }) : null;
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

export interface DrawAcceptedOptions<C> {
  readonly emit: (event: MoveEvent) => void;
  /** Number of accepted cards to draw. */
  readonly count: number;
  /** Cards that may go to the destination. The others are set aside. */
  readonly accept: (card: C) => boolean;
  /** Whether drawn cards are face up. */
  readonly faceUp: boolean;
  /** Whether set-aside cards are face up. Default: true, since they were revealed. */
  readonly asideFaceUp?: boolean;
}

/**
 * Draws from the top of `from` until `count` accepted cards have gone to
 * `to`, setting the others aside, e.g. to deal a hand without special cards.
 * Returns false when `from` ran out first. See `shuffleBack`.
 */
export function drawAccepted<C extends { readonly id: CardId }>(
  from: ZoneRef<C>,
  to: ZoneRef<C>,
  aside: ZoneRef<C>,
  { emit, count, accept, faceUp, asideFaceUp = true }: DrawAcceptedOptions<C>,
): boolean {
  let drawn = 0;
  while (drawn < count) {
    const top = from.cards[0];
    if (!top) return false;
    if (accept(top)) {
      moveCard(from, to, { emit, faceUp });
      drawn++;
    } else {
      moveCard(from, aside, { emit, faceUp: asideFaceUp });
    }
  }
  return true;
}

/** Moves every set-aside card back into `deck`, then shuffles it. Does nothing when `aside` is empty. */
export function shuffleBack<C extends { readonly id: CardId }>(
  rng: Rng,
  aside: ZoneRef<C>,
  deck: ZoneRef<C>,
  emit: (event: MoveEvent | ShuffleEvent) => void,
): void {
  if (aside.cards.length === 0) return;
  while (aside.cards.length > 0) moveCard(aside, deck, { emit, faceUp: false });
  shuffleZone(rng, deck, emit);
}
