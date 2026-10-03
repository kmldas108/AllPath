// The learner's profile, kept on the device and keyed by account (spec C5, 10a).
//
// In v2 the profile was React state and nothing else: it died on every reload and onboarding
// ran again (see specs/current-state.md). It is now read from localStorage before first paint
// and written on every change, with no network call in either direction.

import { UserPreferences, GenerationPrefs } from '../types';
import { DEFAULT_PREFERENCES } from '../constants';

const prefix = 'samaveshi.profile.';

export function loadProfile(accountId: string): UserPreferences | null {
  try {
    const raw = localStorage.getItem(prefix + accountId);
    if (!raw) return null;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) };
  } catch {
    return null;
  }
}

export function saveProfile(accountId: string, prefs: UserPreferences): void {
  localStorage.setItem(prefix + accountId, JSON.stringify(prefs));
}

export function clearProfile(accountId: string): void {
  localStorage.removeItem(prefix + accountId);
}

/**
 * Strip the learner's name for anything that leaves the device (spec C4, A7).
 * Returned object is a GenerationPrefs, which has no `name` field at all, so a caller
 * cannot put it back without changing the type.
 */
export function forGeneration(prefs: UserPreferences): GenerationPrefs {
  const { name: _name, ...rest } = prefs;
  return rest;
}
