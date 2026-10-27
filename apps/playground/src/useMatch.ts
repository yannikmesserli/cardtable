import {
  type Action,
  type ActionError,
  applyAction,
  createMatch,
  type GameDefinition,
  type GameEvent,
  type MatchConfig,
  type PlayerId,
  type Step,
  viewFor,
} from '@cardtable/engine';
import { useCallback, useMemo, useState } from 'react';

/**
 * Minimal React binding for the engine. Will move to a `@cardtable/react`
 * package once the API settles.
 */
export function useMatch<S, A extends Action, E extends GameEvent, V, O>(
  game: GameDefinition<S, A, E, V, O>,
  config: MatchConfig<O>,
  viewer: PlayerId,
) {
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
