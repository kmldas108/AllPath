import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    poolOptions: {
      forks: {
        // Node 22+ ships an experimental `localStorage` global. It shadows the one jsdom
        // provides, and without --localstorage-file it warns and reads as undefined, so
        // every storage test fails for a reason that has nothing to do with the app.
        // Turning it off lets jsdom's real Storage through.
        execArgv: ['--no-experimental-webstorage'],
      },
    },
  },
});
