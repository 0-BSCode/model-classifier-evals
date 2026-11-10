import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadItems } from './dataset.ts';
import { readRecords } from './run.ts';
import { buildReport, decide, renderVerdict } from './verdict.ts';
import { manifestFixture, rec } from './testkit.ts';
import type { Manifest, ResolvedManifest } from './types.ts';

const dec: Manifest['decision'] = { margin: -0.02, costGain: 0.2, latencyGain: 0.2, maxErrorRate: 0.02 };
const arms = (p: { ci?: number; cc?: number; il?: number; cl?: number; ie?: number } = {}) => ({
  incumbent: { errorRate: p.ie ?? 0, costPerCall: p.ci ?? 1, medianLatencyMs: p.il ?? 100 },
  candidate: { errorRate: 0, costPerCall: p.cc ?? 1, medianLatencyMs: p.cl ?? 100 },
});
const d = (lo: number, hi: number) => ({ incumbent: 0.8, candidate: 0.8, delta: (lo + hi) / 2, lo, hi, n: 100 });
const ok = [{ pass: true }];

test('non-inferior and cheaper -> GO by cost rule', () => {
  const v = decide(d(-0.01, 0.02), arms({ ci: 1, cc: 0.6 }), ok, dec);
  assert.equal(v.verdict, 'GO');
  assert.match(v.rule, /^5 \(cost\)/);
});

test('CI includes margin -> INCONCLUSIVE', () => {
  const v = decide(d(-0.05, 0.01), arms({ cc: 0.1 }), ok, dec);
  assert.equal(v.verdict, 'INCONCLUSIVE');
  assert.match(v.rule, /more items needed/);
});

test('CI entirely below margin -> NO-GO', () => {
  assert.equal(decide(d(-0.1, -0.03), arms(), ok, dec).verdict, 'NO-GO');
});

test('strictly better but guardrail fails -> NO-GO by guardrail', () => {
  const v = decide(d(0.02, 0.08), arms(), [{ pass: false }], dec);
  assert.equal(v.verdict, 'NO-GO');
  assert.match(v.rule, /^1 \(guardrail\)/);
});

test('strictly better -> GO by accuracy', () => {
  assert.match(decide(d(0.01, 0.05), arms(), ok, dec).rule, /^4 /);
});

test('non-inferior, faster but not cheaper -> GO by latency', () => {
  assert.match(decide(d(-0.01, 0.01), arms({ cl: 50 }), ok, dec).rule, /^6 \(latency\)/);
});

test('no benefit -> NO-GO', () => {
  const v = decide(d(-0.01, 0.01), arms({ cc: 0.95, cl: 95 }), ok, dec);
  assert.equal(v.verdict, 'NO-GO');
  assert.match(v.rule, /^7 \(no benefit\)/);
});

test('guardrail failure beats uncertain accuracy -> NO-GO', () => {
  const v = decide(d(-0.05, 0.01), arms(), [{ pass: false }], dec);
  assert.equal(v.verdict, 'NO-GO');
  assert.match(v.rule, /^1 \(guardrail\)/);
});

test('error rate above max -> INCONCLUSIVE even if a guardrail fails', () => {
  assert.match(decide(d(0.1, 0.2), arms({ ie: 0.1 }), [{ pass: false }], dec).rule, /^0 \(errors\)/);
});

test('error rate above max -> INCONCLUSIVE regardless of accuracy', () => {
  const v = decide(d(0.1, 0.2), arms({ ie: 0.1 }), ok, dec);
  assert.equal(v.verdict, 'INCONCLUSIVE');
  assert.match(v.rule, /^0 \(errors\)/);
});

test('end to end: report, critical-class guardrail, first line is the verdict, deterministic', () => {
  const m: Manifest = {
    name: 't',
    dataset: { path: 'x', sha256: 'abc', draftedBy: 'v/x' },
    prompt: 'p',
    labels: ['x', 'n'],
    k: 1,
    seed: 1,
    temperature: 0,
    bootstrap: 500,
    incumbent: { model: 'a/big', providers: ['p'] },
    candidate: { model: 'a/small', providers: ['p'] },
    prices: { 'a/big': { inPerMTok: 3, outPerMTok: 15 }, 'a/small': { inPerMTok: 1, outPerMTok: 5 } },
    decision: dec,
    guardrails: { criticalClasses: { n: 0 }, maxParseFailureRate: 0.02 },
  };
  const gold = new Map<string, string>();
  const records = [];
  for (let i = 0; i < 40; i++) {
    const id = `i${String(i).padStart(2, '0')}`;
    const g = i < 10 ? 'n' : 'x';
    gold.set(id, g);
    records.push(rec({ item_id: id, arm: 'incumbent', label: g }));
    // candidate misses one critical item, otherwise perfect
    records.push(rec({ item_id: id, arm: 'candidate', label: i === 0 ? 'x' : g }));
  }
  const r = buildReport(records, gold, m);
  assert.equal(r.verdict, 'NO-GO'); // guardrail fails before the (inconclusive) accuracy rules
  assert.equal(r.guardrails[0].pass, false);
  const md = renderVerdict(r);
  assert.match(md.split('\n')[0], /^# Verdict: (GO|NO-GO|INCONCLUSIVE),/);
  assert.equal(md, renderVerdict(buildReport(records, gold, m)));
});

// --- completeness (refuse-incomplete-runs) ---

// 4 items x 2 arms x k=2, all correct.
function complete() {
  const m = { ...manifestFixture(), k: 2 };
  const gold = new Map([['a', 'n'], ['b', 'x'], ['c', 'x'], ['d', 'x']]);
  const records = [...gold].flatMap(([id, g]) =>
    (['incumbent', 'candidate'] as const).flatMap((arm) => [0, 1].map((repeat) => rec({ item_id: id, arm, repeat, label: g }))),
  );
  return { m, gold, records };
}

test('complete run is scored', () => {
  const { m, gold, records } = complete();
  assert.doesNotThrow(() => buildReport(records, gold, m));
});

test('missing observation is refused with a resume hint', () => {
  const { m, gold, records } = complete();
  assert.throws(() => buildReport(records.slice(1), gold, m), /cannot be scored[\s\S]*missing: a\/incumbent\/0[\s\S]*--resume/);
});

test('duplicate with unchanged record count is refused', () => {
  const { m, gold, records } = complete();
  records[1] = { ...records[0] };
  assert.throws(() => buildReport(records, gold, m), /duplicate: a\/incumbent\/0/);
});

test('unknown item, unknown arm and invalid repeats are refused', () => {
  const bad = [
    { item_id: 'zz' },
    { arm: 'third' as never },
    { repeat: 2 },
    { repeat: -1 },
    { repeat: 0.5 },
  ];
  for (const p of bad) {
    const { m, gold, records } = complete();
    records.push(rec({ item_id: 'a', arm: 'candidate', ...p }));
    assert.throws(() => buildReport(records, gold, m), /cannot be scored/, JSON.stringify(p));
  }
});

test('complete run with API errors reaches the error-rate rule', () => {
  const { m, gold, records } = complete();
  records[0] = { ...records[0], status: 'error', label: null, error: 'HTTP 500' };
  const r = buildReport(records, gold, m);
  assert.equal(r.verdict, 'INCONCLUSIVE');
  assert.match(r.rule, /^0 \(errors\)/);
});

test('six-record subset of the Luna vs Gemma reference run is refused, not GO', () => {
  const dir = 'runs/correspondence-luna-vs-gemma/2026-11-10T01-50-29-800Z';
  const m: ResolvedManifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
  const gold = new Map(loadItems(m.dataset.path).map((it) => [it.id, it.label]));
  const all = readRecords(dir);
  const id = [...gold].find(([i, g]) => g === 'notice_of_delay_or_claim' && all.filter((r) => r.item_id === i).every((r) => r.label === g))![0];
  const six = all.filter((r) => r.item_id === id);
  assert.equal(six.length, 6);
  assert.throws(() => buildReport(six, gold, m), /cannot be scored[\s\S]*1734 observation\(s\) missing/);
});
