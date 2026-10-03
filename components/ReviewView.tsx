import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppMode, EducationalContent, ReviewItem } from '../types';
import { pendingItems, release, discard } from '../services/reviewQueue';
import { getMedia } from '../services/mediaStore';

// The review screen (spec A3, A6, A11). A teacher sees the source and the output together,
// can edit the output, and decides. The timer starts when an item opens and stops at the
// decision — that figure is the review-seconds column in the log, and the number Step 11 of
// the build guide turns on.

const FIELD_LABELS: { key: keyof EducationalContent; label: string }[] = [
  { key: 'spatialDescription', label: 'Spatial description' },
  { key: 'tactileModelSuggestion', label: 'Touch-model suggestion' },
  { key: 'transcript', label: 'Transcript' },
  { key: 'summary', label: 'Summary' },
  { key: 'simplifiedText', label: 'Simplified text' },
  { key: 'analogies', label: 'Analogies' },
  { key: 'studentNotes', label: 'Student notes' },
  { key: 'parentSummary', label: 'Parent message' },
];

interface Props {
  onDone: () => void;
}

const ReviewView: React.FC<Props> = ({ onDone }) => {
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<EducationalContent | null>(null);
  const [media, setMedia] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openedAt = useRef<number>(Date.now());

  const item = queue[index];

  useEffect(() => {
    pendingItems().then((items) => {
      setQueue(items);
      setIndex(0);
    });
  }, []);

  useEffect(() => {
    if (!item) {
      setDraft(null);
      setMedia(null);
      return;
    }
    setDraft(item.content);
    openedAt.current = Date.now();
    getMedia(item.id).then((m) => setMedia(m ?? null));
  }, [item?.id]);

  const editableFields = useMemo(
    () => (draft ? FIELD_LABELS.filter((f) => typeof draft[f.key] === 'string') : []),
    [draft]
  );

  const reviewSeconds = () => (Date.now() - openedAt.current) / 1000;

  const decide = async (decision: 'release' | 'discard') => {
    if (!item || !draft) return;
    setBusy(true);
    try {
      if (decision === 'release') {
        await release(item.id, { editedContent: draft, reviewSeconds: reviewSeconds() });
      } else {
        await discard(item.id, { reviewSeconds: reviewSeconds() });
      }
      const remaining = await pendingItems();
      setQueue(remaining);
      setIndex(0);
      if (remaining.length === 0) onDone();
    } finally {
      setBusy(false);
    }
  };

  if (queue.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <p className="text-xl font-bold text-slate-700">Nothing waiting for review.</p>
        <button onClick={onDone} className="bg-slate-800 text-white font-bold px-6 py-3 rounded-lg">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Review</h1>
          <p className="text-slate-600">
            {queue.length} waiting · {item.mode.replace('_', ' ').toLowerCase()}
            {item.cacheHit && ' · from cache'}
          </p>
        </div>
        <button onClick={onDone} className="text-slate-600 underline">
          Leave review
        </button>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl p-4 shadow">
          <h2 className="font-bold text-slate-700 mb-2">What the learner sent</h2>
          {media ? (
            <img src={media} alt="Source submitted by the learner" className="w-full rounded-lg" />
          ) : (
            <p className="text-slate-500">
              No image for this item{item.mode === AppMode.CLASS_PACK ? ' (Class Pack)' : ''}.
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl p-4 shadow space-y-4">
          <h2 className="font-bold text-slate-700">What the AI produced — edit before release</h2>
          {draft &&
            editableFields.map(({ key, label }) => (
              <label key={String(key)} className="block">
                <span className="block text-sm font-bold text-slate-600 mb-1">{label}</span>
                <textarea
                  className="w-full border-2 border-slate-200 rounded-lg p-2 min-h-[6rem]"
                  value={String(draft[key] ?? '')}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  aria-label={label}
                />
              </label>
            ))}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => decide('release')}
              disabled={busy}
              className="flex-1 bg-green-600 text-white font-black py-3 rounded-lg disabled:opacity-50"
            >
              Release to learner
            </button>
            <button
              onClick={() => decide('discard')}
              disabled={busy}
              className="flex-1 bg-red-100 text-red-800 font-black py-3 rounded-lg disabled:opacity-50"
            >
              Discard
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Releasing deletes the source image from this device.
          </p>
        </section>
      </div>
    </div>
  );
};

export default ReviewView;
