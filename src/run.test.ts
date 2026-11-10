import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256File } from './dataset.ts';
import { estimate, execute, prepare, readRecords } from './run.ts';
import { manifestFixture, rec } from './testkit.ts';
import type { Manifest } from './types.ts';

const N = 5;

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'run-test-'));
  const data = join(dir, 'data.jsonl');
  writeFileSync(data, Array.from({ length: N }, (_, i) => JSON.stringify({ id: `i${i}`, text: `msg ${i}`, label: 'x' })).join('\n') + '\n');
  writeFileSync(join(dir, 'prompt.md'), 'Classify: {{text}}');
  const { promptSha256: _, ...base } = manifestFixture();
  const m: Manifest = { ...base, dataset: { ...base.dataset, path: data, sha256: sha256File(data) }, prompt: join(dir, 'prompt.md'), k: 3, concurrency: 1 };
  return { dir, m };
}

const counting = () => {
  const c = { n: 0 };
  const f = (async (_u: string, init: RequestInit) => {
    c.n++;
    const body = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ model: body.model, choices: [{ message: { content: '{"label":"x"}' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }));
  }) as typeof fetch;
  return { c, f };
};

test('dataset hash mismatch aborts before any call', () => {
  const { m } = setup();
  writeFileSync(m.dataset.path, '{"id":"edited","text":"t","label":"x"}\n');
  assert.throws(() => prepare(m), /hash mismatch[\s\S]*no API calls/);
});

test('chat-only manifest resolves to exactly the pre-change JSON', () => {
  const { m } = setup();
  const p = prepare(m);
  assert.equal(JSON.stringify(p.manifest), JSON.stringify({ ...m, promptSha256: p.manifest.promptSha256 }));
  assert.deepEqual(p.questions, {});
});

test('decisions question must describe exactly the labels; its hash is on the resolved arm', () => {
  const { dir, m } = setup();
  const q = join(dir, 'q.json');
  const d: Manifest = { ...m, candidate: { ...m.candidate, api: 'decisions', question: q } };
  writeFileSync(q, JSON.stringify({ instructions: 'i', criteria: { x: 'ex' } }));
  assert.throws(() => prepare(d), /missing: n/);
  writeFileSync(q, JSON.stringify({ instructions: 'i', criteria: { x: 'ex', n: 'en', zzz: 'z' } }));
  assert.throws(() => prepare(d), /not in labels: zzz/);
  writeFileSync(q, JSON.stringify({ instructions: 'i', criteria: { x: 'ex', n: 'en' } }));
  const p = prepare(d);
  assert.equal(p.manifest.candidate.questionSha256, sha256File(q));
  assert.equal(p.manifest.incumbent.questionSha256, undefined);
  assert.deepEqual(p.questions.candidate?.criteria, { x: 'ex', n: 'en' });
});

test('2 arms x k=3 -> 6N records, all fields present, arms interleaved', async () => {
  const { dir, m } = setup();
  const { c, f } = counting();
  const p = prepare(m);
  assert.equal(estimate(p).calls, 6 * N);
  const runDir = join(dir, 'run');
  await execute({ prepared: p, runDir, apiKey: 'k', fetch: f });
  const rs = readRecords(runDir);
  assert.equal(c.n, 6 * N);
  assert.equal(rs.length, 6 * N);
  assert.equal(new Set(rs.map((r) => `${r.item_id}|${r.arm}|${r.repeat}`)).size, 6 * N);
  for (const k of ['item_id', 'arm', 'repeat', 'request_hash', 'status', 'raw', 'label', 'served_by', 'model', 'prompt_tokens', 'completion_tokens', 'latency_ms', 'ts'])
    assert.ok(k in rs[0], k);
  const half = rs.length / 2;
  for (const part of [rs.slice(0, half), rs.slice(half)]) assert.deepEqual(new Set(part.map((r) => r.arm)), new Set(['incumbent', 'candidate']));
  assert.equal(JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8')).promptSha256.length, 64);
  assert.ok(JSON.parse(readFileSync(join(runDir, 'env.json'), 'utf8')).node);
});

test('chat incumbent + decisions candidate -> each arm hits its own API, interleaved, 6N records', async () => {
  const { dir, m } = setup();
  const q = join(dir, 'q.json');
  writeFileSync(q, JSON.stringify({ instructions: 'i', criteria: { x: 'ex', n: 'en' } }));
  const d: Manifest = { ...m, candidate: { ...m.candidate, api: 'decisions', question: q } };
  const urls = new Map<string, number>();
  const f = (async (u: string, init: RequestInit) => {
    urls.set(u, (urls.get(u) ?? 0) + 1);
    const body = JSON.parse(init.body as string);
    return u.endsWith('/decisions')
      ? new Response(JSON.stringify({ model: body.model, answers: { label: { choice: 'x', probabilities: { x: 0.9, n: 0.1 } } }, usage: { input_tokens: 5, output_tokens: 0 }, provider: 'P' }))
      : new Response(JSON.stringify({ model: body.model, choices: [{ message: { content: '{"label":"x"}' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } }));
  }) as typeof fetch;
  const runDir = join(dir, 'run');
  await execute({ prepared: prepare(d), runDir, apiKey: 'k', fetch: f });
  const rs = readRecords(runDir);
  assert.equal(rs.length, 6 * N);
  assert.equal(urls.get('https://openrouter.ai/api/v1/chat/completions'), 3 * N);
  assert.equal(urls.get('https://openrouter.ai/api/alpha/decisions'), 3 * N);
  assert.ok(rs.filter((r) => r.arm === 'candidate').every((r) => r.status === 'ok' && JSON.parse(r.raw!).probabilities.x === 0.9));
  assert.ok(rs.filter((r) => r.arm === 'incumbent').every((r) => r.raw === '{"label":"x"}'));
  const half = rs.length / 2;
  for (const part of [rs.slice(0, half), rs.slice(half)]) assert.deepEqual(new Set(part.map((r) => r.arm)), new Set(['incumbent', 'candidate']));
});

test('resume after M records makes only the remaining 6N-M calls', async () => {
  const { dir, m } = setup();
  const runDir = join(dir, 'run');
  const p = prepare(m);
  await execute({ prepared: p, runDir, apiKey: 'k', fetch: counting().f });
  const M = 7;
  const log = join(runDir, 'responses.jsonl');
  writeFileSync(log, readFileSync(log, 'utf8').split('\n').slice(0, M).join('\n') + '\n'); // simulate interruption
  const { c, f } = counting();
  const made = await execute({ prepared: p, runDir, apiKey: 'k', fetch: f });
  assert.equal(made, 6 * N - M);
  assert.equal(c.n, 6 * N - M);
  assert.equal(readRecords(runDir).length, 6 * N);
});

test('resume into a run started with a different manifest is refused', async () => {
  const { dir, m } = setup();
  const runDir = join(dir, 'run');
  await execute({ prepared: prepare(m), runDir, apiKey: 'k', fetch: counting().f });
  await assert.rejects(execute({ prepared: prepare({ ...m, k: 2 }), runDir, apiKey: 'k', fetch: counting().f }), /different manifest/);
});

test('estimate uses past token averages per model, else a conservative assumption', () => {
  const { m } = setup();
  const p = prepare(m);
  const assumed = estimate(p);
  assert.ok(assumed.arms.every((a) => a.basis === 'assumed'));
  const past = [rec({ item_id: 'z', arm: 'candidate', model: 'a/small', prompt_tokens: 1000, completion_tokens: 2000 })];
  const e = estimate(p, past);
  const small = e.arms.find((a) => a.model === 'a/small')!;
  assert.equal(small.basis, '1 past calls');
  // 5 items x k=3 = 15 calls x (1000 x $1 + 2000 x $5) / 1e6
  assert.ok(Math.abs(small.usd - (15 * 11000) / 1e6) < 1e-12);
  assert.equal(e.arms.find((a) => a.model === 'a/big')!.basis, 'assumed');
});

test('estimate counts dated snapshot ids as the same model, but not other models sharing a prefix', () => {
  const { m } = setup();
  const p = prepare(m);
  const past = [
    rec({ item_id: 'z', arm: 'candidate', model: 'a/small-20261006' }),
    rec({ item_id: 'z', arm: 'candidate', model: 'a/small-decisions-20261006' }),
    rec({ item_id: 'z', arm: 'incumbent', model: 'a/bigger' }),
  ];
  const e = estimate(p, past);
  assert.equal(e.arms.find((a) => a.model === 'a/small')!.basis, '1 past calls');
  assert.equal(e.arms.find((a) => a.model === 'a/big')!.basis, 'assumed');
});
