// Shared test environment. Every test file gets a clean device: empty IndexedDB,
// empty localStorage, no signed-in account, cache enabled unless a test says otherwise.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetDeviceStorage } from '../services/storage';
import { setEvalMode } from '../services/outputCache';

beforeEach(async () => {
  localStorage.clear();
  await resetDeviceStorage();
  setEvalMode(false);
});

afterEach(async () => {
  // Without this a rendered App persists into the next test, where a "the learner sees
  // nothing" assertion would be reading the previous test's DOM.
  cleanup();
  localStorage.clear();
});
