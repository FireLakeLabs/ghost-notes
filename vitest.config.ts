import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    // Each test file runs a small Strudel query pool. CI runners are small, so two
    // files at a time bounds contention there. Locally, use half the cores (2 to 8):
    // measured on 16 cores, 2 workers took 26.6 s, 4 took 16.0 s and 8 took 13.7 s.
    maxWorkers: process.env.CI
      ? 2
      : Math.min(8, Math.max(2, Math.floor(availableParallelism() / 2))),
    include: ['src/**/*.test.ts', 'tests/*.test.ts'],
    server: { deps: { inline: [/@strudel\//, /@kabelsalat\//] } },
  },
});
