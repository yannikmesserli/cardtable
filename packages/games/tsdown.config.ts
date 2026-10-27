import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { 'war/index': 'src/war/index.ts', 'war/testing': 'src/war/testing.ts' },
  dts: true,
});
