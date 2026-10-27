import { createRng } from '@cardtable/core';
import { applyAction, createMatch, type Match, nextBotTurn, randomBot, viewFor } from '@cardtable/engine';
import { createInterface } from 'node:readline/promises';
import { styleText } from 'node:util';
import type { Scenario } from './scenario';
import { scenarios } from './scenarios';

const HELP = `
  <n>        play option n           Enter   play option 1
  a [n]      auto-play n steps (default: to the end)
  u          undo                    r       restart scenario
  v <player> print player view       s       print full state (JSON)
  l          print action log        e       toggle event output
  m          back to menu            q       quit
`;

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();

/** Returns null when stdin is closed (e.g. piped input ran out). */
async function ask(prompt: string): Promise<string | null> {
  process.stdout.write(prompt);
  const { value, done } = await lines.next();
  if (done) return null;
  if (!process.stdin.isTTY) process.stdout.write(`${value}\n`);
  return value.trim();
}

const print = (text = '') => console.log(text);

async function pickScenario(): Promise<Scenario | null> {
  print(styleText('bold', '\nScenarios'));
  scenarios.forEach((s, i) => print(`  ${String(i + 1).padStart(2)}) ${s.title} ${styleText('dim', `(${s.id})`)}`));
  while (true) {
    const answer = await ask('\nPick a scenario (number or id, q to quit): ');
    if (answer === null || answer === 'q') return null;
    const found = scenarios[Number(answer) - 1] ?? scenarios.find((s) => s.id === answer);
    if (found) return found;
    print(styleText('red', 'Unknown scenario'));
  }
}

function start(scenario: Scenario): Match<any, any, any> {
  const { match, events } = createMatch(scenario.game, scenario.config);
  if (process.env.VERBOSE) for (const e of events) print(`  ${scenario.renderEvent?.(e) ?? JSON.stringify(e)}`);
  return scenario.prepare ? { ...match, state: scenario.prepare(match.state) } : match;
}

/** Runs a scenario. Resolves to `true` to go back to the menu, `false` to quit. */
async function run(scenario: Scenario): Promise<boolean> {
  const { game } = scenario;
  const bot = randomBot();
  const botRng = createRng(`${scenario.config.seed}:cli`);
  let history: Match<any, any, any>[] = [start(scenario)];
  let showEvents = true;

  print(`\n${styleText(['bold', 'underline'], scenario.title)}\n${scenario.description}`);
  print(styleText('dim', 'Type ? for help.'));

  while (true) {
    const match = history.at(-1)!;
    print(`\n${scenario.render(match.state)}`);

    const options = game
      .activePlayers(match.state)
      .flatMap((player) => game.legalActions(match.state, player).map((action) => ({ player, action })));

    if (match.outcome) {
      print(styleText(['bold', 'magenta'], `\nOutcome: ${JSON.stringify(match.outcome)}`));
      print(styleText('dim', `${match.log.length} actions played.`));
    } else {
      options.forEach(({ player, action }, i) => print(`  ${i + 1}) ${player}: ${JSON.stringify(action)}`));
    }

    const input = await ask('> ');
    if (input === null || input === 'q') return false;
    const [command = '', arg] = input.split(/\s+/);

    const play = (player: string, action: any): boolean => {
      const result = applyAction(game, history.at(-1)!, player, action);
      if (!result.ok) {
        print(styleText('red', `✗ ${result.error.code}: ${result.error.message}`));
        return false;
      }
      history = [...history, result.match];
      if (showEvents) for (const e of result.events) print(styleText('dim', `  · ${scenario.renderEvent?.(e) ?? JSON.stringify(e)}`));
      return true;
    };

    switch (command) {
      case '?':
      case 'h':
        print(HELP);
        break;
      case 'm':
        return true;
      case 'r':
        history = [start(scenario)];
        break;
      case 'u':
        if (history.length > 1) history = history.slice(0, -1);
        else print(styleText('yellow', 'Nothing to undo'));
        break;
      case 'e':
        showEvents = !showEvents;
        print(`Events ${showEvents ? 'on' : 'off'}`);
        break;
      case 's':
        print(JSON.stringify(match.state, null, 2));
        break;
      case 'v':
        if (!arg) print(styleText('red', 'Usage: v <player>'));
        else print(JSON.stringify(viewFor(game, match, arg), null, 2));
        break;
      case 'l':
        match.log.forEach(({ player, action }, i) => print(`  ${i + 1}. ${player} ${JSON.stringify(action)}`));
        break;
      case 'a': {
        const limit = arg ? Number(arg) : Number.POSITIVE_INFINITY;
        const wasShowing: boolean = showEvents;
        showEvents = Number.isFinite(limit) && showEvents;
        let steps = 0;
        while (steps < limit && !history.at(-1)!.outcome) {
          const turn = nextBotTurn(game, history.at(-1)!.state, bot, botRng);
          if (!turn || !play(turn.player, turn.action)) break;
          steps++;
        }
        showEvents = wasShowing;
        print(styleText('dim', `Auto-played ${steps} steps.`));
        break;
      }
      default: {
        const option = options[command === '' ? 0 : Number(command) - 1];
        if (option) play(option.player, option.action);
        else print(styleText('red', `Unknown command "${input}". Type ? for help.`));
      }
    }
  }
}

async function main() {
  const requested = process.argv[2];
  let scenario: Scenario | null | undefined = requested ? scenarios.find((s) => s.id === requested) : null;
  if (requested && !scenario) print(styleText('red', `No scenario "${requested}".`));
  scenario ??= await pickScenario();
  while (scenario) {
    if (!(await run(scenario))) break;
    scenario = await pickScenario();
  }
  rl.close();
}

await main();
