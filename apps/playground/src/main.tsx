import { MotionConfig } from 'motion/react';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CardGallery } from './CardGallery';
import { MatchTable } from './match/MatchTable';
import { DeckTools } from './tools/DeckTools';
import '@cardtable/react/styles.css';
import './styles.css';

/** `#match` shows Match, `#cards` the card gallery, `#tools` the deck tools, anything else War. */
function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
  if (hash === '#match') return <MatchTable />;
  if (hash === '#cards') return <CardGallery />;
  if (hash === '#tools') return <DeckTools />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Root />
    </MotionConfig>
  </StrictMode>,
);
