import { type Card, createDeck, hide, hidePile, type MaybeHidden, rankValue } from '@cardtable/core';
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createMatch,
  defineGame,
  isLegal,
  type MoveEvent,
  replay,
  simulate,
  viewFor,
} from './index';

/**
 * Minimal test game: each player gets a hidden card, may redraw it once, then
 * reveals it. Highest card wins.
 */
interface HighCardState<C extends MaybeHidden = Card> {
  deck: C[];
  hands: Record<string, C>;
  revealed: string[];
  redrawn: string[];
}
type HighCardAction = { type: 'reveal' } | { type: 'redraw' };

const highCard = defineGame<HighCardState, HighCardAction, MoveEvent, HighCardState<MaybeHidden>>({
  name: 'high-card',
  players: { min: 2, max: 4 },
  setup({ players, rng, emit }) {
    const deck = createDeck(rng);
    const hands: Record<string, Card> = {};
    for (const p of players) {
      const card = deck.shift() as Card;
      hands[p] = card;
      emit({ type: 'move', cardId: card.id, from: 'deck', to: `hand:${p}`, faceUp: false });
    }
    return { deck, hands, revealed: [], redrawn: [] };
  },
  activePlayers: (s) => Object.keys(s.hands).filter((p) => !s.revealed.includes(p)),
  legalActions: (s, p) =>
    s.redrawn.includes(p) ? [{ type: 'reveal' }] : [{ type: 'reveal' }, { type: 'redraw' }],
  apply(s, action, { player, rng, emit }) {
    if (action.type === 'redraw') {
      // Put the card back at a random position, then draw the top card.
      s.deck.splice(rng.int(s.deck.length + 1), 0, s.hands[player] as Card);
      s.hands[player] = s.deck.shift() as Card;
      s.redrawn.push(player);
    } else {
      s.revealed.push(player);
      emit({ type: 'move', cardId: s.hands[player]!.id, from: `hand:${player}`, to: `hand:${player}`, faceUp: true });
    }
  },
  outcome(s) {
    const players = Object.keys(s.hands);
    if (s.revealed.length < players.length) return null;
    const value = (p: string) => rankValue(s.hands[p]!.rank, { aceHigh: true });
    const best = Math.max(...players.map(value));
    const winners = players.filter((p) => value(p) === best);
    return winners.length === players.length ? { type: 'draw' } : { type: 'win', winners };
  },
  playerView: (s, viewer) => ({
    ...s,
    deck: hidePile(s.deck),
    hands: Object.fromEntries(
      Object.entries(s.hands).map(([p, c]) => [p, p === viewer || s.revealed.includes(p) ? c : hide(c)]),
    ),
  }),
});

const config = { players: ['alice', 'bob'], seed: 'test' };

/** Solo test game: flip up to 3 cards, win on an ace, lose otherwise. */
interface FindAceState {
  deck: Card[];
  flipped: Card[];
}

const findAce = defineGame<FindAceState, { type: 'flip' }>({
  name: 'find-ace',
  players: { min: 1, max: 1 },
  setup: ({ rng }) => ({ deck: createDeck(rng), flipped: [] }),
  activePlayers: () => ['solo'],
  legalActions: () => [{ type: 'flip' }],
  apply(s) {
    s.flipped.push(s.deck.shift() as Card);
  },
  outcome(s) {
    if (s.flipped.some((c) => c.rank === 1)) return { type: 'win', winners: ['solo'] };
    return s.flipped.length === 3 ? { type: 'loss', reason: 'No ace in 3 cards' } : null;
  },
});

describe('createMatch', () => {
  it('runs setup and returns setup events', () => {
    const { match, events } = createMatch(highCard, config);
    expect(match.log).toEqual([]);
    expect(match.outcome).toBeNull();
    expect(Object.keys(match.state.hands)).toEqual(['alice', 'bob']);
    expect(events.map((e) => e.to)).toEqual(['hand:alice', 'hand:bob']);
  });

  it('validates the player count', () => {
    expect(() => createMatch(highCard, { ...config, players: ['solo'] })).toThrow(/2-4 players/);
    expect(() => createMatch(highCard, { ...config, players: ['a', 'a'] })).toThrow(/unique/);
  });

  it('is deterministic for a seed', () => {
    expect(createMatch(highCard, config).match).toEqual(createMatch(highCard, config).match);
    expect(createMatch(highCard, config).match.state).not.toEqual(
      createMatch(highCard, { ...config, seed: 'other' }).match.state,
    );
  });
});

describe('applyAction', () => {
  it('applies a legal action without mutating the previous match', () => {
    const { match } = createMatch(highCard, config);
    const before = structuredClone(match);
    const result = applyAction(highCard, match, 'alice', { type: 'reveal' });
    expect(result.ok).toBe(true);
    expect(match).toEqual(before);
    if (!result.ok) return;
    expect(result.match.state.revealed).toEqual(['alice']);
    expect(result.match.log).toEqual([{ player: 'alice', action: { type: 'reveal' } }]);
    expect(result.events).toHaveLength(1);
  });

  it('rejects illegal actions', () => {
    let { match } = createMatch(highCard, config);
    const redraw = applyAction(highCard, match, 'alice', { type: 'redraw' });
    if (!redraw.ok) throw new Error('expected ok');
    match = redraw.match;

    expect(isLegal(highCard, match.state, 'alice', { type: 'redraw' })).toBe(false);
    expect(applyAction(highCard, match, 'alice', { type: 'redraw' })).toMatchObject({
      ok: false,
      error: { code: 'illegal-action' },
    });
    expect(applyAction(highCard, match, 'carol', { type: 'reveal' })).toMatchObject({
      ok: false,
      error: { code: 'not-active' },
    });
  });

  it('rejects actions once the match is over', () => {
    let { match } = createMatch(highCard, config);
    for (const p of ['alice', 'bob']) {
      const r = applyAction(highCard, match, p, { type: 'reveal' });
      if (!r.ok) throw new Error(r.error.message);
      match = r.match;
    }
    expect(match.outcome).not.toBeNull();
    expect(applyAction(highCard, match, 'alice', { type: 'reveal' })).toMatchObject({
      ok: false,
      error: { code: 'game-over' },
    });
  });

  it('threads the rng state through actions', () => {
    const { match } = createMatch(highCard, config);
    const r = applyAction(highCard, match, 'alice', { type: 'redraw' });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.match.rngState).not.toBe(match.rngState);
  });
});

describe('replay', () => {
  it('rebuilds the exact same match from config and log', () => {
    const { step } = simulate(highCard, config);
    const replayed = replay(highCard, config, step.match.log);
    expect(replayed.match).toEqual(step.match);
  });

  it('throws on an illegal log', () => {
    expect(() =>
      replay(highCard, config, [
        { player: 'alice', action: { type: 'redraw' } },
        { player: 'alice', action: { type: 'redraw' } },
      ]),
    ).toThrow(/action #1/);
  });
});

describe('viewFor', () => {
  it('hides what the player must not see', () => {
    const { match } = createMatch(highCard, config);
    const view = viewFor(highCard, match, 'alice');
    expect(view.hands.alice).toEqual(match.state.hands.alice);
    expect(view.hands.bob).toEqual({ id: match.state.hands.bob!.id, hidden: true });
    expect(view.deck.every((c) => 'hidden' in c)).toBe(true);
  });
});

describe('solo games', () => {
  it('can be won or lost by the single player', () => {
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const { step, steps } = simulate(findAce, { players: ['solo'], seed });
      expect(steps).toBeLessThanOrEqual(3);
      outcomes.add(step.match.outcome!.type);
    }
    expect(outcomes).toEqual(new Set(['win', 'loss']));
  });
});

describe('simulate', () => {
  it('plays matches to completion', () => {
    for (let seed = 0; seed < 20; seed++) {
      const { step } = simulate(highCard, { players: ['a', 'b', 'c'], seed });
      expect(step.match.outcome).not.toBeNull();
    }
  });
});
