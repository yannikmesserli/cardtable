import {
  type Action,
  type ActionError,
  type ActionResult,
  applyAction,
  createMatch,
  type GameDefinition,
  type GameEvent,
  type Match,
  type MatchConfig,
  type PlayerId,
  type Step,
  viewFor,
} from '@cardtable/engine';
import { useCallback, useMemo, useState } from 'react';

export interface UseMatchResult<S, A extends Action, E extends GameEvent, V, O> {
  readonly match: Match<S, A, O>;
  /** Events emitted by the last transition, e.g. to drive a log. */
  readonly events: readonly E[];
  readonly step: Step<S, A, E, O>;
  /** What `viewer` is allowed to see. */
  readonly view: V;
  /** Error of the last rejected action, cleared by the next successful one. */
  readonly error: ActionError | null;
  dispatch(player: PlayerId, action: A): ActionResult<S, A, E, O>;
  reset(config: MatchConfig<O>): void;
}

/** Runs a match in React state. Callers render `view` and send actions with `dispatch`. */
export function useMatch<S, A extends Action, E extends GameEvent, V, O>(
  game: GameDefinition<S, A, E, V, O>,
  config: MatchConfig<O>,
  viewer: PlayerId,
): UseMatchResult<S, A, E, V, O> {
  const [step, setStep] = useState<Step<S, A, E, O>>(() => createMatch(game, config));
  const [error, setError] = useState<ActionError | null>(null);

  const dispatch = useCallback(
    (player: PlayerId, action: A) => {
      const result = applyAction(game, step.match, player, action);
      if (result.ok) {
        setStep(result);
        setError(null);
      } else {
        setError(result.error);
      }
      return result;
    },
    [game, step],
  );

  const reset = useCallback(
    (next: MatchConfig<O>) => {
      setStep(createMatch(game, next));
      setError(null);
    },
    [game],
  );

  const view = useMemo(() => viewFor(game, step.match, viewer), [game, step, viewer]);

  return { match: step.match, events: step.events, step, view, error, dispatch, reset };
}
