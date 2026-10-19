// A25, A26, A27 — fabricated content announces itself and never becomes cached evidence.
//
// The hazard being tested: when the live call fails the server returns hardcoded sample text.
// For Easy Read that text is the same Rice Paddy analogy the MCP server hardcodes, so a failed
// call looks exactly like a successful demonstration of the feature. If that reaches a teacher
// unmarked, or gets cached, fabricated text ends up in the log and in the paper as model
// output.

import { describe, it, expect } from 'vitest';
import { AppMode } from '../types';
import { generateForReview } from '../services/generateForReview';
import { release } from '../services/reviewQueue';
import { cachedEntries } from '../services/outputCache';
import { rowFor, toCsv } from '../services/reviewLog';
import { LEARNER_ID, fallbackOutput, modelOutput, profile, stubFetch } from './helpers';

const generate = () =>
  generateForReview({
    mode: AppMode.HEAR_IMAGES,
    mediaBase64: 'BASE64PHOTO',
    mimeType: 'image/jpeg',
    prefs: profile(),
    learnerAccountId: LEARNER_ID,
  });

describe('test_fallback_is_flagged_and_not_cached (A25)', () => {
  it('marks the item as fallback', async () => {
    stubFetch(fallbackOutput());

    const { item } = await generate();

    expect(item.fallback).toBe(true);
  });

  it('writes nothing to the cache', async () => {
    stubFetch(fallbackOutput());

    await generate();

    expect(await cachedEntries()).toEqual([]);
  });

  it('calls the model again next time, rather than serving the fabrication', async () => {
    const { fetchMock } = stubFetch(fallbackOutput());

    const first = await generate();
    const second = await generate();

    // If the fabrication had been cached, the second call would never reach the server and
    // the failure would be invisible from then on.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(false);
  });
});

describe('test_log_records_fallback (A26)', () => {
  it('the row says the content was not model output', async () => {
    stubFetch(fallbackOutput());
    const { item } = await generate();

    await release(item.id, { reviewSeconds: 15 });

    const row = await rowFor(item.id);
    expect(row!.fallback).toBe(true);
  });

  it('the CSV carries the column, so a reviewer can filter the fabricated rows out', async () => {
    stubFetch(fallbackOutput());
    const { item } = await generate();
    await release(item.id, { reviewSeconds: 15 });

    const csv = await toCsv();
    expect(csv.split('\n')[0]).toBe(
      'itemId,mode,generatedAt,decidedAt,decision,edited,reviewSeconds,cacheHit,fallback'
    );
    expect(csv.split('\n')[1]).toMatch(/,true$/);
  });
});

describe('test_model_output_is_cached_normally (A27)', () => {
  it('real model output is still marked as model output and still cached', async () => {
    const { fetchMock } = stubFetch(modelOutput());

    const first = await generate();
    const second = await generate();

    expect(first.item.fallback).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await cachedEntries()).toHaveLength(1);
  });

  it('a released model item logs fallback as false', async () => {
    stubFetch(modelOutput());
    const { item } = await generate();

    await release(item.id, { reviewSeconds: 8 });

    expect((await rowFor(item.id))!.fallback).toBe(false);
  });
});
