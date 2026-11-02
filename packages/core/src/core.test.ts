import { describe, expect, it } from 'vitest';
import {
  cardLabel,
  createDeck,
  createRng,
  faceIs,
  hide,
  hidePile,
  isHidden,
  parseFace,
  rankValue,
  restoreRng,
  shuffle,
  stackDeck,
  standardFaces,
  takeCards,
} from './index';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('accepts string seeds', () => {
    expect(createRng('hello').next()).toBe(createRng('hello').next());
    expect(createRng('hello').next()).not.toBe(createRng('world').next());
  });

  it('can be restored from its state', () => {
    const rng = createRng(7);
    rng.next();
    const restored = restoreRng(rng.state);
    expect(restored.next()).toBe(rng.next());
  });

  it('produces integers in range', () => {
    const rng = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });
});

describe('deck', () => {
  it('has 52 unique faces', () => {
    const faces = standardFaces();
    expect(faces).toHaveLength(52);
    expect(new Set(faces.map(cardLabel)).size).toBe(52);
  });

  it('shuffle returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const output = shuffle(createRng(3), input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...output].sort()).toEqual(input);
  });

  it('assigns ids after shuffling, so ids do not reveal faces', () => {
    const a = createDeck(createRng(1));
    const b = createDeck(createRng(2));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a.map(cardLabel)).not.toEqual(b.map(cardLabel));
  });

  it('supports multiple copies with unique ids', () => {
    const shoe = createDeck(createRng(1), { copies: 6 });
    expect(shoe).toHaveLength(312);
    expect(new Set(shoe.map((c) => c.id)).size).toBe(312);
  });

  it('accepts custom faces', () => {
    const faces = [{ color: 'red', symbol: 'sun' }, { color: 'blue', symbol: 'moon' }] as const;
    const deck = createDeck(createRng(1), { faces, copies: 2, idPrefix: 'x' });
    expect(deck).toHaveLength(4);
    expect(deck.map((c) => c.id)).toEqual(['x0', 'x1', 'x2', 'x3']);
    expect(deck.filter((c) => c.color === 'red')).toHaveLength(2);
    expect(hide(deck[0]!)).toEqual({ id: 'x0', hidden: true });
  });
});

describe('card helpers', () => {
  it('parses labels', () => {
    expect(parseFace('AS')).toEqual({ rank: 1, suit: 'spades' });
    expect(parseFace('10h')).toEqual({ rank: 10, suit: 'hearts' });
    expect(parseFace('K♦')).toEqual({ rank: 13, suit: 'diamonds' });
    expect(() => parseFace('1X')).toThrow();
  });

  it('formats labels', () => {
    expect(cardLabel({ rank: 12, suit: 'clubs' })).toBe('Q♣');
    expect(cardLabel(hide({ id: 'c1', rank: 12, suit: 'clubs' }))).toBe('🂠');
  });

  it('hides a card, keeping only its id', () => {
    const hidden = hide({ id: 'c9', rank: 5, suit: 'hearts' });
    expect(hidden).toEqual({ id: 'c9', hidden: true });
    expect(isHidden(hidden)).toBe(true);
  });

  it('hides the order of a pile', () => {
    const deck = createDeck(createRng(1)).slice(0, 5);
    const view = hidePile(deck);
    expect(view.every(isHidden)).toBe(true);
    expect(hidePile(shuffle(createRng(2), deck))).toEqual(view);
    expect(view.map((c) => c.id).sort()).toEqual(deck.map((c) => c.id).sort());
  });

  it('ranks aces high on demand', () => {
    expect(rankValue(1)).toBe(1);
    expect(rankValue(1, { aceHigh: true })).toBe(14);
    expect(rankValue(13, { aceHigh: true })).toBe(13);
  });
});

describe('stacking', () => {
  it('puts picked cards on top, in order, keeping the rest in place', () => {
    const deck = createDeck(createRng(1));
    const stacked = stackDeck(deck, [faceIs('KS'), faceIs('2h')]);
    expect(stacked.slice(0, 2).map(cardLabel)).toEqual(['K♠', '2♥']);
    expect(stacked.slice(2)).toEqual(deck.filter((c) => !['K♠', '2♥'].includes(cardLabel(c))));
    expect(deck).toHaveLength(52);
  });

  it('works with custom faces and predicates', () => {
    const pool = [{ id: 'a', color: 'red' }, { id: 'b', color: 'blue' }, { id: 'c', color: 'red' }];
    expect(takeCards(pool, [(c) => c.color === 'red', (c) => c.color === 'red'])).toEqual([
      { id: 'a', color: 'red' },
      { id: 'c', color: 'red' },
    ]);
    expect(pool).toEqual([{ id: 'b', color: 'blue' }]);
  });

  it('throws when a pick has no match left', () => {
    expect(() => stackDeck(createDeck(createRng(1)), [faceIs('AS'), faceIs('AS')])).toThrow(/pick #1/);
  });
});
