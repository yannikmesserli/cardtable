import { type Card, createDeck } from '@cardtable/core';
import { describe, expect, it } from 'vitest';
import {
  type ArrangeAction,
  type ArrangeState,
  applyArrange,
  arrangeActions,
  defineGame,
  type MoveEvent,
  simulate,
  startArrange,
} from './index';

const cards = (...ids: string[]) => ids.map((id) => ({ id }));
const zones = (deck: string[], peek: string[] = []) => ({
  deck: { zone: 'deck', cards: cards(...deck) },
  peek: { zone: 'peek', cards: cards(...peek) },
  discard: { zone: 'discard', cards: [] as { id: string }[] },
});
const ids = (list: { id: string }[]) => list.map((c) => c.id);
const noop = () => {};

describe('arrange', () => {
  it('discards first, then puts the rest back in the chosen order', () => {
    const z = zones(['a', 'b', 'c', 'd', 'e', 'f']);
    const state = startArrange(z.deck, z.peek, { emit: noop, count: 4, discard: 1 })!;
    expect(ids(z.peek.cards)).toEqual(['a', 'b', 'c', 'd']);
    expect(arrangeActions(state, z.peek.cards).every((a) => a.type === 'arrange-discard')).toBe(true);

    expect(applyArrange(state, { type: 'arrange-discard', cardId: 'c' }, z, noop)).toBe(false);
    expect(arrangeActions(state, z.peek.cards).map((a) => a.type)).toEqual(['arrange-place', 'arrange-place', 'arrange-place']);
    expect(applyArrange(state, { type: 'arrange-place', cardId: 'd' }, z, noop)).toBe(false);
    // Two cards left: choosing one puts the last one back automatically.
    expect(applyArrange(state, { type: 'arrange-place', cardId: 'a' }, z, noop)).toBe(true);

    expect(ids(z.deck.cards)).toEqual(['d', 'a', 'b', 'e', 'f']);
    expect(ids(z.discard.cards)).toEqual(['c']);
    expect(z.peek.cards).toEqual([]);
  });

  it('supports a discard range', () => {
    const z = zones(['a', 'b', 'c']);
    const state = startArrange(z.deck, z.peek, { emit: noop, count: 3, discard: { min: 0, max: 2 } })!;
    expect(arrangeActions(state, z.peek.cards)).toHaveLength(6);
    applyArrange(state, { type: 'arrange-discard', cardId: 'a' }, z, noop);
    expect(arrangeActions(state, z.peek.cards)).toHaveLength(4);
    applyArrange(state, { type: 'arrange-place', cardId: 'c' }, z, noop);
    // Discarding is closed once a card is put back.
    expect(ids(z.deck.cards)).toEqual(['c', 'b']);
  });

  it('can discard every card', () => {
    const z = zones(['a', 'b']);
    const state = startArrange(z.deck, z.peek, { emit: noop, count: 5, discard: 2 })!;
    expect(state).toMatchObject({ minDiscard: 2, maxDiscard: 2 });
    applyArrange(state, { type: 'arrange-discard', cardId: 'a' }, z, noop);
    expect(applyArrange(state, { type: 'arrange-discard', cardId: 'b' }, z, noop)).toBe(true);
    expect(z.deck.cards).toEqual([]);
  });

  it('takes what is left from a short deck, and nothing from an empty one', () => {
    const z = zones(['a', 'b']);
    expect(startArrange(z.deck, z.peek, { emit: noop, count: 5, discard: 1 })).toMatchObject({ maxDiscard: 1 });
    expect(ids(z.peek.cards)).toEqual(['a', 'b']);
    expect(startArrange(z.deck, z.peek, { emit: noop, count: 5 })).toBeNull();
  });

  it('emits face-up moves to the peek zone and face-down moves back', () => {
    const events: MoveEvent[] = [];
    const z = zones(['a', 'b', 'c']);
    const state = startArrange(z.deck, z.peek, { emit: (e) => events.push(e), count: 2 })!;
    applyArrange(state, { type: 'arrange-place', cardId: 'b' }, z, (e) => events.push(e));
    expect(events.map((e) => `${e.cardId} ${e.from}>${e.to} ${e.faceUp ? 'up' : 'down'}`)).toEqual([
      'a deck>peek up',
      'b deck>peek up',
      'a peek>deck down',
      'b peek>deck down',
    ]);
    expect(ids(z.deck.cards)).toEqual(['b', 'a', 'c']);
  });
});

/** Solo test game: peek at the top 5 cards and discard 1, until the deck is empty. */
interface PeekState {
  deck: Card[];
  peek: Card[];
  discard: Card[];
  arrange: ArrangeState | null;
}
type PeekAction = { type: 'peek' } | ArrangeAction;

const peekGame = defineGame<PeekState, PeekAction, MoveEvent>({
  name: 'peek',
  players: { min: 1, max: 1 },
  setup: ({ rng }) => ({ deck: createDeck(rng), peek: [], discard: [], arrange: null }),
  activePlayers: (s) => (s.deck.length + s.peek.length > 0 ? ['solo'] : []),
  legalActions: (s) => (s.arrange ? arrangeActions(s.arrange, s.peek) : [{ type: 'peek' }]),
  apply(s, action, { emit }) {
    const z = { deck: { zone: 'deck', cards: s.deck }, peek: { zone: 'peek', cards: s.peek }, discard: { zone: 'discard', cards: s.discard } };
    if (action.type === 'peek') s.arrange = startArrange(z.deck, z.peek, { emit, count: 5, discard: 1 });
    else if (applyArrange(s.arrange!, action, z, emit)) s.arrange = null;
  },
  outcome: (s) => (s.deck.length + s.peek.length === 0 ? { type: 'loss', reason: 'Deck empty' } : null),
});

describe('arrange in a game', () => {
  it('keeps every card and discards one per peek', () => {
    const { step } = simulate(peekGame, { players: ['solo'], seed: 3 }, {
      onStep({ match: { state: s } }) {
        expect(s.deck.length + s.peek.length + s.discard.length).toBe(52);
        if (!s.arrange) expect(s.peek).toEqual([]);
      },
    });
    expect(step.match.state.discard).toHaveLength(52);
    const peeks = step.match.log.filter((l) => l.action.type === 'peek').length;
    expect(peeks).toBe(52);
  });
});
