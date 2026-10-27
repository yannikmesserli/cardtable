/**
 * Small, fast, seedable PRNG (mulberry32). Its whole state is a single uint32,
 * which keeps matches serializable and replayable.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
  /** Current internal state; pass it to `restoreRng` to continue the sequence. */
  readonly state: number;
}

class Mulberry32 implements Rng {
  #state: number;

  constructor(state: number) {
    this.#state = state >>> 0;
  }

  get state(): number {
    return this.#state;
  }

  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty list');
    return items[this.int(items.length)] as T;
  }
}

/** FNV-1a hash, used to turn string seeds into a uint32. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type Seed = number | string;

export const createRng = (seed: Seed): Rng =>
  new Mulberry32(typeof seed === 'string' ? hashSeed(seed) : seed);

export const restoreRng = (state: number): Rng => new Mulberry32(state);
