import type { CSSProperties, JSX, ReactNode } from 'react';
import { AnimatedCard } from './AnimatedCard';

export interface IconCardProps {
  id: string;
  faceUp: boolean;
  /**
   * Icon shown in the middle, e.g. `<Sun weight="fill" />` from
   * `@phosphor-icons/react`. Leave it out for hidden cards.
   */
  icon?: ReactNode;
  /** Accent color for the icon, frame and label. Any CSS color. */
  color?: string;
  /** Short text in the corners, e.g. a name or a value. */
  label?: string;
  /** Animate a flip from face down when mounting (e.g. a card just turned from a pile). */
  flipOnMount?: boolean;
  style?: CSSProperties;
}

/** Plain card with a big icon in the middle, for games with their own cards. */
export function IconCard({ id, faceUp, icon, color, label, ...rest }: IconCardProps): JSX.Element {
  const shown = faceUp && icon !== undefined;
  return (
    <AnimatedCard id={id} faceUp={shown} {...rest}>
      {shown && (
        <div className="face icon-face" style={color ? ({ '--accent': color } as CSSProperties) : undefined}>
          {label && <span className="corner top">{label}</span>}
          <span className="icon">{icon}</span>
          {label && <span className="corner bottom">{label}</span>}
        </div>
      )}
    </AnimatedCard>
  );
}
