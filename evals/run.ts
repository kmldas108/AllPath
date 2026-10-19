// Eval harness — measures the quality of what the model writes (build guide Step 9).
//
// This is a different job from `npm test`. The test suite asks whether the app does what the
// spec says. This asks whether the AI's output is any good, which no amount of passing tests
// can tell you.
//
// Three rules from the build guide are enforced here rather than left to discipline:
//
// 1. Expectations are written first. They live in each case folder's expected.md, authored
//    before any output existed, and in cases.json. This script only checks them.
// 2. Each case runs at least three times, because the model does not say the same thing
//    twice and one run tells you about one run.
// 3. Nothing is scored unless it came from the model. If the server returns fallback content
//    the run is aborted, loudly — scoring canned text would produce a beautiful table that
//    means nothing. Run the server with ALLPATH_EVAL_MODE=1 so it refuses to fabricate at all.
//
// Usage:
//   1. Start the server with measurement mode on, in its own terminal:
//        ALLPATH_EVAL_MODE=1 npm run dev          (PowerShell: $env:ALLPATH_EVAL_MODE=1; npm run dev)
//   2. npm run eval
//
// Results are written to evals/results/<timestamp>.json — raw outputs included, so a reviewer
// can disagree with a verdict rather than take it on trust.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.ALLPATH_URL ?? 'http://localhost:3000';
const REPEATS = Number(process.env.ALLPATH_EVAL_REPEATS ?? 3);
const MODEL = 'gemini-2.5-flash'; // pinned per spec section 2; recorded with every result

interface Case {
  id: string;
  mode: string;
  prefs: Record<string, unknown>;
  classPackData?: Record<string, string>;
  checkFields: string[];
  mustContain: string[];
  mustContainAny?: string[];
  mustNotContain: string[];
  humanJudgement: string | null;
}

interface RunResult {
  caseId: string;
  run: number;
  passedCodeChecks: boolean;
  failures: string[];
  needsReading: boolean;
  text: string;
  raw: unknown;
}

async function generate(testCase: Case): Promise<any> {
  const response = await fetch(`${BASE_URL}/api/analyze-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inputData: 'placeholder',
      mimeType: 'text-based',
      mode: testCase.mode,
      prefs: testCase.prefs,
      ...testCase.classPackData,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Server returned ${response.status} for ${testCase.id}. ` +
        `With ALLPATH_EVAL_MODE=1 this is what a failed model call looks like — which is the ` +
        `correct behaviour, not a bug in the harness. Body: ${body}`
    );
  }

  const result = await response.json();

  // Rule 3. Without this the harness would happily score hardcoded sample text.
  if (result.generationSource !== 'model') {
    throw new Error(
      `ABORTING: ${testCase.id} returned generationSource="${result.generationSource}". ` +
        `That content did not come from the model and must not be scored. Check the API key ` +
        `and start the server with ALLPATH_EVAL_MODE=1.`
    );
  }
  return result;
}

function check(testCase: Case, output: any): RunResult {
  const text = testCase.checkFields
    .map((f) => String(output[f] ?? ''))
    .join('\n');
  const haystack = text.toLowerCase();
  const failures: string[] = [];

  for (const needle of testCase.mustContain) {
    if (!haystack.includes(needle.toLowerCase())) failures.push(`missing: ${needle}`);
  }
  for (const needle of testCase.mustNotContain) {
    if (haystack.includes(needle.toLowerCase())) failures.push(`present but must not be: ${needle}`);
  }

  let needsReading = false;
  if (testCase.mustContainAny?.length) {
    const found = testCase.mustContainAny.some((n) => haystack.includes(n.toLowerCase()));
    if (!found) {
      failures.push(`none of: ${testCase.mustContainAny.join(' | ')}`);
      needsReading = true; // a translated month name may not match any literal
    }
  }

  return {
    caseId: testCase.id,
    run: 0,
    passedCodeChecks: failures.length === 0,
    failures,
    needsReading: needsReading || Boolean(testCase.humanJudgement),
    text,
    raw: output,
  };
}

async function main() {
  const cases: Case[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf-8')
  );

  console.log(`AllPath eval run — model ${MODEL}, ${REPEATS} repeats per case, ${BASE_URL}`);
  console.log(`Cases: ${cases.length} of 8 filled. Image and audio cases are not yet written.\n`);

  const results: RunResult[] = [];

  for (const testCase of cases) {
    for (let run = 1; run <= REPEATS; run++) {
      process.stdout.write(`  ${testCase.id} run ${run}/${REPEATS} ... `);
      const output = await generate(testCase);
      const result = { ...check(testCase, output), run };
      results.push(result);
      console.log(result.passedCodeChecks ? 'code checks passed' : `FAILED: ${result.failures.join('; ')}`);
    }
  }

  // Counts and totals, never adjectives. "19 of 20" says something; "highly accurate" does not.
  console.log('\n--- Counts ---');
  for (const testCase of cases) {
    const mine = results.filter((r) => r.caseId === testCase.id);
    const passed = mine.filter((r) => r.passedCodeChecks).length;
    console.log(`${testCase.id}: ${passed} of ${mine.length} runs passed the code checks`);
    if (testCase.humanJudgement) {
      console.log(`    still needs a person: ${testCase.humanJudgement}`);
    }
  }

  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      { model: MODEL, ranAt: new Date().toISOString(), repeats: REPEATS, baseUrl: BASE_URL, results },
      null,
      2
    )
  );
  console.log(`\nRaw outputs written to ${path.relative(process.cwd(), file)}`);
  console.log('Code checks decide only part of this. Read the outputs against each expected.md.');
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
