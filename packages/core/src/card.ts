export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

/** 1 = Ace, 11 = Jack, 12 = Queen, 13 = King. Games decide whether aces are high. */
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
export type Rank = (typeof RANKS)[number];

/**
 * Opaque, stable identifier. Renderers use it as an animation key, so it must
 * never encode the face of the card (see `createDeck`).
 */
export type CardId = string;

export interface CardFace {
  readonly suit: Suit;
  readonly rank: Rank;
}

export interface Card extends CardFace {
  readonly id: CardId;
}

/** A card whose face is unknown to the viewer. */
export interface HiddenCard {
  readonly id: CardId;
  readonly hidden: true;
}

export type MaybeHidden = Card | HiddenCard;

export const isHidden = (card: MaybeHidden): card is HiddenCard => 'hidden' in card;

export const hide = (card: MaybeHidden): HiddenCard => ({ id: card.id, hidden: true });

const RANK_LABELS: Partial<Record<Rank, string>> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export const SUIT_SYMBOLS: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

export const rankLabel = (rank: Rank): string => RANK_LABELS[rank] ?? String(rank);

export const isRed = (face: CardFace): boolean => face.suit === 'hearts' || face.suit === 'diamonds';

/** Numeric value used for comparisons. With `aceHigh`, the ace counts as 14. */
export const rankValue = (rank: Rank, { aceHigh = false }: { aceHigh?: boolean } = {}): number =>
  aceHigh && rank === 1 ? 14 : rank;

/** Human readable label, e.g. `A♠`, `10♥`, or `🂠` for hidden cards. */
export const cardLabel = (card: MaybeHidden | CardFace): string =>
  'hidden' in card ? '🂠' : `${rankLabel(card.rank)}${SUIT_SYMBOLS[card.suit]}`;

const SUIT_BY_LETTER: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' };
const SUIT_BY_SYMBOL: Record<string, Suit> = { '♣': 'clubs', '♦': 'diamonds', '♥': 'hearts', '♠': 'spades' };
const RANK_BY_LABEL: Record<string, Rank> = { A: 1, J: 11, Q: 12, K: 13 };

/** Parses `AS`, `10h`, `K♠`, `q♦`… into a face. Handy for tests and scenarios. */
export function parseFace(label: string): CardFace {
  const match = /^(10|[2-9AJQK])([CDHS♣♦♥♠])$/i.exec(label.trim());
  if (!match) throw new Error(`Invalid card label: "${label}"`);
  const [, r, s] = match as unknown as [string, string, string];
  const rank = RANK_BY_LABEL[r.toUpperCase()] ?? (Number(r) as Rank);
  const suit = SUIT_BY_LETTER[s.toUpperCase()] ?? SUIT_BY_SYMBOL[s];
  if (!suit) throw new Error(`Invalid suit in card label: "${label}"`);
  return { rank, suit };
}

export const sameFace = (a: CardFace, b: CardFace): boolean => a.rank === b.rank && a.suit === b.suit;
