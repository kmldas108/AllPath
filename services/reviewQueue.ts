// The review queue — the gate itself (spec C1, C3, A1-A5, A18).
//
// Everything the model produces lands here as `pending` and goes no further. The learner's
// view reads only `released` items, so there is exactly one way for content to reach a
// learner and it runs through a teacher's decision. A cache hit lands here identically to a
// fresh generation (C9): the cache saves the model call, not the gate.

import { AppMode, EducationalContent, ReviewItem, ReviewDecision } from '../types';
import { STORE, get, put, values } from './storage';
import { deleteMedia, putMedia } from './mediaStore';
import { appendRow } from './reviewLog';

function newId(): string {
  return `itm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Follow-ups start switched off (spec C2, A6), whatever the model offered. */
function withFollowUpsOff(content: EducationalContent): EducationalContent {
  return { ...content, followUpSuggestions: [] };
}

export async function enqueue(params: {
  mode: AppMode;
  learnerAccountId: string;
  content: EducationalContent;
  mediaDataUrl?: string | null;
  cacheHit?: boolean;
}): Promise<ReviewItem> {
  const content = withFollowUpsOff(params.content);
  const item: ReviewItem = {
    id: newId(),
    mode: params.mode,
    learnerAccountId: params.learnerAccountId,
    content,
    originalContent: content,
    status: 'pending',
    generatedAt: new Date().toISOString(),
    cacheHit: params.cacheHit ?? false,
    mediaDeleted: !params.mediaDataUrl,
  };
  await put(STORE.queue, item.id, item);
  if (params.mediaDataUrl) await putMedia(item.id, params.mediaDataUrl);
  return item;
}

export function getItem(id: string): Promise<ReviewItem | undefined> {
  return get<ReviewItem>(STORE.queue, id);
}

async function itemsWhere(predicate: (i: ReviewItem) => boolean): Promise<ReviewItem[]> {
  const all = await values<ReviewItem>(STORE.queue);
  return all.filter(predicate).sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
}

export function pendingItems(): Promise<ReviewItem[]> {
  return itemsWhere((i) => i.status === 'pending');
}

/**
 * What the learner is allowed to see. The only query the learner's view may use, and the
 * reason the gate holds: there is no code path from a pending item to a learner's screen.
 */
export function releasedItemsFor(learnerAccountId: string): Promise<ReviewItem[]> {
  return itemsWhere((i) => i.status === 'released' && i.learnerAccountId === learnerAccountId);
}

async function decide(
  id: string,
  decision: ReviewDecision,
  options: { editedContent?: EducationalContent; reviewSeconds: number }
): Promise<ReviewItem> {
  const item = await getItem(id);
  if (!item) throw new Error(`No review item ${id}`);
  if (item.status !== 'pending') return item; // already decided; no second log row (A9)

  const edited =
    !!options.editedContent &&
    JSON.stringify(options.editedContent) !== JSON.stringify(item.originalContent);

  const decided: ReviewItem = {
    ...item,
    content: options.editedContent
      ? withFollowUpsOff(options.editedContent)
      : item.content,
    status: decision,
    decidedAt: new Date().toISOString(),
    mediaDeleted: true,
  };

  await put(STORE.queue, decided.id, decided);
  await deleteMedia(decided.id); // spec C3: the photo goes once the item is dealt with
  await appendRow({
    itemId: decided.id,
    mode: decided.mode,
    generatedAt: decided.generatedAt,
    decidedAt: decided.decidedAt!,
    decision,
    edited,
    reviewSeconds: Math.max(0, Math.round(options.reviewSeconds)),
    cacheHit: decided.cacheHit,
  });
  return decided;
}

export function release(
  id: string,
  options: { editedContent?: EducationalContent; reviewSeconds: number }
): Promise<ReviewItem> {
  return decide(id, 'released', options);
}

export function discard(id: string, options: { reviewSeconds: number }): Promise<ReviewItem> {
  return decide(id, 'discarded', options);
}
