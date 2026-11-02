import type { JSX } from 'react';
import type { CardDrag } from './useCardDrag';

export interface DropSlotProps<Z extends string> {
  /** The drag in progress, from `useCardDrag`. */
  drag: CardDrag<Z> | null;
  zone: Z;
}

/**
 * Card-sized placeholder shown in `zone` while a card that can be dropped
 * there is dragged; it lights up when the card is over the zone.
 */
export function DropSlot<Z extends string>({ drag, zone }: DropSlotProps<Z>): JSX.Element | null {
  if (!drag?.targets.includes(zone)) return null;
  return <div className={drag.over === zone ? 'drop-slot over' : 'drop-slot'} />;
}
