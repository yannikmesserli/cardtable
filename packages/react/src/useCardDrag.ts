import { type RefObject, useCallback, useRef, useState } from 'react';

export interface CardDrag<Z extends string> {
  readonly cardId: string;
  /** Zones where the dragged card can legally be dropped. */
  readonly targets: readonly Z[];
  /** Legal zone under the pointer, if any. */
  readonly over: Z | null;
}

/** Motion's pan info (`PanInfo`): `point` is in page coordinates. */
export interface Pan {
  readonly point: { readonly x: number; readonly y: number };
}

/** Call these from the matching Motion drag callbacks. */
export interface CardDragHandlers {
  onDragStart(): void;
  onDrag(pan: Pan): void;
  onDragEnd(pan: Pan): void;
}

export interface UseCardDragResult<Z extends string> {
  /** The drag in progress, e.g. to show drop slots on its targets. */
  readonly drag: CardDrag<Z> | null;
  handlers(cardId: string): CardDragHandlers;
  /** Wraps a click handler so it does nothing right after a drag. */
  click(fn: () => void): () => void;
}

const inside = (el: HTMLElement | null, { point }: Pan) => {
  // Motion builds `point` from the event's pageX/pageY, while getBoundingClientRect()
  // is relative to the viewport: convert the point to viewport coordinates.
  const x = point.x - window.scrollX;
  const y = point.y - window.scrollY;
  const r = el?.getBoundingClientRect();
  return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

/**
 * Drag-and-drop of cards onto zones, built on Motion's `drag`. `targetsFor`
 * says where a card may go (e.g. from the legal actions); `onDrop` runs when
 * it is released over one of them. Call `handlers(cardId)` from the drag
 * callbacks of a `motion.*` element that has `drag` set, passing Motion's pan info.
 */
export function useCardDrag<Z extends string>(
  zones: Record<Z, RefObject<HTMLElement | null>>,
  targetsFor: (cardId: string) => readonly Z[],
  onDrop: (cardId: string, zone: Z) => void,
): UseCardDragResult<Z> {
  const [drag, setDrag] = useState<CardDrag<Z> | null>(null);
  // Motion fires a click after a drag on buttons: remember it to ignore that click.
  const justDragged = useRef(false);

  const hit = useCallback(
    (targets: readonly Z[], pan: Pan) => targets.find((z) => inside(zones[z].current, pan)) ?? null,
    [zones],
  );

  const handlers = (cardId: string): CardDragHandlers => ({
    onDragStart: () => {
      justDragged.current = true;
      setDrag({ cardId, targets: targetsFor(cardId), over: null });
    },
    onDrag: (pan: Pan) =>
      setDrag((d) => {
        if (!d) return d;
        const over = hit(d.targets, pan);
        return over === d.over ? d : { ...d, over };
      }),
    onDragEnd: (pan: Pan) => {
      const zone = hit(targetsFor(cardId), pan);
      setDrag(null);
      if (zone) onDrop(cardId, zone);
      setTimeout(() => (justDragged.current = false));
    },
  });

  const click = (fn: () => void) => () => {
    if (!justDragged.current) fn();
  };

  return { drag, handlers, click };
}
