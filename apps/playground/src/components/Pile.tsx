import type { MaybeHidden } from '@cardtable/core';
import { PlayingCard } from './PlayingCard';

interface PileProps {
  cards: readonly MaybeHidden[];
  onClick?: (() => void) | undefined;
  label: string;
}

const MAX_LIFT = 10;

/** Face-down stack; `cards[0]` is the top card. */
export function Pile({ cards, onClick, label }: PileProps) {
  return (
    <button type="button" className="pile" onClick={onClick} disabled={!onClick} aria-label={label}>
      <div className="slot" />
      {cards.map((card, i) => {
        const lift = Math.max(0, MAX_LIFT - i) * 0.6;
        return (
          <PlayingCard
            key={card.id}
            card={card}
            faceUp={false}
            style={{ position: 'absolute', top: -lift, left: lift, zIndex: cards.length - i }}
          />
        );
      })}
    </button>
  );
}
