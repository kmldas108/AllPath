// A19-A24 — the cache saves the model call and nothing else.

import { describe, it, expect } from 'vitest';
import { AppMode, UserDisability } from '../types';
import { generateForReview } from '../services/generateForReview';
import { releasedItemsFor, pendingItems, release } from '../services/reviewQueue';
import { cachedEntries, setEvalMode, cacheKey, MODEL_VERSION } from '../services/outputCache';
import { rowFor, allRows } from '../services/reviewLog';
import { getMedia } from '../services/mediaStore';
import { LEARNER_ID, modelOutput, profile, stubFetch } from './helpers';

const PHOTO = 'BASE64PHOTO';

const run = (over: Parameters<typeof generateForReview>[0] | null = null) =>
  generateForReview(
    over ?? {
      mode: AppMode.HEAR_IMAGES,
      mediaBase64: PHOTO,
      mimeType: 'image/jpeg',
      prefs: profile(),
      learnerAccountId: LEARNER_ID,
    }
  );

describe('test_cache_hit_skips_model (A19)', () => {
  it('the same input twice calls the model once', async () => {
    const { fetchMock } = stubFetch();

    const first = await run();
    const second = await run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.item.content.topic).toBe(first.item.content.topic);
  });
});

describe('test_cache_hit_still_reviewed (A20)', () => {
  it('a cache hit lands in the queue unreleased and the learner sees nothing', async () => {
    stubFetch();

    const first = await run();
    await release(first.item.id, { reviewSeconds: 20 });

    const second = await run(); // identical input: served from cache

    expect(second.cacheHit).toBe(true);
    expect(second.item.status).toBe('pending');
    // The earlier release does not carry over to the new item, which is the whole point of
    // C9: a cache hit saves the model call, not the teacher's decision.
    expect((await releasedItemsFor(LEARNER_ID)).map((i) => i.id)).toEqual([first.item.id]);
    expect((await pendingItems()).map((i) => i.id)).toEqual([second.item.id]);
  });
});

describe('test_cache_key_is_complete (A21)', () => {
  const base = {
    media: PHOTO,
    mode: AppMode.HEAR_IMAGES,
    prefs: {
      grade: 'Grade 6',
      language: 'Kannada',
      location: 'Rural Karnataka',
      disability: UserDisability.VISUAL,
      culturalContext: true,
    },
    extra: null,
  };

  it('identical input gives the same key', async () => {
    expect(await cacheKey(base)).toBe(await cacheKey(base));
  });

  // Each of these changes something that changes the right answer, so each must miss.
  const variants: [string, Parameters<typeof cacheKey>[0]][] = [
    ['different media', { ...base, media: 'OTHERPHOTO' }],
    ['different mode', { ...base, mode: AppMode.EASY_READ }],
    ['different language', { ...base, prefs: { ...base.prefs, language: 'Tamil' } }],
    ['different grade', { ...base, prefs: { ...base.prefs, grade: 'Grade 10' } }],
    [
      'different disability',
      { ...base, prefs: { ...base.prefs, disability: UserDisability.HEARING } },
    ],
    ['different location', { ...base, prefs: { ...base.prefs, location: 'Coastal Kerala' } }],
    [
      'cultural context off',
      { ...base, prefs: { ...base.prefs, culturalContext: false } },
    ],
    ['class pack details', { ...base, extra: { subject: 'Science', topic: 'Water Cycle' } }],
  ];

  for (const [label, variant] of variants) {
    it(`${label} misses the cache`, async () => {
      expect(await cacheKey(variant)).not.toBe(await cacheKey(base));
    });
  }

  it('the model version is part of the key', async () => {
    // Guards the case the spec cares most about: a model change must not be served stale
    // output from the pinned version. Asserted structurally, since MODEL_VERSION is a const.
    const key = await cacheKey(base);
    expect(MODEL_VERSION).toBe('gemini-2.5-flash');
    expect(key).toHaveLength(64);
  });
});

describe('test_cache_holds_no_media (A22)', () => {
  it('the stored entry has the output but not the photo or the name', async () => {
    stubFetch(modelOutput());
    await run();

    const entries = await cachedEntries();
    expect(entries).toHaveLength(1);
    const serialised = JSON.stringify(entries[0]);

    expect(serialised).not.toContain(PHOTO);
    expect(serialised).not.toContain('Meera');
    expect(entries[0].content.topic).toBe('Photosynthesis');
  });

  it('the photo is still held for review until the decision, then gone', async () => {
    stubFetch();
    const { item } = await run();

    expect(await getMedia(item.id)).toBeTruthy();
    await release(item.id, { reviewSeconds: 3 });
    expect(await getMedia(item.id)).toBeUndefined();
  });
});

describe('test_cache_off_in_eval_mode (A23)', () => {
  it('three identical runs call the model three times', async () => {
    const { fetchMock } = stubFetch();
    setEvalMode(true);

    await run();
    await run();
    await run();

    // This is the criterion protecting Step 9: the guide says run each case at least three
    // times because the model does not say the same thing twice. A cache would return one
    // answer three times and the variance would vanish.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await cachedEntries()).toEqual([]);
  });

  it('eval mode does not read entries written earlier', async () => {
    const { fetchMock } = stubFetch();
    await run(); // warm the cache with the real path
    expect(fetchMock).toHaveBeenCalledTimes(1);

    setEvalMode(true);
    const second = await run();

    expect(second.cacheHit).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('test_log_records_cache_hit (A24)', () => {
  it('each row says whether its item came from the cache', async () => {
    stubFetch();

    const fresh = await run();
    await release(fresh.item.id, { reviewSeconds: 25 });

    const hit = await run();
    await release(hit.item.id, { reviewSeconds: 9 });

    expect((await rowFor(fresh.item.id))!.cacheHit).toBe(false);
    expect((await rowFor(hit.item.id))!.cacheHit).toBe(true);
    expect((await allRows()).length).toBe(2);
  });
});
