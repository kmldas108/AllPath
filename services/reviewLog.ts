// One row per teacher decision (spec section 4, A9, A24).
//
// This is evaluation apparatus, not telemetry. The review-seconds column is the number Step 11
// of the build guide turns on — how long a teacher takes to check the AI's output, against how
// long they say adapting the material by hand would take. The cache-hit column is what lets a
// reviewer tell whether a figure came from live generation or from a stored answer (C10).
//
// No learner name is recorded (C4).

import { ReviewLogRow } from '../types';
import { STORE, put, values, get } from './storage';

export async function appendRow(row: ReviewLogRow): Promise<void> {
  const existing = await get<ReviewLogRow>(STORE.log, row.itemId);
  if (existing) return; // one row per item, however many times a button is pressed
  await put(STORE.log, row.itemId, row);
}

export async function allRows(): Promise<ReviewLogRow[]> {
  const rows = await values<ReviewLogRow>(STORE.log);
  return rows.sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));
}

export async function rowFor(itemId: string): Promise<ReviewLogRow | undefined> {
  return get<ReviewLogRow>(STORE.log, itemId);
}

const COLUMNS: (keyof ReviewLogRow)[] = [
  'itemId',
  'mode',
  'generatedAt',
  'decidedAt',
  'decision',
  'edited',
  'reviewSeconds',
  'cacheHit',
];

/** CSV for the paper's analysis. Download it from Settings; nothing is uploaded. */
export async function toCsv(): Promise<string> {
  const rows = await allRows();
  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(COLUMNS.map((c) => String(row[c])).join(','));
  }
  return lines.join('\n');
}
