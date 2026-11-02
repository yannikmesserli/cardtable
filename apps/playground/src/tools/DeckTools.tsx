import { Arrange, IconCard, Pile, useMatch } from '@cardtable/react';
import { LayoutGroup } from 'motion/react';
import { useState } from 'react';
import { COLORS, ICONS } from '../CardGallery';
import { deckTools, PLAYER, type ToolCard, type ToolsAction } from './game';

const ACTIONS: { type: Exclude<ToolsAction['type'], `arrange-${string}`>; label: string }[] = [
  { type: 'deal', label: 'Deal 5 without flames' },
  { type: 'shuffle-back', label: 'Shuffle set-aside cards back' },
  { type: 'peek', label: 'Look at the top 5' },
  { type: 'recycle', label: 'Shuffle discards back' },
];

function Face({ card }: { card: ToolCard }) {
  return <IconCard id={card.id} faceUp icon={ICONS[card.icon]} color={COLORS[card.color]} label={card.icon} />;
}

function Zone({ title, cards }: { title: string; cards: readonly ToolCard[] }) {
  return (
    <section className="zone">
      <h2>
        {title} <span className="meta">{cards.length}</span>
      </h2>
      <div className="zone-cards">
        {cards.map((card) => (
          <Face key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

/** Demo of the deck helpers: drawAccepted, shuffleBack and arrange. */
export function DeckTools() {
  const [seed] = useState(() => Math.random().toString(36).slice(2, 8));
  const { match, view, dispatch } = useMatch(deckTools, { players: [PLAYER], seed }, PLAYER);
  const legal = deckTools.legalActions(match.state, PLAYER);

  return (
    <main className="gallery tools">
      <header>
        <h1>Deck tools</h1>
        <a href="#cards">Card gallery</a>
        <a href="#">War</a>
      </header>
      <p className="meta">
        <code>drawAccepted</code> sets flames aside while dealing, <code>shuffleBack</code> returns them, and{' '}
        <code>startArrange</code> + <code>&lt;Arrange&gt;</code> let you discard up to 2 of the top 5 cards and reorder the rest.
      </p>
      <div className="row">
        {ACTIONS.map(({ type, label }) => {
          const action = legal.find((a) => a.type === type);
          return (
            <button key={type} type="button" disabled={!action} onClick={action ? () => dispatch(PLAYER, action) : undefined}>
              {label}
            </button>
          );
        })}
      </div>
      <LayoutGroup>
        <div className="tools-table">
          <section className="zone">
            <h2>
              Deck <span className="meta">{view.deck.length}</span>
            </h2>
            <Pile cards={view.deck} label={`Deck, ${view.deck.length} cards`} />
          </section>
          <Zone title="Set aside" cards={view.aside} />
          <Zone title="Discard (last 3)" cards={view.discard.slice(-3)} />
        </div>
        {view.arrange && (
          <Arrange
            state={view.arrange}
            cards={view.peek}
            renderCard={(card) => <Face card={card} />}
            onAction={(action) => dispatch(PLAYER, action)}
          />
        )}
        <Zone title="Hand" cards={view.hand} />
      </LayoutGroup>
    </main>
  );
}
