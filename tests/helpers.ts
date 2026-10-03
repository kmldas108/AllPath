// Shared fixtures. Deliberately small: a test that needs an unusual profile builds its own,
// so the default here can never quietly become the thing under test.

import { vi } from 'vitest';
import { AppMode, EducationalContent, UserDisability, UserPreferences } from '../types';

export const LEARNER_ID = 'acc_learner_1';

export const profile = (over: Partial<UserPreferences> = {}): UserPreferences => ({
  name: 'Meera',
  grade: 'Grade 6',
  language: 'Kannada',
  location: 'Rural Karnataka',
  disability: UserDisability.VISUAL,
  culturalContext: true,
  ...over,
});

export const modelOutput = (over: Partial<EducationalContent> = {}): EducationalContent => ({
  mode: AppMode.HEAR_IMAGES,
  topic: 'Photosynthesis',
  spatialDescription: 'A leaf cross-section fills the middle of the page.',
  tactileModelSuggestion: 'Use a flat tamarind leaf and three dried chickpeas.',
  followUpSuggestions: ['What is chlorophyll?', 'Why are leaves green?'],
  ...over,
});

/** Stand in for the server. Returns `output` and records every request body it saw. */
export function stubFetch(output: EducationalContent = modelOutput()) {
  const bodies: any[] = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? '{}')));
    return {
      ok: true,
      status: 200,
      json: async () => output,
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, bodies };
}

export const ALL_MODES = [
  AppMode.HEAR_IMAGES,
  AppMode.SEE_SOUND,
  AppMode.EASY_READ,
  AppMode.CLASS_PACK,
] as const;
