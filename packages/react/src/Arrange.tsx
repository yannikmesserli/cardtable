import type { CardId } from '@cardtable/core';
import { type ArrangeAction, type ArrangeState, arrangeActions, canDiscard, unplaced } from '@cardtable/engine';
import type { JSX, ReactNode } from 'react';

export interface ArrangeProps<C extends { readonly id: CardId }> {
  state: ArrangeState;
  /** Cards in the peek zone, as the player sees them. */
  cards: readonly C[];
  /** Renders a face-up card, e.g. a `PlayingCard` or an `IconCard`. */
  renderCard: (card: C) => ReactNode;
  onAction: (action: ArrangeAction) => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function hint(state: ArrangeState, cards: readonly { readonly id: CardId }[]): string {
  if (!canDiscard(state, cards)) return 'Choose the next card to put back on top of the deck.';
  const missing = state.minDiscard - state.discarded;
  if (missing > 0) return `Discard ${plural(missing, 'more card')}.`;
  return `Discard up to ${plural(state.maxDiscard - state.discarded, 'more card')}, or start putting cards back.`;
}

/** UI for `startArrange`: discard some of the looked-at cards and choose the order of the others. */
export function Arrange<C extends { readonly id: CardId }>({ state, cards, renderCard, onAction }: ArrangeProps<C>): JSX.Element {
  const legal = arrangeActions(state, cards);
  const find = (type: ArrangeAction['type'], cardId: CardId) => legal.find((a) => a.type === type && a.cardId === cardId);
  const placed = state.order.map((id) => cards.find((c) => c.id === id)).filter((c): c is C => c !== undefined);

  return (
    <section className="arrange">
      <p className="arrange-hint">{hint(state, cards)}</p>
      <div className="arrange-row">
        {unplaced(state, cards).map((card) => {
          const discard = find('arrange-discard', card.id);
          const place = find('arrange-place', card.id);
          return (
            <div key={card.id} className="arrange-card">
              {renderCard(card)}
              <div className="arrange-buttons">
                {discard && (
                  <button type="button" onClick={() => onAction(discard)}>
                    Discard
                  </button>
                )}
                {place && (
                  <button type="button" onClick={() => onAction(place)}>
                    Put back
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {placed.length > 0 && (
        <div className="arrange-order">
          <span>Top of the deck</span>
          {placed.map((card) => (
            <div key={card.id} className="arrange-card">
              {renderCard(card)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
