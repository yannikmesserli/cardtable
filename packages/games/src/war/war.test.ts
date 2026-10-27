import { cardLabel } from '@cardtable/core';
import { applyAction, createMatch, type Match, replay, simulate, viewFor } from '@cardtable/engine';
import { describe, expect, it } from 'vitest';
import { rigPiles } from './testing';
import { type WarAction, type WarEvent, type WarOptions, type WarState, war } from './war';

type WarMatch = Match<WarState, WarAction, WarOptions>;

const players = ['p0', 'p1'] as const;

function rigged(tops: Parameters<typeof rigPiles>[1], options?: WarOptions, exactly?: string[]): WarMatch {
  const { match } = createMatch(war, { players, seed: 1, options: { shuffleWinnings: false, ...options } });
  return { ...match, state: rigPiles(match.state, tops, { exactly }) };
}

function act(match: WarMatch, ...moves: [string, WarAction['type']][]): { match: WarMatch; events: WarEvent[] } {
  const events: WarEvent[] = [];
  for (const [player, type] of moves) {
    const result = applyAction(war, match, player, { type } as WarAction);
    if (!result.ok) throw new Error(result.error.message);
    match = result.match;
    events.push(...result.events);
  }
  return { match, events };
}

const labels = (match: WarMatch, player: string) => match.state.piles[player]!.map(cardLabel);
const total = (s: WarState) =>
  s.players.reduce((n, p) => n + s.piles[p]!.length + s.battle[p]!.length, 0);

describe('setup', () => {
  it('deals 26 cards to each player, face down', () => {
    const { match, events } = createMatch(war, { players, seed: 'deal' });
    expect(match.state.piles.p0).toHaveLength(26);
    expect(match.state.piles.p1).toHaveLength(26);
    expect(match.state.phase).toBe('flip');
    expect(match.state.waitingFor).toEqual(['p0', 'p1']);
    expect(events).toHaveLength(52);
    expect(events.every((e) => e.type === 'move' && !e.faceUp)).toBe(true);
  });

  it('requires exactly two players', () => {
    expect(() => createMatch(war, { players: ['a', 'b', 'c'], seed: 1 })).toThrow();
  });
});

describe('a round', () => {
  it('lets both players flip in any order, then the higher card collects', () => {
    let match = rigged({ p0: ['5S'], p1: ['KH'] });
    ({ match } = act(match, ['p1', 'flip']));
    expect(match.state.waitingFor).toEqual(['p0']);
    expect(applyAction(war, match, 'p1', { type: 'flip' }).ok).toBe(false);

    ({ match } = act(match, ['p0', 'flip']));
    expect(match.state.phase).toBe('collect');
    expect(match.state.roundWinner).toBe('p1');
    expect(applyAction(war, match, 'p0', { type: 'collect' }).ok).toBe(false);

    const { match: after, events } = act(match, ['p1', 'collect']);
    expect(after.state.phase).toBe('flip');
    expect(after.state.round).toBe(1);
    expect(after.state.piles.p0).toHaveLength(25);
    expect(after.state.piles.p1).toHaveLength(27);
    expect(labels(after, 'p1').slice(-2)).toEqual(['K♥', '5♠']);
    expect(events.at(-1)).toEqual({ type: 'round-won', player: 'p1', cards: 2 });
  });

  it('treats aces as high', () => {
    const { match } = act(rigged({ p0: ['AS'], p1: ['KH'] }), ['p0', 'flip'], ['p1', 'flip']);
    expect(match.state.roundWinner).toBe('p0');
  });
});

describe('war', () => {
  it('goes to war on a tie and the winner takes all 10 cards', () => {
    let match = rigged({ p0: ['7S', '2C', '3C', '4C', 'QD'], p1: ['7H', '2D', '3D', '4D', '9S'] });
    let events: WarEvent[];
    ({ match, events } = act(match, ['p0', 'flip'], ['p1', 'flip']));
    expect(match.state.phase).toBe('war');
    expect(events.at(-1)).toEqual({ type: 'war', depth: 1 });

    ({ match } = act(match, ['p0', 'war'], ['p1', 'war']));
    expect(match.state.battle.p0!.map((c) => c.faceUp)).toEqual([true, false, false, false, true]);
    expect(match.state.roundWinner).toBe('p0');

    ({ match } = act(match, ['p0', 'collect']));
    expect(match.state.piles.p0).toHaveLength(26 - 5 + 10);
    expect(match.state.piles.p1).toHaveLength(26 - 5);
  });

  it('chains wars on repeated ties', () => {
    let match = rigged({
      p0: ['7S', '2C', '3C', '4C', 'QD', '5C', '6C', '8C', 'AD'],
      p1: ['7H', '2D', '3D', '4D', 'QS', '5D', '6D', '8D', '9S'],
    });
    ({ match } = act(match, ['p0', 'flip'], ['p1', 'flip'], ['p0', 'war'], ['p1', 'war']));
    expect(match.state.phase).toBe('war');
    expect(match.state.wars).toBe(2);
    ({ match } = act(match, ['p0', 'war'], ['p1', 'war'], ['p0', 'collect']));
    expect(match.state.piles.p0).toHaveLength(26 + 9);
    expect(match.state.wars).toBe(0);
  });

  it('places fewer face-down cards when a player is short', () => {
    const match = rigged({ p0: ['7S', '2C', 'KC'], p1: ['7H', '2D', '3D', '4D', '5D'] }, {}, ['p0']);
    const { match: after } = act(match, ['p0', 'flip'], ['p1', 'flip'], ['p0', 'war'], ['p1', 'war']);
    expect(after.state.battle.p0!.map((c) => c.faceUp)).toEqual([true, false, true]);
    expect(after.state.roundWinner).toBe('p0');
  });

  it('a player who cannot go to war loses', () => {
    const match = rigged({ p0: ['7S'], p1: ['7H'] }, {}, ['p0']);
    const { match: after, events } = act(match, ['p0', 'flip'], ['p1', 'flip']);
    expect(after.outcome).toEqual({ type: 'win', winners: ['p1'], reason: 'p0 cannot go to war' });
    expect(after.state.phase).toBe('over');
    expect(events.at(-1)).toMatchObject({ type: 'game-over' });
  });
});

describe('end of the game', () => {
  it('ends when the loser of a round has no cards left', () => {
    const match = rigged({ p0: ['2S'], p1: ['3H'] }, {}, ['p0']);
    const { match: after } = act(match, ['p0', 'flip'], ['p1', 'flip'], ['p1', 'collect']);
    expect(after.outcome).toEqual({ type: 'win', winners: ['p1'], reason: 'p0 has no cards left' });
    expect(after.state.piles.p1).toHaveLength(52);
  });

  it('ends after maxRounds, most cards wins', () => {
    const match = rigged({ p0: ['AS'], p1: ['2H'] }, { maxRounds: 1 });
    const { match: after } = act(match, ['p0', 'flip'], ['p1', 'flip'], ['p0', 'collect']);
    expect(after.outcome).toMatchObject({ type: 'win', winners: ['p0'] });
  });
});

describe('player view', () => {
  it('hides piles and face-down war cards', () => {
    let match = rigged({ p0: ['7S', '2C', '3C', '4C', 'QD'], p1: ['7H', '2D', '3D', '4D', '9S'] });
    ({ match } = act(match, ['p0', 'flip'], ['p1', 'flip'], ['p0', 'war']));
    const view = viewFor(war, match, 'p0');
    expect(view.piles.p0!.every((c) => 'hidden' in c)).toBe(true);
    expect(view.battle.p0!.map((p) => cardLabel(p.card))).toEqual(['7♠', '🂠', '🂠', '🂠', 'Q♦']);
    // Ids survive redaction so renderers can animate cards.
    expect(view.piles.p1!.map((c) => c.id)).toEqual(match.state.piles.p1!.map((c) => c.id));
  });
});

describe('full games', () => {
  it('always terminates, conserves 52 cards and replays identically', () => {
    for (let seed = 0; seed < 30; seed++) {
      const config = { players, seed };
      const { step } = simulate(war, config, {
        onStep: ({ match }) => {
          expect(total(match.state)).toBe(52);
          const ids = match.state.players.flatMap((p) => [
            ...match.state.piles[p]!.map((c) => c.id),
            ...match.state.battle[p]!.map((c) => c.card.id),
          ]);
          expect(new Set(ids).size).toBe(52);
        },
      });
      expect(step.match.outcome).not.toBeNull();
      expect(replay(war, config, step.match.log).match).toEqual(step.match);
    }
  });
});
