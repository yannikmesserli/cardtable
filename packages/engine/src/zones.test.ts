import { createRng } from '@cardtable/core';
import { describe, expect, it } from 'vitest';
import { drawAccepted, type MoveEvent, moveCard, moveMatching, type ShuffleEvent, shuffleBack, shuffleZone } from './index';

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

describe('moveMatching', () => {
  const deckOf = () => ({
    zone: 'deck',
    cards: [
      { id: 'a', color: 'red', icon: 'sun' },
      { id: 'b', color: 'blue', icon: 'moon' },
      { id: 'c', color: 'blue', icon: 'sun' },
      { id: 'd', color: 'blue', icon: 'sun' },
    ],
  });

  it('moves the first matching card from the top and emits the move', () => {
    const events: MoveEvent[] = [];
    const deck = deckOf();
    const hand = { zone: 'hand', cards: [] as typeof deck.cards };
    const moved = moveMatching(deck, hand, (c) => c.color === 'blue' && c.icon === 'sun', {
      emit: (e) => events.push(e),
      faceUp: true,
    });
    expect(moved?.id).toBe('c');
    expect(hand.cards.map((c) => c.id)).toEqual(['c']);
    expect(deck.cards.map((c) => c.id)).toEqual(['a', 'b', 'd']);
    expect(events).toEqual([{ type: 'move', cardId: 'c', from: 'deck', to: 'hand', faceUp: true }]);
  });

  it('accepts a destination index', () => {
    const deck = deckOf();
    const hand = { zone: 'hand', cards: [{ id: 'x', color: 'red', icon: 'moon' }] };
    moveMatching(deck, hand, (c) => c.icon === 'moon', { emit: () => {}, faceUp: true, at: 0 });
    expect(hand.cards.map((c) => c.id)).toEqual(['b', 'x']);
  });

  it('returns null and changes nothing when no card matches', () => {
    const events: MoveEvent[] = [];
    const deck = deckOf();
    const hand = { zone: 'hand', cards: [] as typeof deck.cards };
    expect(moveMatching(deck, hand, (c) => c.color === 'green', { emit: (e) => events.push(e), faceUp: true })).toBeNull();
    expect(deck.cards).toHaveLength(4);
    expect(hand.cards).toEqual([]);
    expect(events).toEqual([]);
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

describe('drawAccepted', () => {
  const special = (c: { id: string }) => c.id.startsWith('x');

  it('sets rejected cards aside until enough cards are drawn', () => {
    const events: MoveEvent[] = [];
    const deck = { zone: 'deck', cards: cards('a', 'x1', 'b', 'x2', 'c', 'd') };
    const hand = { zone: 'hand', cards: [] };
    const aside = { zone: 'aside', cards: [] };
    const ok = drawAccepted(deck, hand, aside, { emit: (e) => events.push(e), count: 3, accept: (c) => !special(c), faceUp: true });
    expect(ok).toBe(true);
    expect(hand.cards).toEqual(cards('a', 'b', 'c'));
    expect(aside.cards).toEqual(cards('x1', 'x2'));
    expect(deck.cards).toEqual(cards('d'));
    expect(events.map((e) => `${e.cardId}>${e.to}:${e.faceUp}`)).toEqual([
      'a>hand:true',
      'x1>aside:true',
      'b>hand:true',
      'x2>aside:true',
      'c>hand:true',
    ]);
  });

  it('reports when the deck runs out', () => {
    const deck = { zone: 'deck', cards: cards('a', 'x1') };
    const hand = { zone: 'hand', cards: [] };
    const aside = { zone: 'aside', cards: [] };
    expect(drawAccepted(deck, hand, aside, { emit: () => {}, count: 2, accept: (c) => !special(c), faceUp: true })).toBe(false);
    expect(hand.cards).toEqual(cards('a'));
    expect(aside.cards).toEqual(cards('x1'));
  });
});

describe('shuffleBack', () => {
  it('returns set-aside cards face down and shuffles the deck', () => {
    const events: (MoveEvent | ShuffleEvent)[] = [];
    const deck = { zone: 'deck', cards: cards(...'abcdefgh') };
    const aside = { zone: 'aside', cards: cards('x1', 'x2') };
    shuffleBack(createRng(1), aside, deck, (e) => events.push(e));
    expect(aside.cards).toEqual([]);
    expect(deck.cards.map((c) => c.id).sort()).toEqual([...'abcdefgh', 'x1', 'x2'].sort());
    expect(events.map((e) => e.type)).toEqual(['move', 'move', 'shuffle']);
    expect(events.every((e) => e.type !== 'move' || !e.faceUp)).toBe(true);
  });

  it('does nothing without set-aside cards', () => {
    const events: ShuffleEvent[] = [];
    const deck = { zone: 'deck', cards: cards('a', 'b') };
    shuffleBack(createRng(1), { zone: 'aside', cards: [] }, deck, (e) => events.push(e as ShuffleEvent));
    expect(deck.cards).toEqual(cards('a', 'b'));
    expect(events).toEqual([]);
  });
});
