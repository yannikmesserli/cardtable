import type { Scenario } from './scenario';
import { matchScenarios } from './match';
import { warScenarios } from './war';

export const scenarios: Scenario[] = [...warScenarios, ...matchScenarios];
