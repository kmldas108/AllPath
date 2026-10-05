import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Node 22+ ships an experimental `localStorage` global. It shadows the one jsdom provides, and
// without --localstorage-file it warns and reads as undefined, so every storage test fails for
// a reason that has nothing to do with the app. Turning it off lets jsdom's real Storage
// through.
//
// The flag has to be conditional: Node rejects an unrecognised CLI flag outright, so passing
// it on Node 20 — which has no built-in localStorage and does not need it — would stop the
// test workers from starting at all.
const webstorageFlag = '--no-experimental-webstorage';
const execArgv = process.allowedNodeEnvironmentFlags.has(webstorageFlag) ? [webstorageFlag] : [];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    poolOptions: {
      forks: { execArgv },
    },
  },
});
