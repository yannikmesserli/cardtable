import { createRng, restoreRng } from '@cardtable/core';
import type {
  Action,
  ActionResult,
  GameDefinition,
  GameEvent,
  LoggedAction,
  Match,
  MatchConfig,
  PlayerId,
  Step,
} from './types';

/** Identity helper that gives full type inference when declaring a game. */
export const defineGame = <S, A extends Action, E extends GameEvent = GameEvent, V = S, O = undefined>(
  game: GameDefinition<S, A, E, V, O>,
): GameDefinition<S, A, E, V, O> => game;

export function createMatch<S, A extends Action, E extends GameEvent, V, O>(
  game: GameDefinition<S, A, E, V, O>,
  config: MatchConfig<O>,
): Step<S, A, E, O> {
  const { players } = config;
  if (players.length < game.players.min || players.length > game.players.max) {
    throw new Error(
      `${game.name} needs ${game.players.min}-${game.players.max} players, got ${players.length}`,
    );
  }
  if (new Set(players).size !== players.length) throw new Error('Player ids must be unique');

  const rng = createRng(config.seed);
  const events: E[] = [];
  const state = game.setup({ players, rng, options: config.options, emit: (e) => events.push(e) });
  return {
    match: { config, state, rngState: rng.state, log: [], outcome: game.outcome(state) },
    events,
  };
}

const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );

export function isLegal<S, A extends Action>(
  game: GameDefinition<S, A, any, any, any>,
  state: S,
  player: PlayerId,
  action: NoInfer<A>,
): boolean {
  if (!game.activePlayers(state).includes(player)) return false;
  const key = stableStringify(action);
  return game.legalActions(state, player).some((legal) => stableStringify(legal) === key);
}

export function applyAction<S, A extends Action, E extends GameEvent, V, O>(
  game: GameDefinition<S, A, E, V, O>,
  match: Match<S, A, O>,
  player: PlayerId,
  action: NoInfer<A>,
): ActionResult<S, A, E, O> {
  if (match.outcome) {
    return { ok: false, error: { code: 'game-over', message: 'The match is over' } };
  }
  if (!game.activePlayers(match.state).includes(player)) {
    return { ok: false, error: { code: 'not-active', message: `It is not ${player}'s turn` } };
  }
  if (!isLegal(game, match.state, player, action)) {
    return {
      ok: false,
      error: { code: 'illegal-action', message: `${player} cannot play ${stableStringify(action)}` },
    };
  }

  const draft = structuredClone(match.state);
  const rng = restoreRng(match.rngState);
  const events: E[] = [];
  game.apply(draft, action, { player, rng, emit: (e) => events.push(e) });

  const logged: LoggedAction<A> = { player, action };
  return {
    ok: true,
    match: {
      config: match.config,
      state: draft,
      rngState: rng.state,
      log: [...match.log, logged],
      outcome: game.outcome(draft),
    },
    events,
  };
}

/** Rebuilds a match from its config and action log. Throws on an illegal action. */
export function replay<S, A extends Action, E extends GameEvent, V, O>(
  game: GameDefinition<S, A, E, V, O>,
  config: MatchConfig<O>,
  log: readonly LoggedAction<A>[],
): Step<S, A, E, O> {
  let step: Step<S, A, E, O> = createMatch(game, config);
  for (const [index, { player, action }] of log.entries()) {
    const result = applyAction(game, step.match, player, action);
    if (!result.ok) throw new Error(`Replay failed at action #${index}: ${result.error.message}`);
    step = result;
  }
  return step;
}

export function viewFor<S, A extends Action, E extends GameEvent, V, O>(
  game: GameDefinition<S, A, E, V, O>,
  match: Match<S, A, O>,
  player: PlayerId,
): V {
  return game.playerView ? game.playerView(match.state, player) : (match.state as unknown as V);
}
