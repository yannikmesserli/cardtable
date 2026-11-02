import { type Card, createDeck, hidePile, type MaybeHidden } from '@cardtable/core';
import {
  type ArrangeAction,
  type ArrangeState,
  applyArrange,
  arrangeActions,
  defineGame,
  drawAccepted,
  type MoveEvent,
  moveCard,
  type ShuffleEvent,
  shuffleBack,
  startArrange,
} from '@cardtable/engine';

/**
 * Sandbox for the deck helpers: deal a hand while setting special cards
 * aside, shuffle them back, and look at / reorder the top of the deck.
 * Not a game: it never ends.
 */

export const TOOL_COLORS = ['ember', 'tide', 'moss', 'dusk'] as const;
export const TOOL_ICONS = ['sun', 'moon', 'star', 'leaf'] as const;

export interface ToolFace {
  readonly color: (typeof TOOL_COLORS)[number];
  /** `flame` cards are the special ones, set aside when dealing. */
  readonly icon: (typeof TOOL_ICONS)[number] | 'flame';
}

export type ToolCard = Card<ToolFace>;

export interface ToolsState<C extends MaybeHidden<ToolFace> = ToolCard> {
  deck: C[];
  hand: ToolCard[];
  aside: ToolCard[];
  peek: ToolCard[];
  discard: ToolCard[];
  arrange: ArrangeState | null;
}

export type ToolsAction =
  | { readonly type: 'deal' }
  | { readonly type: 'shuffle-back' }
  | { readonly type: 'peek' }
  | { readonly type: 'recycle' }
  | ArrangeAction;

export const PLAYER = 'me';
const HAND = 5;

const faces: ToolFace[] = TOOL_COLORS.flatMap((color) => [...TOOL_ICONS, 'flame' as const].map((icon) => ({ color, icon })));

export const isSpecial = (card: ToolFace): boolean => card.icon === 'flame';

const zones = (s: ToolsState) => ({
  deck: { zone: 'deck', cards: s.deck },
  hand: { zone: 'hand', cards: s.hand },
  aside: { zone: 'aside', cards: s.aside },
  peek: { zone: 'peek', cards: s.peek },
  discard: { zone: 'discard', cards: s.discard },
});

export const deckTools = defineGame<ToolsState, ToolsAction, MoveEvent | ShuffleEvent, ToolsState<MaybeHidden<ToolFace>>>({
  name: 'deck-tools',
  players: { min: 1, max: 1 },
  setup: ({ rng }) => ({ deck: createDeck(rng, { faces, copies: 2 }), hand: [], aside: [], peek: [], discard: [], arrange: null }),
  activePlayers: () => [PLAYER],

  legalActions(s) {
    if (s.arrange) return arrangeActions(s.arrange, s.peek);
    const actions: ToolsAction[] = [];
    if (s.deck.length > 0) actions.push({ type: 'deal' }, { type: 'peek' });
    if (s.aside.length > 0) actions.push({ type: 'shuffle-back' });
    if (s.discard.length > 0) actions.push({ type: 'recycle' });
    return actions;
  },

  apply(s, action, { rng, emit }) {
    const z = zones(s);
    switch (action.type) {
      case 'deal':
        while (s.hand.length > 0) moveCard(z.hand, z.discard, { emit, faceUp: true });
        drawAccepted(z.deck, z.hand, z.aside, { emit, count: HAND, accept: (c) => !isSpecial(c), faceUp: true });
        return;
      case 'shuffle-back':
        return shuffleBack(rng, z.aside, z.deck, emit);
      case 'peek':
        s.arrange = startArrange(z.deck, z.peek, { emit, count: 5, discard: { min: 0, max: 2 } });
        return;
      case 'recycle':
        return shuffleBack(rng, z.discard, z.deck, emit);
      default:
        if (applyArrange(s.arrange!, action, z, emit)) s.arrange = null;
    }
  },

  outcome: () => null,
  playerView: (s) => ({ ...s, deck: hidePile(s.deck) }),
});
