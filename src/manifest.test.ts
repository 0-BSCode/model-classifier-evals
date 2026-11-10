import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertManifest } from './manifest.ts';
import { manifestFixture } from './testkit.ts';

test('valid manifest passes', () => {
  assert.doesNotThrow(() => assertManifest(manifestFixture()));
});

test('missing margin is named', () => {
  const m: any = manifestFixture();
  delete m.decision.margin;
  assert.throws(() => assertManifest(m), /`decision\.margin`/);
});

test('drafting model family reused as an arm is rejected with the reason', () => {
  const m = manifestFixture();
  m.dataset.draftedBy = 'a/some-drafter'; // same vendor as arms 'a/big', 'a/small'
  assert.throws(() => assertManifest(m), /self-preference bias/);
});

test('decisions arm without a question file, and an unknown api, are rejected', () => {
  const m: any = manifestFixture();
  m.candidate.api = 'decisions';
  assert.throws(() => assertManifest(m), /`a\/small` uses the Decisions API but declares no `question` file/);
  m.candidate.question = 'q.json';
  assert.doesNotThrow(() => assertManifest(m));
  m.incumbent.api = 'completions';
  assert.throws(() => assertManifest(m), /`a\/big`: `api` must be/);
});

test('bad sha, missing price, unknown critical class, multiple providers', () => {
  const m = manifestFixture();
  m.dataset.sha256 = 'nope';
  m.candidate = { model: 'a/other', providers: ['p', 'q'] };
  m.guardrails.criticalClasses = { zzz: 0 };
  assert.throws(() => assertManifest(m), (e: Error) =>
    ['sha256', 'no pinned price', 'exactly one provider', 'critical class `zzz`'].every((s) => e.message.includes(s)),
  );
});
