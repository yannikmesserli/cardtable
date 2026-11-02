import { DropIcon, FlameIcon, LeafIcon, LightningIcon, MoonIcon, StarIcon, SunIcon } from '@phosphor-icons/react';
import { IconCard } from '@cardtable/react';
import { type ReactNode, useState } from 'react';

export const COLORS = { ember: '#c2410c', tide: '#0e7490', moss: '#4d7c0f', dusk: '#6d28d9' };

export const ICONS: Record<string, ReactNode> = {
  sun: <SunIcon weight="fill" />,
  moon: <MoonIcon weight="fill" />,
  star: <StarIcon weight="fill" />,
  bolt: <LightningIcon weight="fill" />,
  leaf: <LeafIcon weight="duotone" />,
  drop: <DropIcon weight="duotone" />,
  flame: <FlameIcon weight="duotone" />,
};

const CARDS = Object.entries(COLORS).flatMap(([color, hex], row) =>
  Object.keys(ICONS)
    .slice(row, row + 4)
    .map((icon) => ({ id: `${color}-${icon}`, color: hex, icon, label: icon })),
);

/** Showcase of `IconCard` with Phosphor icons. Click a card to flip it. */
export function CardGallery() {
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setDown((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <main className="gallery">
      <header>
        <h1>Card gallery</h1>
        <a href="#tools">Deck tools</a>
        <a href="#">Back to War</a>
      </header>
      <p className="meta">
        <code>IconCard</code> from <code>@cardtable/react</code> with icons from <code>@phosphor-icons/react</code>. Click a
        card to flip it.
      </p>
      <div className="gallery-grid">
        {CARDS.map(({ id, color, icon, label }) => (
          <button key={id} type="button" className="gallery-card" onClick={() => toggle(id)} aria-label={`${label}, ${id}`}>
            <IconCard id={id} faceUp={!down.has(id)} icon={ICONS[icon]} color={color} label={label} />
          </button>
        ))}
      </div>
    </main>
  );
}
