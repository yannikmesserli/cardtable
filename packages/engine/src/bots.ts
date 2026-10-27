import { createRng, type Rng } from '@cardtable/core';
import { applyAction, createMatch } from './match';
import type { Action, GameDefinition, GameEvent, MatchConfig, PlayerId, Step } from './types';

export type Bot<S, A extends Action> = (state: S, player: PlayerId, legal: readonly A[], rng: Rng) => A;

export const randomBot = <S, A extends Action>(): Bot<S, A> => (_state, _player, legal, rng) =>
  rng.pick(legal);

export const firstLegalBot = <S, A extends Action>(): Bot<S, A> => (_state, _player, legal) => {
  const [first] = legal;
  if (!first) throw new Error('No legal action');
  return first;
};

export interface BotTurn<A extends Action> {
  readonly player: PlayerId;
  readonly action: A;
}

/**
 * Picks the next bot action: first active player that has a legal action.
 * Bots see the full state; pass a `playerView`-based bot if that matters.
 */
export function nextBotTurn<S, A extends Action>(
  game: GameDefinition<S, A, any, any, any>,
  state: S,
  bot: Bot<S, A>,
  rng: Rng,
): BotTurn<A> | null {
  for (const player of game.activePlayers(state)) {
    const legal = game.legalActions(state, player);
    if (legal.length > 0) return { player, action: bot(state, player, legal, rng) };
  }
  return null;
}

export interface SimulateOptions<S, A extends Action> {
  readonly bot?: Bot<S, A>;
  readonly maxSteps?: number;
  /** Called after every step, e.g. to assert invariants in tests. */
  readonly onStep?: (step: Step<S, A, any, any>) => void;
}

/** Plays a whole match with bots. Deterministic for a given config. */
export function simulate<S, A extends Action, E extends GameEvent, V, O>(
  game: GameDefinition<S, A, E, V, O>,
  config: MatchConfig<O>,
  { bot = randomBot(), maxSteps = 100_000, onStep }: SimulateOptions<S, A> = {},
): { step: Step<S, A, E, O>; steps: number } {
  const rng = createRng(`${config.seed}:bots`);
  let step: Step<S, A, E, O> = createMatch(game, config);
  onStep?.(step);
  let steps = 0;
  while (!step.match.outcome && steps < maxSteps) {
    const turn = nextBotTurn(game, step.match.state, bot, rng);
    if (!turn) throw new Error('No active player can act, but the match is not over');
    const result = applyAction(game, step.match, turn.player, turn.action);
    if (!result.ok) throw new Error(result.error.message);
    step = result;
    steps++;
    onStep?.(step);
  }
  return { step, steps };
}
