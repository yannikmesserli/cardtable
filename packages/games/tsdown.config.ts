import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    'war/index': 'src/war/index.ts',
    'war/testing': 'src/war/testing.ts',
    'match/index': 'src/match/index.ts',
  },
  dts: true,
});
