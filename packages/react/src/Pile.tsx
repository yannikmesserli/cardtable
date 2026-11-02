import type { JSX } from 'react';
import { AnimatedCard } from './AnimatedCard';

export interface PileProps {
  /** Any kind of card: only ids are used, faces are never shown. */
  cards: readonly { readonly id: string }[];
  onClick?: (() => void) | undefined;
  label: string;
}

const MAX_LIFT = 10;

/** Face-down stack; `cards[0]` is the top card. */
export function Pile({ cards, onClick, label }: PileProps): JSX.Element {
  return (
    <button type="button" className="pile" onClick={onClick} disabled={!onClick} aria-label={label}>
      <div className="slot" />
      {cards.map((card, i) => {
        const lift = Math.max(0, MAX_LIFT - i) * 0.6;
        return (
          <AnimatedCard
            key={card.id}
            id={card.id}
            faceUp={false}
            style={{ position: 'absolute', top: -lift, left: lift, zIndex: cards.length - i }}
          />
        );
      })}
    </button>
  );
}
