import { type Card, createDeck, hidePile, type MaybeHidden } from '@cardtable/core';
import {
  defineGame,
  type GameDefinition,
  drawAccepted,
  type MoveEvent,
  moveCard,
  type Outcome,
  type ShuffleEvent,
  shuffleBack,
  type ZoneRef,
} from '@cardtable/engine';

/**
 * Solitaire: each turn, play a card that matches the color or the icon of the
 * last card on the track, or discard any card; then refill your hand to 5.
 * Win when the track holds 10 cards; lose when you must draw and the deck is
 * empty.
 *
 * Drawing one of the 4 grey shuffle cards pauses the refill: either discard
 * your whole hand, or burn the top 4 cards of the deck. The shuffle card is
 * then discarded and the refill goes on.
 */

export const COLORS = ['ember', 'tide', 'moss', 'dusk'] as const;
export const ICONS = ['sun', 'moon', 'star', 'bolt', 'leaf'] as const;
export type MatchColor = (typeof COLORS)[number];
export type MatchIcon = (typeof ICONS)[number];

export interface MatchFace {
  readonly color: MatchColor | 'grey';
  readonly icon: MatchIcon | 'shuffle';
}

export type MatchCard = Card<MatchFace>;

export interface MatchState<C extends MaybeHidden<MatchFace> = MatchCard> {
  /** Index 0 is the top. */
  deck: C[];
  hand: MatchCard[];
  /** Played cards, face up, in play order. The last card is the one to match. */
  track: MatchCard[];
  /** Face up; the last card is on top. */
  discard: MatchCard[];
  /** Shuffle card waiting for the player's choice. While set, nothing else can happen. */
  pending: MatchCard[];
  outcome: Outcome | null;
}

export type MatchView = MatchState<MaybeHidden<MatchFace>>;

export type MatchAction =
  | { readonly type: 'play'; readonly cardId: string }
  | { readonly type: 'discard'; readonly cardId: string }
  /** Shuffle card choices. */
  | { readonly type: 'discard-hand' }
  | { readonly type: 'burn' };

export type MatchEvent = MoveEvent | ShuffleEvent;

export const HAND_SIZE = 5;
/** Cards on the track to win, the starting card included. */
export const TRACK_GOAL = 10;
export const SHUFFLE_CARDS = 4;
export const BURN = 4;
export const PLAYER = 'solo';

const symbols: MatchFace[] = COLORS.flatMap((color) => ICONS.map((icon) => ({ color, icon })));
const shuffleCard: MatchFace = { color: 'grey', icon: 'shuffle' };
const faces: MatchFace[] = [...symbols, ...symbols, ...Array.from({ length: SHUFFLE_CARDS }, () => shuffleCard)];

export const DECK_SIZE: number = faces.length;

export const isShuffle = (card: MatchFace): boolean => card.icon === 'shuffle';

const zones = (s: MatchState) => ({
  deck: { zone: 'deck', cards: s.deck } satisfies ZoneRef<MatchCard>,
  hand: { zone: 'hand', cards: s.hand } satisfies ZoneRef<MatchCard>,
  track: { zone: 'track', cards: s.track } satisfies ZoneRef<MatchCard>,
  discard: { zone: 'discard', cards: s.discard } satisfies ZoneRef<MatchCard>,
  pending: { zone: 'pending', cards: s.pending } satisfies ZoneRef<MatchCard>,
});

export const matches = (a: MatchFace, b: MatchFace): boolean => a.color === b.color || a.icon === b.icon;

const playable = (s: MatchState): MatchCard[] => s.hand.filter((c) => matches(c, s.track.at(-1)!));

/** Resumable: stops on a shuffle card, and is called again once it is resolved. */
function refill(s: MatchState, emit: (e: MatchEvent) => void) {
  const z = zones(s);
  while (s.hand.length < HAND_SIZE) {
    const top = s.deck[0];
    if (!top) {
      s.outcome = { type: 'loss', reason: 'The deck ran out' };
      return;
    }
    if (isShuffle(top)) {
      moveCard(z.deck, z.pending, { emit, faceUp: true });
      return;
    }
    moveCard(z.deck, z.hand, { emit, faceUp: true });
  }
}

export const match: GameDefinition<MatchState, MatchAction, MatchEvent, MatchView> = defineGame<
  MatchState,
  MatchAction,
  MatchEvent,
  MatchView
>({
  name: 'match',
  players: { min: 1, max: 1 },

  setup({ rng, emit }) {
    const s: MatchState = { deck: createDeck(rng, { faces }), hand: [], track: [], discard: [], pending: [], outcome: null };
    const z = zones(s);
    // Shuffle cards drawn while dealing are set aside, then shuffled back.
    const aside = { zone: 'aside', cards: [] as MatchCard[] };
    const accept = (c: MatchCard) => !isShuffle(c);
    drawAccepted(z.deck, z.hand, aside, { emit, count: HAND_SIZE, accept, faceUp: true });
    drawAccepted(z.deck, z.track, aside, { emit, count: 1, accept, faceUp: true });
    shuffleBack(rng, aside, z.deck, emit);
    return s;
  },

  activePlayers: (s) => (s.outcome ? [] : [PLAYER]),

  legalActions(s) {
    if (s.outcome) return [];
    if (s.pending.length > 0) return [{ type: 'discard-hand' }, { type: 'burn' }];
    return [
      ...playable(s).map((c): MatchAction => ({ type: 'play', cardId: c.id })),
      ...s.hand.map((c): MatchAction => ({ type: 'discard', cardId: c.id })),
    ];
  },

  apply(s, action, { emit }) {
    const z = zones(s);
    if (action.type === 'discard-hand' || action.type === 'burn') {
      if (action.type === 'discard-hand') {
        while (s.hand.length > 0) moveCard(z.hand, z.discard, { emit, faceUp: true });
      } else {
        for (let i = 0; i < BURN && s.deck.length > 0; i++) moveCard(z.deck, z.discard, { emit, faceUp: true });
      }
      moveCard(z.pending, z.discard, { emit, faceUp: true });
      refill(s, emit);
      return;
    }
    const to = action.type === 'play' ? z.track : z.discard;
    moveCard(z.hand, to, { emit, faceUp: true, cardId: action.cardId });
    if (s.track.length >= TRACK_GOAL) {
      s.outcome = { type: 'win', winners: [PLAYER], reason: `${TRACK_GOAL} cards on the track` };
      return;
    }
    refill(s, emit);
  },

  outcome: (s) => s.outcome,

  playerView: (s) => ({ ...s, deck: hidePile(s.deck) }),
});
