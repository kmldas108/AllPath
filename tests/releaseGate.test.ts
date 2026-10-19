// A1, A2, A3, A4, A5, A6, A18 — the gate.
//
// Each test states the criterion it decides. Expected results come from specs/review-spec.md,
// not from what the implementation happens to do.

import { describe, it, expect } from 'vitest';
import { AppMode } from '../types';
import { generateForReview } from '../services/generateForReview';
import {
  pendingItems,
  releasedItemsFor,
  release,
  discard,
  getItem,
} from '../services/reviewQueue';
import { getMedia, heldMediaIds } from '../services/mediaStore';
import { rowFor } from '../services/reviewLog';
import { ALL_MODES, LEARNER_ID, modelOutput, profile, stubFetch } from './helpers';

const generate = (mode = AppMode.HEAR_IMAGES, media: string | null = 'BASE64PHOTO') =>
  generateForReview({
    mode,
    mediaBase64: media,
    mimeType: 'image/jpeg',
    prefs: profile(),
    learnerAccountId: LEARNER_ID,
    classPackData:
      mode === AppMode.CLASS_PACK
        ? {
            subject: 'Science',
            topic: 'Water Cycle',
            performance: 'Strong',
            parentLanguage: 'Kannada',
          }
        : undefined,
  });

describe('test_release_gate (A1)', () => {
  it('output from a photo does not reach the learner until Release is pressed', async () => {
    stubFetch();
    const { item } = await generate();

    expect(await releasedItemsFor(LEARNER_ID)).toEqual([]);
    expect((await pendingItems()).map((i) => i.id)).toEqual([item.id]);

    await release(item.id, { reviewSeconds: 42 });

    const visible = await releasedItemsFor(LEARNER_ID);
    expect(visible.map((i) => i.id)).toEqual([item.id]);
  });
});

describe('test_release_gate_all_modes (A18)', () => {
  // One run per mode rather than a loop inside one assertion: a loop that throws on the
  // first mode would never reach the other three and the suite would still look green.
  for (const mode of ALL_MODES) {
    it(`holds for ${mode}`, async () => {
      stubFetch(modelOutput({ mode }));
      const { item } = await generate(mode, mode === AppMode.CLASS_PACK ? null : 'MEDIA');

      expect(await releasedItemsFor(LEARNER_ID)).toEqual([]);
      expect(item.status).toBe('pending');

      await release(item.id, { reviewSeconds: 10 });
      expect((await releasedItemsFor(LEARNER_ID)).map((i) => i.id)).toEqual([item.id]);
    });
  }
});

describe('test_unreleased_is_silent (A2)', () => {
  it('a never-released item is absent from the learner query that drives screen and speech', async () => {
    stubFetch();
    await generate();
    await generate(AppMode.EASY_READ);

    // The learner's view and the speech path both read releasedItemsFor and nothing else,
    // so an empty result here is what "absent from both channels" means.
    expect(await releasedItemsFor(LEARNER_ID)).toEqual([]);
    expect((await pendingItems()).length).toBe(2);
  });
});

describe('test_edits_are_what_ships (A3)', () => {
  it('the learner sees the teacher text, not the model original', async () => {
    stubFetch(modelOutput({ spatialDescription: 'MODEL TEXT' }));
    const { item } = await generate();

    await release(item.id, {
      editedContent: { ...item.content, spatialDescription: 'TEACHER TEXT' },
      reviewSeconds: 30,
    });

    const [visible] = await releasedItemsFor(LEARNER_ID);
    expect(visible.content.spatialDescription).toBe('TEACHER TEXT');
    expect(visible.originalContent.spatialDescription).toBe('MODEL TEXT');
    expect((await rowFor(item.id))!.edited).toBe(true);
  });
});

describe('test_discard_leaves_trace (A4)', () => {
  it('a discarded item never reaches the learner and leaves a discarded row', async () => {
    stubFetch();
    const { item } = await generate();

    await discard(item.id, { reviewSeconds: 12 });

    expect(await releasedItemsFor(LEARNER_ID)).toEqual([]);
    const row = await rowFor(item.id);
    expect(row!.decision).toBe('discarded');
  });
});

describe('test_photo_deleted_on_decision (A5)', () => {
  it('the source photo is gone after a release', async () => {
    stubFetch();
    const { item } = await generate();
    expect(await getMedia(item.id)).toBeTruthy();

    await release(item.id, { reviewSeconds: 5 });

    expect(await getMedia(item.id)).toBeUndefined();
    expect(await heldMediaIds()).toEqual([]);
    expect((await getItem(item.id))!.mediaDeleted).toBe(true);
  });

  it('the source photo is gone after a discard too', async () => {
    stubFetch();
    const { item } = await generate();

    await discard(item.id, { reviewSeconds: 5 });

    expect(await getMedia(item.id)).toBeUndefined();
  });
});

describe('test_followups_default_off (A6)', () => {
  it('a fresh item has follow-ups off even though the model offered two', async () => {
    stubFetch(modelOutput({ followUpSuggestions: ['one', 'two'] }));
    const { item } = await generate();

    expect(item.content.followUpSuggestions).toEqual([]);
  });

  it('they stay off through a release, including on edited content', async () => {
    stubFetch(modelOutput({ followUpSuggestions: ['one'] }));
    const { item } = await generate();

    await release(item.id, {
      editedContent: { ...item.content, followUpSuggestions: ['sneaked back in'] },
      reviewSeconds: 1,
    });

    const [visible] = await releasedItemsFor(LEARNER_ID);
    expect(visible.content.followUpSuggestions).toEqual([]);
  });
});
