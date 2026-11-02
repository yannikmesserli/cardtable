import { cardLabel } from '@cardtable/core';
import type { Outcome } from '@cardtable/engine';
import { type WarAction, type WarEvent, type WarView, war } from '@cardtable/games/war';
import { Pile, PlayingCard, useMatch } from '@cardtable/react';
import { LayoutGroup } from 'motion/react';
import { useEffect, useState } from 'react';

const HUMAN = 'p0';
const BOT = 'p1';
const PLAYERS = [HUMAN, BOT];
const NAMES: Record<string, string> = { [HUMAN]: 'You', [BOT]: 'Bot' };

const ACTION_LABELS: Record<WarAction['type'], string> = { flip: 'Flip', war: 'War!', collect: 'Collect' };

const wins = (player: string) => (player === HUMAN ? 'You win' : `${NAMES[player]} wins`);

const randomSeed = () => Math.random().toString(36).slice(2, 8);

function describeOutcome(outcome: Outcome): string {
  const reason = outcome.reason ? ` (${outcome.reason})` : '';
  switch (outcome.type) {
    case 'draw':
      return `Draw${reason}`;
    case 'loss':
      return `Everyone lost${reason}`;
    case 'win':
      return `${outcome.winners.map((p) => NAMES[p]).join(', ')} won the game${reason}`;
  }
}

function describeEvent(e: WarEvent, round: number): string | null {
  switch (e.type) {
    case 'war':
      return e.depth > 1 ? `War again! (×${e.depth})` : 'War!';
    case 'round-won':
      return `${NAMES[e.player]} won ${e.cards} cards (round ${round})`;
    case 'game-over':
      return describeOutcome(e.outcome);
    case 'move':
      return null;
  }
}

export function App() {
  const [seed, setSeed] = useState(randomSeed);
  const [autoplay, setAutoplay] = useState(false);
  const [delay, setDelay] = useState(700);
  const [log, setLog] = useState<string[]>([]);
  const { match, view, step, dispatch, reset, error } = useMatch(war, { players: PLAYERS, seed }, HUMAN);

  // Append readable events to the log.
  useEffect(() => {
    const lines = step.events.map((e) => describeEvent(e, step.match.state.round)).filter((l): l is string => l !== null);
    if (lines.length) setLog((prev) => [...lines.reverse(), ...prev].slice(0, 40));
  }, [step]);

  // Bots: the opponent always, and the human too when autoplay is on.
  useEffect(() => {
    if (match.outcome) return;
    const active = war.activePlayers(match.state);
    const player = (autoplay ? PLAYERS : [BOT]).find((p) => active.includes(p));
    if (!player) return;
    const timer = setTimeout(() => dispatch(player, war.legalActions(match.state, player)[0]!), delay);
    return () => clearTimeout(timer);
  }, [match, autoplay, delay, dispatch]);

  const humanAction = war.legalActions(match.state, HUMAN)[0];
  const play = humanAction && !autoplay ? () => dispatch(HUMAN, humanAction) : undefined;

  const newGame = (nextSeed = randomSeed()) => {
    setSeed(nextSeed);
    setLog([]);
    reset({ players: PLAYERS, seed: nextSeed });
  };

  return (
    <div className="app">
      <main className="table">
        <LayoutGroup>
          <Seat view={view} player={BOT} />
          <Battle view={view} player={BOT} />
          <div className="status">
            {match.outcome ? (
              <strong>{describeOutcome(match.outcome)}</strong>
            ) : (
              <span>{statusText(view)}</span>
            )}
            {error && <span className="error">{error.message}</span>}
          </div>
          <Battle view={view} player={HUMAN} />
          <Seat view={view} player={HUMAN} onClick={play} />
        </LayoutGroup>
        <div className="actions">
          {match.outcome ? (
            <button type="button" onClick={() => newGame()}>
              Play again
            </button>
          ) : (
            <button type="button" onClick={play} disabled={!play}>
              {humanAction ? ACTION_LABELS[humanAction.type] : 'Waiting…'}
            </button>
          )}
        </div>
      </main>

      <aside className="panel">
        <h1>War</h1>
        <a href="#match">Match</a>
        <a href="#cards">Card gallery</a>
        <label>
          Seed
          <input value={seed} onChange={(e) => setSeed(e.target.value)} />
        </label>
        <div className="row">
          <button type="button" onClick={() => newGame(seed)}>
            Restart seed
          </button>
          <button type="button" onClick={() => newGame()}>
            New game
          </button>
        </div>
        <label className="check">
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
          Autoplay
        </label>
        <label>
          Bot delay: {delay} ms
          <input type="range" min={50} max={1500} step={50} value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
        </label>
        <p className="meta">
          Round {view.round + 1} · {match.log.length} actions
        </p>
        <h2>Events</h2>
        <ul className="log">
          {log.map((line, i) => (
            <li key={log.length - i}>{line}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function statusText(view: WarView): string {
  const waiting = view.waitingFor.map((p) => NAMES[p]).join(' & ');
  switch (view.phase) {
    case 'flip':
      return `Waiting for ${waiting} to flip`;
    case 'war': {
      const tied = view.battle[HUMAN]!.findLast((c) => c.faceUp)?.card;
      return `Tie${tied ? ` on ${cardLabel(tied).slice(0, -1)}` : ''}! ${waiting} must go to war`;
    }
    case 'collect':
      return `${wins(view.roundWinner!)} the round`;
    case 'over':
      return 'Game over';
  }
}

function Seat({ view, player, onClick }: { view: WarView; player: string; onClick?: (() => void) | undefined }) {
  const pile = view.piles[player]!;
  return (
    <section className="seat">
      <Pile cards={pile} onClick={onClick} label={`${NAMES[player]} pile, ${pile.length} cards`} />
      <div className="seat-info">
        <strong>{NAMES[player]}</strong>
        <span>{pile.length} cards</span>
      </div>
    </section>
  );
}

function Battle({ view, player }: { view: WarView; player: string }) {
  return (
    <section className="battle">
      {view.battle[player]!.map(({ card, faceUp }) => (
        <PlayingCard key={card.id} card={card} faceUp={faceUp} flipOnMount={faceUp} />
      ))}
    </section>
  );
}
