import { stackDeck } from '@cardtable/core';
import {
  isShuffle,
  match,
  type MatchCard,
  type MatchEvent,
  type MatchFace,
  type MatchState,
  matches,
  TRACK_GOAL,
} from '@cardtable/games/match';
import { styleText } from 'node:util';
import { defineScenario, type Scenario } from './scenario';

const COLOR_STYLE: Record<MatchFace['color'], Parameters<typeof styleText>[0]> = {
  ember: 'red',
  tide: 'cyan',
  moss: 'green',
  dusk: 'magenta',
  grey: ['bold', 'gray'],
};

const label = (card: MatchCard) => styleText(COLOR_STYLE[card.color], `${card.color}-${card.icon}`);
const list = (cards: readonly MatchCard[]) => cards.map(label).join(' ') || '—';
const PEEK = 6;
const cards = (n: number) => `${n} card${n === 1 ? '' : 's'}`;

function render(s: MatchState): string {
  return [
    styleText('bold', `Track ${s.track.length} / ${TRACK_GOAL}`) +
      (s.pending.length ? styleText('yellow', '  · shuffle card drawn: discard-hand or burn') : ''),
    `  track    ${list(s.track.slice(-PEEK))}${s.track.length > PEEK ? ' (last 6)' : ''}`,
    `  hand     ${list(s.hand)}`,
    `  discard  ${cards(s.discard.length)}${s.discard.length ? `, top ${label(s.discard.at(-1)!)}` : ''}`,
    styleText('dim', `  deck     ${cards(s.deck.length)}, next: ${list(s.deck.slice(0, PEEK))}${s.deck.length > PEEK ? ' …' : ''}`),
  ].join('\n');
}

function renderEvent(e: MatchEvent): string {
  return e.type === 'move' ? `move ${e.cardId} ${e.from} → ${e.to}` : `shuffle ${e.zone}`;
}

const scenario = (id: string, title: string, description: string, prepare?: (s: MatchState) => MatchState) =>
  defineScenario({ id, title, description, game: match, config: { players: ['solo'], seed: id }, prepare, render, renderEvent });

const rig = (change: (s: MatchState) => void) => (state: MatchState) => {
  const s = structuredClone(state);
  change(s);
  return s;
};

export const matchScenarios: Scenario[] = [
  scenario('match-basic', 'Match: random deal', 'A normal seeded game. Press "a" to auto-play to the end.'),
  scenario(
    'match-shuffle',
    'Match: shuffle card next',
    'The next card drawn is a shuffle card. Play or discard any card: the refill stops and only discard-hand and burn are offered.',
    rig((s) => {
      s.deck = stackDeck(s.deck, [isShuffle]);
    }),
  ),
  scenario(
    'match-almost-win',
    'Match: one card from the goal',
    `The track holds ${TRACK_GOAL - 1} cards and the first card in hand matches it. Play it to win.`,
    rig((s) => {
      const played = s.deck.filter((c) => !isShuffle(c)).slice(0, TRACK_GOAL - 2);
      s.deck = s.deck.filter((c) => !played.includes(c));
      s.track.unshift(...played);
      // Swap the first card in hand with a deck card that matches the track.
      const twin = s.deck.findIndex((c) => matches(c, s.track.at(-1)!));
      [s.hand[0], s.deck[twin]] = [s.deck[twin]!, s.hand[0]!];
    }),
  ),
  scenario(
    'match-last-cards',
    'Match: deck almost empty',
    'Only 2 cards are left in the deck. The third card you need to draw loses the game.',
    rig((s) => {
      const keep = s.deck.filter((c) => !isShuffle(c)).slice(0, 2);
      s.discard.push(...s.deck.filter((c) => !keep.includes(c)));
      s.deck = keep;
    }),
  ),
];
