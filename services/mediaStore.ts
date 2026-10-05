// The source photo or clip, held only until the item is dealt with (spec C3).
//
// It is stored apart from the queue item on purpose: deleting it must not mean rewriting the
// item, and an item's history has to survive in the log after its media is gone.

import { STORE, get, put, del, keys } from './storage';

export function putMedia(itemId: string, dataUrl: string): Promise<unknown> {
  return put(STORE.media, itemId, dataUrl);
}

export function getMedia(itemId: string): Promise<string | undefined> {
  return get<string>(STORE.media, itemId);
}

export function deleteMedia(itemId: string): Promise<unknown> {
  return del(STORE.media, itemId);
}

export function heldMediaIds(): Promise<string[]> {
  return keys(STORE.media);
}
