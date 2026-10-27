import { type Card, createDeck, hide, type MaybeHidden, rankValue, shuffle } from '@cardtable/core';
import { defineGame, type GameDefinition, type MoveEvent, type Outcome, type PlayerId } from '@cardtable/engine';

export interface WarOptions {
  /** Face-down cards placed during a war. Default: 3. */
  warCards?: number;
  /** Ends the match after this many rounds; most cards wins. Default: 2000. */
  maxRounds?: number;
  /**
   * Shuffle won cards before putting them under the pile. Default: true.
   * Without it, many deals loop forever.
   */
  shuffleWinnings?: boolean;
}

export type WarAction = { readonly type: 'flip' } | { readonly type: 'war' } | { readonly type: 'collect' };

/**
 * - `flip`: every player in `waitingFor` turns their top card face up.
 * - `war`: the face-up cards tied; every player in `waitingFor` places cards for the war.
 * - `collect`: `roundWinner` takes all cards on the table.
 * - `over`: see `outcome`.
 */
export type WarPhase = 'flip' | 'war' | 'collect' | 'over';

export interface PlayedCard<C extends MaybeHidden = Card> {
  readonly card: C;
  readonly faceUp: boolean;
}

export interface WarState<C extends MaybeHidden = Card> {
  readonly options: Required<WarOptions>;
  readonly players: readonly [PlayerId, PlayerId];
  /** Index 0 is the top of the pile. */
  readonly piles: Record<PlayerId, C[]>;
  /** Cards on the table, in play order. The last face-up card is the one that counts. */
  readonly battle: Record<PlayerId, PlayedCard<C>[]>;
  phase: WarPhase;
  waitingFor: PlayerId[];
  roundWinner: PlayerId | null;
  /** Completed rounds. */
  round: number;
  /** Wars fought in the current round. */
  wars: number;
  outcome: Outcome | null;
}

export type WarView = WarState<MaybeHidden>;

export type WarEvent =
  | MoveEvent
  | { readonly type: 'round-won'; readonly player: PlayerId; readonly cards: number }
  | { readonly type: 'war'; readonly depth: number }
  | { readonly type: 'game-over'; readonly outcome: Outcome };

export const DEFAULT_WAR_OPTIONS: Required<WarOptions> = {
  warCards: 3,
  maxRounds: 2000,
  shuffleWinnings: true,
};

export const pileZone = (player: PlayerId): string => `pile:${player}`;
export const battleZone = (player: PlayerId): string => `battle:${player}`;

const opponent = (s: WarState, player: PlayerId): PlayerId =>
  s.players[0] === player ? s.players[1] : s.players[0];

/** Value of the card that currently counts for a player. */
export function battleValue(s: WarState, player: PlayerId): number | null {
  const up = s.battle[player]?.findLast((p) => p.faceUp);
  return up ? rankValue(up.card.rank, { aceHigh: true }) : null;
}

function play(s: WarState, player: PlayerId, faceUp: boolean, emit: (e: WarEvent) => void) {
  const card = s.piles[player]!.shift();
  if (!card) throw new Error(`${player} has no card to play`);
  s.battle[player]!.push({ card, faceUp });
  emit({ type: 'move', cardId: card.id, from: pileZone(player), to: battleZone(player), faceUp });
}

function end(s: WarState, outcome: Outcome, emit: (e: WarEvent) => void) {
  s.phase = 'over';
  s.waitingFor = [];
  s.outcome = outcome;
  emit({ type: 'game-over', outcome });
}

/** Called once every player has played for the current flip or war. */
function resolve(s: WarState, emit: (e: WarEvent) => void) {
  const [a, b] = s.players;
  const va = battleValue(s, a)!;
  const vb = battleValue(s, b)!;

  if (va !== vb) {
    s.roundWinner = va > vb ? a : b;
    s.phase = 'collect';
    s.waitingFor = [s.roundWinner];
    return;
  }

  // Tie: everyone must go to war, which needs at least one card.
  const broke = s.players.filter((p) => s.piles[p]!.length === 0);
  if (broke.length === 2) return end(s, { type: 'draw', reason: 'Both players ran out of cards during a war' }, emit);
  if (broke.length === 1) {
    const loser = broke[0]!;
    return end(s, { type: 'win', winners: [opponent(s, loser)], reason: `${loser} cannot go to war` }, emit);
  }

  s.wars++;
  s.phase = 'war';
  s.waitingFor = [...s.players];
  emit({ type: 'war', depth: s.wars });
}

function countCards(s: WarState, player: PlayerId): number {
  return s.piles[player]!.length + s.battle[player]!.length;
}

export const war: GameDefinition<WarState, WarAction, WarEvent, WarView, WarOptions> = defineGame<WarState, WarAction, WarEvent, WarView, WarOptions>({
  name: 'war',
  players: { min: 2, max: 2 },

  setup({ players, rng, options, emit }) {
    const [a, b] = players as [PlayerId, PlayerId];
    const piles: Record<PlayerId, Card[]> = { [a]: [], [b]: [] };
    createDeck(rng).forEach((card, i) => {
      const player = i % 2 === 0 ? a : b;
      piles[player]!.push(card);
      emit({ type: 'move', cardId: card.id, from: 'deck', to: pileZone(player), faceUp: false });
    });
    return {
      options: { ...DEFAULT_WAR_OPTIONS, ...options },
      players: [a, b],
      piles,
      battle: { [a]: [], [b]: [] },
      phase: 'flip',
      waitingFor: [a, b],
      roundWinner: null,
      round: 0,
      wars: 0,
      outcome: null,
    };
  },

  activePlayers: (s) => s.waitingFor,

  legalActions(s, player) {
    if (!s.waitingFor.includes(player)) return [];
    switch (s.phase) {
      case 'flip':
        return [{ type: 'flip' }];
      case 'war':
        return [{ type: 'war' }];
      case 'collect':
        return [{ type: 'collect' }];
      case 'over':
        return [];
    }
  },

  apply(s, action, { player, rng, emit }) {
    switch (action.type) {
      case 'flip': {
        play(s, player, true, emit);
        break;
      }
      case 'war': {
        // Keep one card to turn face up; with a short pile, place fewer face down.
        const down = Math.min(s.options.warCards, s.piles[player]!.length - 1);
        for (let i = 0; i < down; i++) play(s, player, false, emit);
        play(s, player, true, emit);
        break;
      }
      case 'collect': {
        const loser = opponent(s, player);
        const taken = [...s.battle[player]!, ...s.battle[loser]!].map((p) => p.card);
        const ordered = s.options.shuffleWinnings ? shuffle(rng, taken) : taken;
        for (const card of ordered) {
          s.piles[player]!.push(card);
          const from = s.battle[player]!.some((p) => p.card.id === card.id) ? player : loser;
          emit({ type: 'move', cardId: card.id, from: battleZone(from), to: pileZone(player), faceUp: false });
        }
        s.battle[player] = [];
        s.battle[loser] = [];
        s.round++;
        s.wars = 0;
        s.roundWinner = null;
        emit({ type: 'round-won', player, cards: ordered.length });

        if (s.piles[loser]!.length === 0) {
          return end(s, { type: 'win', winners: [player], reason: `${loser} has no cards left` }, emit);
        }
        if (s.round >= s.options.maxRounds) {
          const [a, b] = s.players;
          const ca = countCards(s, a);
          const cb = countCards(s, b);
          const reason = `Round limit (${s.options.maxRounds}) reached`;
          return end(s, ca === cb ? { type: 'draw', reason } : { type: 'win', winners: [ca > cb ? a : b], reason }, emit);
        }
        s.phase = 'flip';
        s.waitingFor = [...s.players];
        return;
      }
    }
    s.waitingFor = s.waitingFor.filter((p) => p !== player);
    if (s.waitingFor.length === 0) resolve(s, emit);
  },

  outcome: (s) => s.outcome,

  // Nobody knows the order of any pile, and face-down war cards stay hidden.
  playerView: (s) => ({
    ...s,
    piles: Object.fromEntries(Object.entries(s.piles).map(([p, pile]) => [p, pile.map(hide)])),
    battle: Object.fromEntries(
      Object.entries(s.battle).map(([p, played]) => [
        p,
        played.map(({ card, faceUp }) => ({ card: faceUp ? card : hide(card), faceUp })),
      ]),
    ),
  }),
});
