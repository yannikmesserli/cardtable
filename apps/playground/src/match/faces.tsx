import { LeafIcon, LightningIcon, MoonIcon, ShuffleIcon, StarIcon, SunIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import type { MatchFace } from '@cardtable/games/match';

export const COLOR_HEX: Record<MatchFace['color'], string> = {
  ember: '#c2410c',
  tide: '#0e7490',
  moss: '#4d7c0f',
  dusk: '#6d28d9',
  grey: '#6b7280',
};

export const ICON_NODES: Record<MatchFace['icon'], ReactNode> = {
  sun: <SunIcon weight="fill" />,
  moon: <MoonIcon weight="fill" />,
  star: <StarIcon weight="fill" />,
  bolt: <LightningIcon weight="fill" />,
  leaf: <LeafIcon weight="fill" />,
  shuffle: <ShuffleIcon weight="bold" />,
};
