import { type Card, createDeck } from '@cardtable/core';
import { describe, expect, it } from 'vitest';
import { defineGame, type MoveEvent, moveCard, type Outcome, simulate } from './index';

/**
 * Solo test game for choices made in the middle of a rule. Discard a card,
 * then refill the hand to 3. Drawing an ace pauses the refill: the player
 * keeps it or buries it, and the refill resumes. Three aces in hand win; an
 * empty deck when a card is needed loses.
 */
interface RefillState {
  deck: Card[];
  hand: Card[];
  discard: Card[];
  /** Drawn ace waiting for a decision. While it is not empty, nothing else can happen. */
  pending: Card[];
  outcome: Outcome | null;
}
type RefillAction = { type: 'discard'; cardId: string } | { type: 'keep' } | { type: 'bury' };

const HAND = 3;

const zones = (s: RefillState) => ({
  deck: { zone: 'deck', cards: s.deck },
  hand: { zone: 'hand', cards: s.hand },
  discard: { zone: 'discard', cards: s.discard },
  pending: { zone: 'pending', cards: s.pending },
});

/** Resumable: stops when a decision is pending, and is called again once it is made. */
function refill(s: RefillState, emit: (e: MoveEvent) => void) {
  const z = zones(s);
  while (s.hand.length < HAND && s.pending.length === 0) {
    if (s.deck.length === 0) {
      s.outcome = { type: 'loss', reason: 'The deck ran out' };
      return;
    }
    moveCard(z.deck, s.deck[0]!.rank === 1 ? z.pending : z.hand, { emit, faceUp: true });
  }
  if (s.hand.filter((c) => c.rank === 1).length === HAND) s.outcome = { type: 'win', winners: ['solo'] };
}

const refillGame = defineGame<RefillState, RefillAction, MoveEvent>({
  name: 'refill',
  players: { min: 1, max: 1 },
  setup({ rng, emit }) {
    const s: RefillState = { deck: createDeck(rng), hand: [], discard: [], pending: [], outcome: null };
    refill(s, emit);
    return s;
  },
  activePlayers: (s) => (s.outcome ? [] : ['solo']),
  legalActions(s) {
    if (s.outcome) return [];
    if (s.pending.length > 0) return [{ type: 'keep' }, { type: 'bury' }];
    return s.hand.map((c) => ({ type: 'discard', cardId: c.id }));
  },
  apply(s, action, { emit }) {
    const z = zones(s);
    if (action.type === 'discard') moveCard(z.hand, z.discard, { emit, faceUp: true, cardId: action.cardId });
    else moveCard(z.pending, action.type === 'keep' ? z.hand : z.discard, { emit, faceUp: true });
    refill(s, emit);
  },
  outcome: (s) => s.outcome,
});

describe('pending choices', () => {
  it('pause a rule until the player decides, then resume it', () => {
    let paused = 0;
    for (let seed = 0; seed < 30; seed++) {
      const { step } = simulate(refillGame, { players: ['solo'], seed }, {
        onStep({ match: { state: s } }) {
          expect(s.deck.length + s.hand.length + s.discard.length + s.pending.length).toBe(52);
          expect(s.pending.length).toBeLessThanOrEqual(1);
          if (s.outcome || s.pending.length === 0) return;
          paused++;
          expect(s.hand.length).toBeLessThan(HAND);
          expect(refillGame.legalActions(s, 'solo')).toEqual([{ type: 'keep' }, { type: 'bury' }]);
        },
      });
      expect(step.match.outcome).not.toBeNull();
    }
    expect(paused).toBeGreaterThan(0);
  });
});
