import { motion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';

interface AnimatedCardProps {
  id: string;
  faceUp: boolean;
  /** Front of the card. Not rendered when the card is hidden. */
  children?: ReactNode;
  /** Animate a flip from face down when mounting (e.g. a card just turned from a pile). */
  flipOnMount?: boolean;
  style?: CSSProperties;
}

const move = { type: 'spring', stiffness: 260, damping: 28 } as const;

/**
 * Card shell shared by every kind of card: size, back, flip and movement.
 * `layoutId` is the card id: when a card is rendered in another zone, Motion
 * animates it from its previous position.
 */
export function AnimatedCard({ id, faceUp, children, flipOnMount = false, style }: AnimatedCardProps) {
  return (
    <motion.div layoutId={id} className="card" style={style} transition={move}>
      <motion.div
        className="card-inner"
        initial={flipOnMount ? { rotateY: 180 } : false}
        animate={{ rotateY: faceUp ? 0 : 180 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
      >
        <div className="card-face card-front">{children}</div>
        <div className="card-face card-back" />
      </motion.div>
    </motion.div>
  );
}
