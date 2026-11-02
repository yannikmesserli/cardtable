import type { Rng, Seed } from '@cardtable/core';

export type PlayerId = string;

export interface Action {
  readonly type: string;
}

export interface GameEvent {
  readonly type: string;
}

/** Zones are named by the game, e.g. `deck`, `pile:p0`, `battle:p1`. */
export type ZoneId = string;

/**
 * Standard event for a card changing zone. Renderers can animate it without
 * knowing anything about the game.
 */
export interface MoveEvent extends GameEvent {
  readonly type: 'move';
  readonly cardId: string;
  readonly from: ZoneId;
  readonly to: ZoneId;
  readonly faceUp: boolean;
}

/** Standard event for a zone being shuffled. Renderers can animate it as a whole. */
export interface ShuffleEvent extends GameEvent {
  readonly type: 'shuffle';
  readonly zone: ZoneId;
}

/** `loss` means every player lost, e.g. against the game in solo or cooperative play. */
export type Outcome =
  | { readonly type: 'win'; readonly winners: readonly PlayerId[]; readonly reason?: string }
  | { readonly type: 'draw'; readonly reason?: string }
  | { readonly type: 'loss'; readonly reason?: string };

export interface SetupContext<E extends GameEvent, O> {
  readonly players: readonly PlayerId[];
  readonly rng: Rng;
  readonly options: O | undefined;
  emit(event: E): void;
}

export interface ApplyContext<E extends GameEvent> {
  readonly player: PlayerId;
  readonly rng: Rng;
  emit(event: E): void;
}

/**
 * A game is a set of pure functions over a serializable state.
 *
 * @typeParam S - full game state (knows every card)
 * @typeParam A - actions a player can take
 * @typeParam E - events emitted while applying actions, used to drive animations
 * @typeParam V - what a single player is allowed to see
 * @typeParam O - options accepted at setup
 */
export interface GameDefinition<S, A extends Action, E extends GameEvent = GameEvent, V = S, O = undefined> {
  readonly name: string;
  readonly players: { readonly min: number; readonly max: number };
  setup(ctx: SetupContext<E, O>): S;
  /** Players allowed to act right now. Several players may act simultaneously. */
  activePlayers(state: S): readonly PlayerId[];
  legalActions(state: S, player: PlayerId): readonly A[];
  /**
   * Applies an already validated action. `draft` is a private copy of the
   * state, so it can be mutated freely.
   */
  apply(draft: S, action: A, ctx: ApplyContext<E>): void;
  outcome(state: S): Outcome | null;
  /** Redacts hidden information. Defaults to the full state. */
  playerView?(state: S, player: PlayerId): V;
}

export type AnyGame = GameDefinition<any, any, any, any, any>;
export type StateOf<G> = G extends GameDefinition<infer S, any, any, any, any> ? S : never;
export type ActionOf<G> = G extends GameDefinition<any, infer A, any, any, any> ? A : never;
export type EventOf<G> = G extends GameDefinition<any, any, infer E, any, any> ? E : never;
export type ViewOf<G> = G extends GameDefinition<any, any, any, infer V, any> ? V : never;
export type OptionsOf<G> = G extends GameDefinition<any, any, any, any, infer O> ? O : never;

export interface MatchConfig<O = undefined> {
  readonly players: readonly PlayerId[];
  readonly seed: Seed;
  readonly options?: O;
}

export interface LoggedAction<A extends Action = Action> {
  readonly player: PlayerId;
  readonly action: A;
}

/**
 * A running match. Plain data: it can be stored, sent over the network, and
 * replayed from `config` + `log`.
 */
export interface Match<S, A extends Action = Action, O = undefined> {
  readonly config: MatchConfig<O>;
  readonly state: S;
  readonly rngState: number;
  readonly log: readonly LoggedAction<A>[];
  readonly outcome: Outcome | null;
}

export interface Step<S, A extends Action, E extends GameEvent, O> {
  readonly match: Match<S, A, O>;
  /** Events emitted by the last transition, in order. */
  readonly events: readonly E[];
}

export type ActionErrorCode = 'game-over' | 'not-active' | 'illegal-action';

export interface ActionError {
  readonly code: ActionErrorCode;
  readonly message: string;
}

export type ActionResult<S, A extends Action, E extends GameEvent, O> =
  | ({ readonly ok: true } & Step<S, A, E, O>)
  | { readonly ok: false; readonly error: ActionError };
