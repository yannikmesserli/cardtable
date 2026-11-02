import type { CardId } from '@cardtable/core';
import type { MoveEvent } from './types';
import { moveCard, type ZoneRef } from './zones';

/**
 * "Look at the top cards of the deck, discard some, put the rest back in any
 * order", split into small actions so legal actions stay few.
 *
 * The game stores this state while the arrangement is open (see the pending
 * choices convention in the README), keeps the looked-at cards in a zone of
 * its own (e.g. `peek`), and reveals that zone to the player in `playerView`.
 */
export interface ArrangeState {
  readonly minDiscard: number;
  readonly maxDiscard: number;
  discarded: number;
  /** Cards chosen to go back, top first. They stay in the peek zone until the end. */
  order: CardId[];
}

export type ArrangeAction =
  | { readonly type: 'arrange-discard'; readonly cardId: CardId }
  /** Puts a card back, below the ones already chosen. */
  | { readonly type: 'arrange-place'; readonly cardId: CardId };

export interface StartArrangeOptions {
  readonly emit: (event: MoveEvent) => void;
  /** How many cards to look at. Fewer are taken if the deck is shorter. */
  readonly count: number;
  /** Exact number of cards to discard, or a range. Default: 0. */
  readonly discard?: number | { readonly min: number; readonly max: number };
  /** Whether the move events show the cards. Default: true. */
  readonly faceUp?: boolean;
}

export interface ArrangeZones<C extends { readonly id: CardId }> {
  readonly deck: ZoneRef<C>;
  readonly peek: ZoneRef<C>;
  readonly discard: ZoneRef<C>;
}

/** Moves the top cards of `deck` to `peek`. Returns null when the deck is empty. */
export function startArrange<C extends { readonly id: CardId }>(
  deck: ZoneRef<C>,
  peek: ZoneRef<C>,
  { emit, count, discard = 0, faceUp = true }: StartArrangeOptions,
): ArrangeState | null {
  const taken = Math.min(count, deck.cards.length);
  if (taken === 0) return null;
  for (let i = 0; i < taken; i++) moveCard(deck, peek, { emit, faceUp });
  const { min, max } = typeof discard === 'number' ? { min: discard, max: discard } : discard;
  return { minDiscard: Math.min(min, taken), maxDiscard: Math.min(max, taken), discarded: 0, order: [] };
}

/** Peeked cards not chosen yet. */
export const unplaced = <C extends { readonly id: CardId }>(state: ArrangeState, peek: readonly C[]): C[] =>
  peek.filter((c) => !state.order.includes(c.id));

/** Discarding is only possible before the first card is put back. */
export const canDiscard = (state: ArrangeState, peek: readonly { readonly id: CardId }[]): boolean =>
  state.order.length === 0 && state.discarded < state.maxDiscard && unplaced(state, peek).length > 0;

export function arrangeActions(state: ArrangeState, peek: readonly { readonly id: CardId }[]): ArrangeAction[] {
  const cards = unplaced(state, peek);
  return [
    ...(canDiscard(state, peek) ? cards.map((c): ArrangeAction => ({ type: 'arrange-discard', cardId: c.id })) : []),
    ...(state.discarded >= state.minDiscard ? cards.map((c): ArrangeAction => ({ type: 'arrange-place', cardId: c.id })) : []),
  ];
}

/**
 * Applies an already validated action. When a single choice is left (the
 * last card to put back), it is made automatically. Returns true once every
 * card is discarded or back on top of the deck, in the chosen order.
 */
export function applyArrange<C extends { readonly id: CardId }>(
  state: ArrangeState,
  action: ArrangeAction,
  { deck, peek, discard }: ArrangeZones<C>,
  emit: (event: MoveEvent) => void,
): boolean {
  if (action.type === 'arrange-discard') {
    moveCard(peek, discard, { emit, faceUp: true, cardId: action.cardId });
    state.discarded++;
  } else {
    state.order.push(action.cardId);
  }

  let next = arrangeActions(state, peek.cards);
  while (next.length === 1 && next[0]!.type === 'arrange-place') {
    state.order.push(next[0]!.cardId);
    next = arrangeActions(state, peek.cards);
  }
  if (unplaced(state, peek.cards).length > 0) return false;

  for (const cardId of state.order.toReversed()) moveCard(peek, deck, { emit, faceUp: false, cardId, at: 0 });
  return true;
}
