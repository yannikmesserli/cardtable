import { MotionConfig } from 'motion/react';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CardGallery } from './CardGallery';
import { DeckTools } from './tools/DeckTools';
import '@cardtable/react/styles.css';
import './styles.css';

/** `#cards` shows the card gallery, `#tools` the deck tools, anything else the War table. */
function Root() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);
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
