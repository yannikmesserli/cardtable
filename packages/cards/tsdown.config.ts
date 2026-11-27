import { defineConfig } from 'tsdown';

// Bundles the private @cardtable/* workspace packages into one npm package, with
// a subpath per package. The entries re-export their sources by relative path, so
// nothing is declared as a dependency and tsdown inlines them all; code shared
// between entries (e.g. core) goes into common chunks rather than copies.
export default defineConfig({
  entry: {
    core: 'src/core.ts',
    engine: 'src/engine.ts',
    react: 'src/react.ts',
    'games/war': 'src/games/war.ts',
    'games/war-testing': 'src/games/war-testing.ts',
    'games/match': 'src/games/match.ts',
  },
  dts: true,
  copy: [{ from: '../react/src/styles.css', to: 'dist/react' }],
});
