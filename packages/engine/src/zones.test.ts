import { createRng } from '@cardtable/core';
import { describe, expect, it } from 'vitest';
import { type MoveEvent, moveCard, type ShuffleEvent, shuffleZone } from './index';

const cards = (...ids: string[]) => ids.map((id) => ({ id }));

describe('moveCard', () => {
  it('moves the top card to the end of the destination by default', () => {
    const events: MoveEvent[] = [];
    const deck = { zone: 'deck', cards: cards('a', 'b') };
    const hand = { zone: 'hand', cards: cards('x') };
    const moved = moveCard(deck, hand, { emit: (e) => events.push(e), faceUp: true });
    expect(moved).toEqual({ id: 'a' });
    expect(deck.cards).toEqual(cards('b'));
    expect(hand.cards).toEqual(cards('x', 'a'));
    expect(events).toEqual([{ type: 'move', cardId: 'a', from: 'deck', to: 'hand', faceUp: true }]);
  });

  it('moves a given card to a given index', () => {
    const hand = { zone: 'hand', cards: cards('a', 'b', 'c') };
    const deck = { zone: 'deck', cards: cards('x', 'y') };
    moveCard(hand, deck, { emit: () => {}, faceUp: false, cardId: 'b', at: 0 });
    expect(hand.cards).toEqual(cards('a', 'c'));
    expect(deck.cards).toEqual(cards('b', 'x', 'y'));
  });

  it('throws when the card is missing', () => {
    const empty = { zone: 'deck', cards: [] };
    const hand = { zone: 'hand', cards: cards('a') };
    expect(() => moveCard(empty, hand, { emit: () => {}, faceUp: false })).toThrow(/on top in deck/);
    expect(() => moveCard(hand, empty, { emit: () => {}, faceUp: false, cardId: 'z' })).toThrow(/z in hand/);
  });
});

describe('shuffleZone', () => {
  it('shuffles in place and emits a shuffle event', () => {
    const events: ShuffleEvent[] = [];
    const deck = { zone: 'deck', cards: cards(...'abcdefghij') };
    const original = deck.cards;
    shuffleZone(createRng(1), deck, (e) => events.push(e));
    expect(deck.cards).toBe(original);
    expect(deck.cards.map((c) => c.id)).not.toEqual([...'abcdefghij']);
    expect(deck.cards.map((c) => c.id).sort()).toEqual([...'abcdefghij']);
    expect(events).toEqual([{ type: 'shuffle', zone: 'deck' }]);
  });
});
