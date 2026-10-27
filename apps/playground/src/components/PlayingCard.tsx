import { type Card, isHidden, isRed, type MaybeHidden, rankLabel, SUIT_SYMBOLS } from '@cardtable/core';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';

interface PlayingCardProps {
  card: MaybeHidden;
  faceUp: boolean;
  /** Animate a flip from face down when mounting (e.g. a card just turned from a pile). */
  flipOnMount?: boolean;
  style?: CSSProperties;
}

const move = { type: 'spring', stiffness: 260, damping: 28 } as const;

/**
 * `layoutId` is the card id: when a card is rendered in another zone, Motion
 * animates it from its previous position.
 */
export function PlayingCard({ card, faceUp, flipOnMount = false, style }: PlayingCardProps) {
  const showFace = faceUp && !isHidden(card);
  return (
    <motion.div layoutId={card.id} className="card" style={style} transition={move}>
      <motion.div
        className="card-inner"
        initial={flipOnMount ? { rotateY: 180 } : false}
        animate={{ rotateY: showFace ? 0 : 180 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
      >
        <div className="card-face card-front">{!isHidden(card) && <Face card={card} />}</div>
        <div className="card-face card-back" />
      </motion.div>
    </motion.div>
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
