import { cardLabel, isRed, type MaybeHidden } from '@cardtable/core';
import { battleValue, type WarEvent, type WarOptions, type WarState, war } from '@cardtable/games/war';
import { rigPiles } from '@cardtable/games/war/testing';
import { styleText } from 'node:util';
import { defineScenario, type Scenario } from './scenario';

const label = (card: MaybeHidden, faceUp = true) => {
  if (!faceUp || 'hidden' in card) return styleText('dim', `[${cardLabel(card)}]`);
  const text = cardLabel(card);
  return isRed(card) ? styleText('red', text) : text;
};

const PEEK = 8;

function render(s: WarState): string {
  const head = [
    styleText('bold', s.phase === 'over' ? `After ${s.round} round${s.round === 1 ? '' : 's'}` : `Round ${s.round + 1}`),
    `phase: ${styleText('cyan', s.phase)}`,
    s.waitingFor.length ? `waiting for: ${s.waitingFor.join(', ')}` : '',
    s.wars ? styleText('yellow', `war ×${s.wars}`) : '',
  ].filter(Boolean);

  const rows = s.players.map((p) => {
    const pile = s.piles[p]!;
    const battle = s.battle[p]!.map(({ card, faceUp }) => label(card, faceUp)).join(' ');
    const value = battleValue(s, p);
    const next = pile.slice(0, PEEK).map((c) => label(c)).join(' ') + (pile.length > PEEK ? ' …' : '');
    const crown = s.roundWinner === p ? styleText('green', ' ◀ wins round') : '';
    return [
      `  ${styleText('bold', p.padEnd(4))} pile ${String(pile.length).padStart(2)}   table: ${battle || '—'}${value ? ` (${value})` : ''}${crown}`,
      styleText('dim', `       next: ${next || '—'}`),
    ].join('\n');
  });

  return [head.join(' · '), ...rows].join('\n');
}

function renderEvent(e: WarEvent): string {
  switch (e.type) {
    case 'move':
      return `move ${e.cardId} ${e.from} → ${e.to}${e.faceUp ? ' (face up)' : ''}`;
    case 'war':
      return styleText('yellow', `WAR! (depth ${e.depth})`);
    case 'round-won':
      return styleText('green', `${e.player} wins ${e.cards} cards`);
    case 'game-over':
      return styleText('magenta', `game over: ${JSON.stringify(e.outcome)}`);
  }
}

const players = ['p0', 'p1'];

const scenario = (
  id: string,
  title: string,
  description: string,
  {
    options,
    prepare,
    seed = id,
  }: { options?: WarOptions; prepare?: (s: WarState) => WarState; seed?: string | number } = {},
) =>
  defineScenario({
    id,
    title,
    description,
    game: war,
    config: { players, seed, options },
    prepare,
    render,
    renderEvent,
  });

export const warScenarios: Scenario[] = [
  scenario('war-basic', 'War: random deal', 'A normal seeded game. Step through or press "a" to auto-play to the end.'),
  scenario('war-tie', 'War: a single war', 'Both flip a 7, go to war (3 down, 1 up). p0 turns a Q against a 9 and collects 10 cards.', {
    options: { shuffleWinnings: false },
    prepare: (s) => rigPiles(s, { p0: ['7S', '2C', '3C', '4C', 'QD'], p1: ['7H', '2D', '3D', '4D', '9S'] }),
  }),
  scenario('war-double', 'War: double war', 'Tie on 7s, then tie again on queens. The second war is won by p1 with a king. 18 cards change hands.', {
    options: { shuffleWinnings: false },
    prepare: (s) =>
      rigPiles(s, {
        p0: ['7S', '2C', '3C', '4C', 'QD', '5C', '6C', '8C', '10D'],
        p1: ['7H', '2D', '3D', '4D', 'QS', '5D', '6D', '8D', 'KS'],
      }),
  }),
  scenario('war-short', 'War: short on cards', 'p0 has only 3 cards. After tying, it places 1 card face down instead of 3 and wins with a king.', {
    prepare: (s) => rigPiles(s, { p0: ['7S', '2C', 'KC'], p1: ['7H', '2D', '3D', '4D', '5D'] }, { exactly: ['p0'] }),
  }),
  scenario('war-no-cards', 'War: cannot go to war', 'p0 has a single 7 that ties. It cannot go to war and loses immediately.', {
    prepare: (s) => rigPiles(s, { p0: ['7S'], p1: ['7H'] }, { exactly: ['p0'] }),
  }),
  scenario('war-comeback', 'War: last card comeback', 'p0 has 2 aces vs 50 cards. Watch p0 win the first rounds before the game goes on.', {
    prepare: (s) => rigPiles(s, { p0: ['AS', 'AH'], p1: ['2C', '3C'] }, { exactly: ['p0'] }),
  }),
  scenario('war-last-round', 'War: final round', 'p0 holds one low card. Losing this round ends the game.', {
    prepare: (s) => rigPiles(s, { p0: ['2S'], p1: ['KH'] }, { exactly: ['p0'] }),
  }),
  scenario('war-max-rounds', 'War: round limit', 'maxRounds = 5. After 5 rounds, whoever holds more cards wins.', {
    options: { maxRounds: 5 },
  }),
];
