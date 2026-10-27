import { describe, expect, it } from 'vitest';
import {
  cardLabel,
  createDeck,
  createRng,
  hide,
  isHidden,
  parseFace,
  rankValue,
  restoreRng,
  shuffle,
  standardFaces,
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

  it('ranks aces high on demand', () => {
    expect(rankValue(1)).toBe(1);
    expect(rankValue(1, { aceHigh: true })).toBe(14);
    expect(rankValue(13, { aceHigh: true })).toBe(13);
  });
});
