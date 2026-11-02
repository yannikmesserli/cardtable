import { stackDeck } from '@cardtable/core';
import { type Match, applyAction, createMatch, simulate } from '@cardtable/engine';
import { describe, expect, it } from 'vitest';
import {
  BURN,
  DECK_SIZE,
  HAND_SIZE,
  isShuffle,
  match,
  type MatchAction,
  type MatchState,
  matches,
  PLAYER,
  SHUFFLE_CARDS,
  TRACK_GOAL,
} from './match';

const config = { players: [PLAYER], seed: 'test' };
type M = Match<MatchState, MatchAction>;

function act(m: M, action: MatchAction): M {
  const result = applyAction(match, m, PLAYER, action);
  if (!result.ok) throw new Error(result.error.message);
  return result.match;
}

const withState = (m: M, change: (s: MatchState) => void): M => {
  const state = structuredClone(m.state);
  change(state);
  return { ...m, state };
};

describe('match', () => {
  it('deals a hand and starts the track with one card, without shuffle cards', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { match: m } = createMatch(match, { ...config, seed });
      expect(m.state.hand).toHaveLength(HAND_SIZE);
      expect(m.state.track).toHaveLength(1);
      expect([...m.state.hand, ...m.state.track].some(isShuffle)).toBe(false);
      expect(m.state.deck).toHaveLength(DECK_SIZE - HAND_SIZE - 1);
      expect(m.state.deck.filter(isShuffle)).toHaveLength(SHUFFLE_CARDS);
    }
  });

  it('only allows matching cards on the track, and any card to the discard pile', () => {
    const { match: m } = createMatch(match, config);
    const top = m.state.track.at(-1)!;
    const legal = match.legalActions(m.state, PLAYER);
    for (const card of m.state.hand) {
      expect(legal).toContainEqual({ type: 'discard', cardId: card.id });
      expect(legal.some((a) => a.type === 'play' && a.cardId === card.id)).toBe(matches(card, top));
    }
  });

  it('refills the hand to 5 after playing or discarding', () => {
    const { match: m } = createMatch(match, config);
    const after = act(m, { type: 'discard', cardId: m.state.hand[0]!.id });
    expect(after.state.discard).toEqual([m.state.hand[0]]);
    expect(after.state.hand).toHaveLength(HAND_SIZE);
    expect(after.state.hand).toContainEqual(m.state.deck[0]);
  });

  it('wins when the track reaches the goal', () => {
    const { match: m } = createMatch(match, config);
    const rigged = withState(m, (s) => {
      // Put a matching card in hand and 8 more cards on the track.
      const top = s.track[0]!;
      const twin = s.deck.findIndex((c) => matches(c, top));
      s.hand[0] = s.deck.splice(twin, 1)[0]!;
      s.track.unshift(...s.deck.splice(0, TRACK_GOAL - 2));
    });
    const after = act(rigged, { type: 'play', cardId: rigged.state.hand[0]!.id });
    expect(after.state.track).toHaveLength(TRACK_GOAL);
    expect(after.outcome).toMatchObject({ type: 'win' });
  });

  it('loses when a card must be drawn from an empty deck', () => {
    const { match: m } = createMatch(match, config);
    const empty = withState(m, (s) => s.discard.push(...s.deck.splice(0)));
    const after = act(empty, { type: 'discard', cardId: empty.state.hand[0]!.id });
    expect(after.outcome).toMatchObject({ type: 'loss' });
  });

  describe('shuffle cards', () => {
    /** A match where the next card drawn is a shuffle card, and the next action discards. */
    const shuffleNext = (): M => {
      const { match: m } = createMatch(match, config);
      return withState(m, (s) => {
        s.deck = stackDeck(s.deck, [isShuffle]);
      });
    };

    it('pause the refill until the player chooses', () => {
      const m = shuffleNext();
      const after = act(m, { type: 'discard', cardId: m.state.hand[0]!.id });
      expect(after.state.pending.map(isShuffle)).toEqual([true]);
      expect(after.state.hand).toHaveLength(HAND_SIZE - 1);
      expect(match.legalActions(after.state, PLAYER)).toEqual([{ type: 'discard-hand' }, { type: 'burn' }]);
    });

    it('can discard the whole hand, then draw a new one', () => {
      let m = shuffleNext();
      m = act(m, { type: 'discard', cardId: m.state.hand[0]!.id });
      const oldHand = m.state.hand;
      m = act(m, { type: 'discard-hand' });
      expect(m.state.discard).toEqual(expect.arrayContaining(oldHand));
      expect(m.state.discard.filter(isShuffle)).toHaveLength(1);
      expect(m.state.hand.some((c) => oldHand.some((o) => o.id === c.id))).toBe(false);
      // A full new hand, unless the refill stopped on another shuffle card.
      expect(m.state.hand.length === HAND_SIZE || m.state.pending.length === 1).toBe(true);
    });

    it('can burn the top cards of the deck', () => {
      let m = shuffleNext();
      m = act(m, { type: 'discard', cardId: m.state.hand[0]!.id });
      const burned = m.state.deck.slice(0, BURN);
      const hand = m.state.hand;
      m = act(m, { type: 'burn' });
      expect(m.state.discard).toEqual(expect.arrayContaining(burned));
      // Discarded card + burned cards + the shuffle card.
      expect(m.state.discard).toHaveLength(1 + BURN + 1);
      expect(m.state.hand.slice(0, hand.length)).toEqual(hand);
    });
  });

  it('hides the deck, order included', () => {
    const { match: m } = createMatch(match, config);
    const view = match.playerView!(m.state, PLAYER);
    expect(view.deck.every((c) => 'hidden' in c)).toBe(true);
    expect(view.deck.map((c) => c.id)).toEqual(m.state.deck.map((c) => c.id).sort());
  });

  it('always ends, keeps every card, and can be won or lost', () => {
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const { step } = simulate(match, { players: [PLAYER], seed }, {
        onStep({ match: { state: s } }) {
          expect(s.deck.length + s.hand.length + s.track.length + s.discard.length + s.pending.length).toBe(DECK_SIZE);
          expect([...s.hand, ...s.track].some(isShuffle)).toBe(false);
          expect(s.pending.length).toBeLessThanOrEqual(1);
        },
      });
      outcomes.add(step.match.outcome!.type);
    }
    expect(outcomes).toEqual(new Set(['win', 'loss']));
  });
});
