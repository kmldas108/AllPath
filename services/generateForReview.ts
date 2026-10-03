// The one place generation happens, for all four modes (spec A18, T10).
//
// There is deliberately a single function here. In v2 the result of analyzeContent went
// straight to setMode(AppMode.RESULT) and onto the learner's screen; now every mode comes
// through this door and leaves it as a pending queue item. One door is what makes C1
// checkable: if content reaches a learner unreviewed, it came through here, and there is
// nowhere else to look.

import { AppMode, EducationalContent, ReviewItem, UserPreferences } from '../types';
import { analyzeContent } from './geminiService';
import { forGeneration } from './profileStore';
import { cacheKey, readCache, writeCache } from './outputCache';
import { enqueue } from './reviewQueue';

export interface ClassPackData {
  subject: string;
  topic: string;
  performance: string;
  parentLanguage: string;
}

export interface GenerateResult {
  item: ReviewItem;
  cacheHit: boolean;
}

export async function generateForReview(params: {
  mode: AppMode;
  mediaBase64: string | null;
  mimeType: string;
  prefs: UserPreferences;
  learnerAccountId: string;
  classPackData?: ClassPackData;
}): Promise<GenerateResult> {
  const wirePrefs = forGeneration(params.prefs);

  const key = await cacheKey({
    media: params.mediaBase64,
    mode: params.mode,
    prefs: wirePrefs,
    extra: params.classPackData
      ? {
          subject: params.classPackData.subject,
          topic: params.classPackData.topic,
          performance: params.classPackData.performance,
          parentLanguage: params.classPackData.parentLanguage,
        }
      : null,
  });

  const cached = await readCache(key);
  let content: EducationalContent;
  let cacheHit: boolean;

  if (cached) {
    content = cached;
    cacheHit = true;
  } else {
    content = await analyzeContent(
      params.mediaBase64 ?? 'placeholder',
      params.mimeType,
      params.mode,
      wirePrefs,
      params.classPackData
    );
    await writeCache(key, content);
    cacheHit = false;
  }

  // A cache hit takes the same path as a fresh generation: into the queue, unreleased
  // (spec C9). The saving is the model call, never the teacher's decision.
  const item = await enqueue({
    mode: params.mode,
    learnerAccountId: params.learnerAccountId,
    content,
    mediaDataUrl: params.mediaBase64
      ? `data:${params.mimeType};base64,${params.mediaBase64}`
      : null,
    cacheHit,
  });

  return { item, cacheHit };
}
