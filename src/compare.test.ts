import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRuns, NotComparable, type RunData } from './compare.ts';
import { buildReport } from './verdict.ts';
import { manifestFixture, rec } from './testkit.ts';

// 40 items; candidate gets `candMisses` of the non-critical items wrong.
function run(id: string, candMisses: number, m = manifestFixture()): RunData {
  const gold = new Map<string, string>();
  const records = [];
  for (let i = 0; i < 40; i++) {
    const item = `i${String(i).padStart(2, '0')}`;
    const g = i < 10 ? 'n' : 'x';
    gold.set(item, g);
    records.push(rec({ item_id: item, arm: 'incumbent', label: g }));
    records.push(rec({ item_id: item, arm: 'candidate', label: i >= 40 - candMisses ? 'n' : g }));
  }
  return { id, manifest: m, records, report: buildReport(records, gold, m) };
}

test('same verdict with different numbers -> replicated', () => {
  const a = run('ref', 0);
  const b = run('new', 0);
  b.records[3] = { ...b.records[3], latency_ms: 999 }; // numbers differ, verdict should not
  const out = compareRuns(a, b);
  assert.match(out, /^# VERDICT REPLICATED/);
  assert.match(out, /incumbent: 100\.0% of 40 items/);
});

test('different verdict -> not replicated, with label agreement', () => {
  const a = run('ref', 0); // candidate identical and cheaper -> GO
  const b = run('new', 8); // candidate clearly worse -> NO-GO
  assert.equal(a.report.verdict, 'GO');
  assert.equal(b.report.verdict, 'NO-GO');
  const out = compareRuns(a, b);
  assert.match(out, /^# VERDICT NOT REPLICATED/);
  assert.match(out, /candidate: 80\.0% of 40 items/);
});

test('runs differing only in a decisions arm question file -> refuses', () => {
  const dec = (sha: string) => {
    const m = manifestFixture();
    m.candidate = { ...m.candidate, api: 'decisions', question: 'q.json', questionSha256: sha };
    return m;
  };
  assert.doesNotThrow(() => compareRuns(run('a', 0, dec('d'.repeat(64))), run('b', 0, dec('d'.repeat(64)))));
  assert.throws(() => compareRuns(run('a', 0, dec('d'.repeat(64))), run('b', 0, dec('e'.repeat(64)))), /candidate/);
});

test('manifests without `api` (runs from before per-arm APIs) stay comparable', () => {
  const old = manifestFixture();
  assert.equal('api' in old.incumbent || 'api' in old.candidate, false);
  assert.match(compareRuns(run('a', 0, old), run('b', 0, manifestFixture())), /^# VERDICT REPLICATED/);
});

test('different dataset hash or margin -> refuses', () => {
  const m1 = manifestFixture();
  m1.dataset.sha256 = 'c'.repeat(64);
  assert.throws(() => compareRuns(run('a', 0), run('b', 0, m1)), NotComparable);
  const m2 = manifestFixture();
  m2.decision.margin = -0.05;
  assert.throws(() => compareRuns(run('a', 0), run('b', 0, m2)), /decision/);
});
