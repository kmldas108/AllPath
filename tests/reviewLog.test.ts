// A9 — one row per decision, carrying the review duration.

import { describe, it, expect } from 'vitest';
import { AppMode } from '../types';
import { generateForReview } from '../services/generateForReview';
import { release, discard } from '../services/reviewQueue';
import { allRows, rowFor, toCsv } from '../services/reviewLog';
import { LEARNER_ID, profile, stubFetch } from './helpers';

const generate = (media: string | null = 'MEDIA') =>
  generateForReview({
    mode: AppMode.HEAR_IMAGES,
    mediaBase64: media,
    mimeType: 'image/jpeg',
    prefs: profile(),
    learnerAccountId: LEARNER_ID,
  });

describe('test_log_one_row_per_decision (A9)', () => {
  it('a release writes exactly one row, with the seconds spent', async () => {
    stubFetch();
    const { item } = await generate();

    await release(item.id, { reviewSeconds: 73 });

    const rows = await allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].itemId).toBe(item.id);
    expect(rows[0].decision).toBe('released');
    expect(rows[0].reviewSeconds).toBe(73);
    expect(rows[0].edited).toBe(false);
  });

  it('a second Release on the same item writes no second row', async () => {
    stubFetch();
    const { item } = await generate();

    await release(item.id, { reviewSeconds: 10 });
    await release(item.id, { reviewSeconds: 999 });
    await discard(item.id, { reviewSeconds: 999 });

    const rows = await allRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].reviewSeconds).toBe(10); // the first decision stands
    expect(rows[0].decision).toBe('released');
  });

  it('two items give two rows', async () => {
    stubFetch();
    const a = await generate('PHOTO_A');
    const b = await generate('PHOTO_B');

    await release(a.item.id, { reviewSeconds: 20 });
    await discard(b.item.id, { reviewSeconds: 5 });

    expect(await allRows()).toHaveLength(2);
    expect((await rowFor(b.item.id))!.decision).toBe('discarded');
  });

  it('no row carries the learner name, and the CSV has the columns the paper needs', async () => {
    stubFetch();
    const { item } = await generate();
    await release(item.id, { reviewSeconds: 30 });

    const csv = await toCsv();
    expect(csv).not.toContain('Meera');
    expect(csv.split('\n')[0]).toBe(
      'itemId,mode,generatedAt,decidedAt,decision,edited,reviewSeconds,cacheHit'
    );
    expect(csv.split('\n')).toHaveLength(2);
  });
});
