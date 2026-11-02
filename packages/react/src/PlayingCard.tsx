import { type Card, isHidden, isRed, type MaybeHidden, rankLabel, SUIT_SYMBOLS } from '@cardtable/core';
import type { CSSProperties, JSX } from 'react';
import { AnimatedCard } from './AnimatedCard';

export interface PlayingCardProps {
  card: MaybeHidden;
  faceUp: boolean;
  /** Animate a flip from face down when mounting (e.g. a card just turned from a pile). */
  flipOnMount?: boolean;
  style?: CSSProperties;
}

/** Standard playing card (suit and rank). */
export function PlayingCard({ card, faceUp, ...rest }: PlayingCardProps): JSX.Element {
  return (
    <AnimatedCard id={card.id} faceUp={faceUp && !isHidden(card)} {...rest}>
      {!isHidden(card) && <Face card={card} />}
    </AnimatedCard>
  );
}

function Face({ card }: { card: Card }) {
  const rank = rankLabel(card.rank);
  const suit = SUIT_SYMBOLS[card.suit];
  return (
    <div className={isRed(card) ? 'face red' : 'face'}>
      <span className="corner top">
        {rank}
        <br />
        {suit}
      </span>
      <span className="pip">{suit}</span>
      <span className="corner bottom">
        {rank}
        <br />
        {suit}
      </span>
    </div>
  );
}
