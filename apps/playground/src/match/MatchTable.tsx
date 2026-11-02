import { createRng } from '@cardtable/core';
import { nextBotTurn, randomBot } from '@cardtable/engine';
import { BURN, type MatchAction, type MatchCard, type MatchState, match, PLAYER, TRACK_GOAL } from '@cardtable/games/match';
import { type CardDrag, DropSlot, IconCard, Pile, useCardDrag, useMatch } from '@cardtable/react';
import { LayoutGroup, motion, type PanInfo } from 'motion/react';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { COLOR_HEX, ICON_NODES } from './faces';

const randomSeed = () => Math.random().toString(36).slice(2, 8);
const bot = randomBot<MatchState, MatchAction>();

type Zone = 'track' | 'discard';
const ZONE_OF: Partial<Record<MatchAction['type'], Zone>> = { play: 'track', discard: 'discard' };

function Face({ card, flipOnMount = false }: { card: MatchCard; flipOnMount?: boolean }) {
  return (
    <IconCard
      id={card.id}
      faceUp
      flipOnMount={flipOnMount}
      icon={ICON_NODES[card.icon]}
      color={COLOR_HEX[card.color]}
      label={card.icon}
    />
  );
}

interface ZoneProps {
  cards: readonly MatchCard[];
  zoneRef: RefObject<HTMLDivElement | null>;
  drag: CardDrag<Zone> | null;
}

/** Played cards in a long row; each card partly covers the previous one. */
function Track({ cards, zoneRef, drag }: ZoneProps) {
  const showSlot = !!drag?.targets.includes('track');
  // Keep the last card (or the drop slot after it) in view.
  useEffect(() => {
    zoneRef.current?.scrollTo({ left: zoneRef.current.scrollWidth, behavior: 'smooth' });
  }, [cards.length, showSlot, zoneRef]);
  return (
    <div ref={zoneRef} className="track-scroll" aria-label={`Track, ${cards.length} cards`}>
      <div className="track">
        {cards.map((card) => (
          <Face key={card.id} card={card} />
        ))}
        <DropSlot drag={drag} zone="track" />
      </div>
    </div>
  );
}

/** Face-up discard pile: only the top card is shown. */
function DiscardPile({ cards, zoneRef, drag }: ZoneProps) {
  const top = cards.at(-1);
  return (
    <div className="discard-zone">
      <div ref={zoneRef} className="discard" aria-label={`Discard pile, ${cards.length} cards`}>
        <div className="slot" />
        {top && <Face key={top.id} card={top} />}
        <DropSlot drag={drag} zone="discard" />
      </div>
      <span className="meta">{cards.length} discarded</span>
    </div>
  );
}

interface ShuffleChoiceProps {
  card: MatchCard;
  handSize: number;
  deckSize: number;
  onChoose: (action: MatchAction) => void;
}

/** Shown when a shuffle card is drawn: the card in the middle of the screen and the two choices. */
function ShuffleChoice({ card, handSize, deckSize, onChoose }: ShuffleChoiceProps) {
  return (
    <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="choice" role="dialog" aria-modal="true" aria-labelledby="shuffle-title">
        <Face card={card} flipOnMount />
        <h2 id="shuffle-title">Shuffle card!</h2>
        <p>Choose one:</p>
        <div className="choice-buttons">
          <button type="button" autoFocus onClick={() => onChoose({ type: 'discard-hand' })}>
            Discard your hand ({handSize} cards)
          </button>
          <button type="button" onClick={() => onChoose({ type: 'burn' })}>
            Burn the top {Math.min(BURN, deckSize)} cards of the deck
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function MatchTable() {
  const [seed, setSeed] = useState(randomSeed);
  const [autoplay, setAutoplay] = useState(false);
  const { match: m, view, dispatch, reset } = useMatch(match, { players: [PLAYER], seed }, PLAYER);
  const legal = match.legalActions(m.state, PLAYER);
  const canPlay = legal.some((a) => a.type === 'play');

  const trackRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const zones = useMemo(() => ({ track: trackRef, discard: discardRef }), []);
  const actionFor = (cardId: string, zone: Zone) =>
    legal.find((a) => 'cardId' in a && a.cardId === cardId && ZONE_OF[a.type] === zone);
  const { drag, handlers, click } = useCardDrag<Zone>(
    zones,
    (cardId) => (['track', 'discard'] as const).filter((zone) => actionFor(cardId, zone)),
    (cardId, zone) => {
      const action = actionFor(cardId, zone);
      if (action) dispatch(PLAYER, action);
    },
  );

  useEffect(() => {
    if (!autoplay || m.outcome) return;
    const timer = setTimeout(() => {
      const turn = nextBotTurn(match, m.state, bot, createRng(`${seed}:${m.log.length}`));
      if (turn) dispatch(turn.player, turn.action);
    }, 500);
    return () => clearTimeout(timer);
  }, [autoplay, m, seed, dispatch]);

  const newGame = () => {
    const next = randomSeed();
    setSeed(next);
    reset({ players: [PLAYER], seed: next });
  };

  return (
    <main className="match-table">
      <LayoutGroup>
        <section className="match-row">
          <Pile cards={view.deck} label={`Deck, ${view.deck.length} cards`} />
          <span className="meta">{view.deck.length} cards left</span>
          <DiscardPile cards={view.discard} zoneRef={discardRef} drag={drag} />
        </section>
        <Track cards={view.track} zoneRef={trackRef} drag={drag} />
        <p className="match-status">
          {m.outcome
            ? m.outcome.type === 'win'
              ? 'You win!'
              : `You lose: ${m.outcome.reason}`
            : canPlay
              ? 'Drag a card matching the color or the icon to the track (or press Enter), or any card to the discard pile (or press D)'
              : 'No match: drag a card to the discard pile (or press D)'}
        </p>
        <p className="meta">
          Track {view.track.length} / {TRACK_GOAL}
        </p>
        {view.pending[0] && (
          <ShuffleChoice
            card={view.pending[0]}
            handSize={view.hand.length}
            deckSize={view.deck.length}
            onChoose={(action) => dispatch(PLAYER, action)}
          />
        )}
        <section className="match-hand">
          {view.hand.map((card) => {
            const play = actionFor(card.id, 'track');
            const discard = actionFor(card.id, 'discard');
            const { onDragStart, onDrag, onDragEnd } = handlers(card.id);
            return (
              <motion.button
                key={card.id}
                type="button"
                className={play ? 'hand-card playable' : 'hand-card'}
                aria-label={`${card.color} ${card.icon}${play ? ', playable' : ''}`}
                aria-keyshortcuts="D Delete"
                drag={!m.outcome && view.pending.length === 0}
                dragSnapToOrigin
                whileDrag={{ scale: 1.06, zIndex: 10 }}
                onDragStart={onDragStart}
                onDrag={(_event, info: PanInfo) => onDrag(info)}
                onDragEnd={(_event, info: PanInfo) => onDragEnd(info)}
                onClick={click(() => play && dispatch(PLAYER, play))}
                onKeyDown={(e) => {
                  // Keyboard alternative to dragging a card onto the discard pile.
                  if (discard && (e.key === 'd' || e.key === 'D' || e.key === 'Delete')) {
                    e.preventDefault();
                    dispatch(PLAYER, discard);
                  }
                }}
              >
                <Face card={card} />
              </motion.button>
            );
          })}
        </section>
      </LayoutGroup>
      <footer className="match-row">
        <a href="#">War</a>
        <button type="button" onClick={newGame}>
          New game
        </button>
        <label>
          <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} /> Autoplay
        </label>
        <span className="meta">seed {seed}</span>
      </footer>
    </main>
  );
}
