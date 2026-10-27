import type { Action, GameDefinition, GameEvent, MatchConfig } from '@cardtable/engine';

export interface Scenario<S = any, A extends Action = any, E extends GameEvent = any, O = any> {
  readonly id: string;
  readonly title: string;
  /** What the scenario sets up and what to look for while stepping through it. */
  readonly description: string;
  readonly game: GameDefinition<S, A, E, any, O>;
  readonly config: MatchConfig<O>;
  /**
   * Rigs the initial state. The match then no longer replays from its seed
   * alone, which is fine for manual testing.
   */
  readonly prepare?: (state: S) => S;
  /** Renders the full (unredacted) state for the terminal. */
  readonly render: (state: S) => string;
  readonly renderEvent?: (event: E) => string;
}

export const defineScenario = <S, A extends Action, E extends GameEvent, O>(
  scenario: Scenario<S, A, E, O>,
): Scenario<S, A, E, O> => scenario;
