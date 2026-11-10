import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, decide, renderVerdict } from './verdict.ts';
import { rec } from './testkit.ts';
import type { Manifest } from './types.ts';

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
  assert.match(v.rule, /^3 \(guardrail\)/);
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
  assert.equal(r.verdict, 'INCONCLUSIVE'); // delta -0.025, CI includes margin
  assert.equal(r.guardrails[0].pass, false);
  const md = renderVerdict(r);
  assert.match(md.split('\n')[0], /^# Verdict: (GO|NO-GO|INCONCLUSIVE),/);
  assert.equal(md, renderVerdict(buildReport(records, gold, m)));
});
