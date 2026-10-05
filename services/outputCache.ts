// Output cache — identical input returns the stored answer instead of calling the model
// (spec 10c, A19-A24). Saves latency and tokens.
//
// Three things here are load-bearing rather than tidy:
//
// 1. The key includes the model version. Drop it and the cache silently serves output from an
//    older model after a version change, corrupting the comparison the paper rests on.
// 2. The key includes the generation-relevant profile fields. Drop them and a Kannada Grade 6
//    learner is served output tailored for an English Grade 10 one.
// 3. `setEvalMode(true)` makes the cache inert. The build guide says run each eval case at
//    least three times because the model does not say the same thing twice. A cache returns
//    the same answer by design, so with it on, three runs would be one call and two copies —
//    the variation you are measuring would vanish and the numbers would mean nothing (C10).
//
// The cache stores the model's output and a hash of the media. Never the media itself: C3
// deletes the source photo once an item is dealt with, and a cache holding a copy would
// quietly undo that.

import { AppMode, EducationalContent, GenerationPrefs } from '../types';
import { STORE, get, put, del, values, keys } from './storage';

/** The model v3 is measured against. Changing this invalidates every cache entry by design. */
export const MODEL_VERSION = 'gemini-2.5-flash';

const MAX_ENTRIES = 200;

interface CacheEntry {
  key: string;
  content: EducationalContent;
  storedAt: string;
  lastUsedAt: string;
}

let evalMode = false;

/** Turn the cache off for measurement. The eval harness and Step 11 sessions set this. */
export function setEvalMode(on: boolean): void {
  evalMode = on;
}

export function isEvalMode(): boolean {
  return evalMode;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Every component is part of the identity of a generation. `media` is hashed, not stored.
 * `prefs` is a GenerationPrefs, so the learner's name cannot be in the key (C4, A22).
 */
export async function cacheKey(params: {
  media: string | null;
  mode: AppMode;
  prefs: GenerationPrefs;
  extra?: Record<string, string> | null;
}): Promise<string> {
  const mediaHash = params.media ? await sha256Hex(params.media) : 'no-media';
  const parts = [
    MODEL_VERSION,
    params.mode,
    mediaHash,
    params.prefs.language,
    params.prefs.grade,
    params.prefs.disability,
    params.prefs.location,
    String(params.prefs.culturalContext),
    params.extra ? JSON.stringify(params.extra, Object.keys(params.extra).sort()) : '',
  ];
  return sha256Hex(parts.join('\u0000'));
}

export async function readCache(key: string): Promise<EducationalContent | null> {
  if (evalMode) return null;
  const entry = await get<CacheEntry>(STORE.cache, key);
  if (!entry) return null;
  await put(STORE.cache, key, { ...entry, lastUsedAt: new Date().toISOString() });
  return entry.content;
}

export async function writeCache(key: string, content: EducationalContent): Promise<void> {
  if (evalMode) return;
  const now = new Date().toISOString();
  await put(STORE.cache, key, { key, content, storedAt: now, lastUsedAt: now });
  await evictIfFull();
}

/** Least-recently-used eviction at MAX_ENTRIES. No time expiry while the model is pinned. */
async function evictIfFull(): Promise<void> {
  const all = await values<CacheEntry>(STORE.cache);
  if (all.length <= MAX_ENTRIES) return;
  const oldestFirst = all.sort((a, b) => a.lastUsedAt.localeCompare(b.lastUsedAt));
  for (const entry of oldestFirst.slice(0, all.length - MAX_ENTRIES)) {
    await del(STORE.cache, entry.key);
  }
}

export function cachedKeys(): Promise<string[]> {
  return keys(STORE.cache);
}

export function cachedEntries(): Promise<CacheEntry[]> {
  return values<CacheEntry>(STORE.cache);
}
