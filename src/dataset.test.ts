import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_RULES, parseItems, sha256, validateDataset } from './dataset.ts';
import type { Item } from './types.ts';

const small = { ...DEMO_RULES, minItems: 3, maxItems: 10, minCritical: 1, minOther: 0 };
const item = (id: string, label: string, text = 't'): Item => ({ id, text, label });

test('valid small dataset passes and counts classes', () => {
  const { errors, counts } = validateDataset([item('a', 'rfi'), item('b', 'rfi'), item('c', 'notice_of_delay_or_claim')], small);
  assert.deepEqual(errors, []);
  assert.equal(counts.rfi, 2);
});

test('unknown label names the line id', () => {
  const { errors } = validateDataset([item('a', 'rfi'), item('b', 'spam'), item('c', 'notice_of_delay_or_claim')], small);
  assert.deepEqual(errors, ['item b: unknown label "spam"']);
});

test('duplicate id and empty text', () => {
  const { errors } = validateDataset([item('a', 'rfi'), item('a', 'rfi', ' '), item('c', 'notice_of_delay_or_claim')], small);
  assert.deepEqual(errors, ['item a: duplicate id', 'item a: empty text']);
});

test('undersampled critical class is reported', () => {
  const { errors } = validateDataset([item('a', 'rfi'), item('b', 'rfi'), item('c', 'rfi')], small);
  assert.deepEqual(errors, ['class notice_of_delay_or_claim has 0 items; needs >= 1']);
});

test('demo rules enforce size and per-class minimums', () => {
  const { errors } = validateDataset([item('a', 'rfi')]);
  assert.ok(errors.includes('dataset has 1 items; expected 250-400'));
  assert.ok(errors.includes('class notice_of_delay_or_claim has 0 items; needs >= 50'));
  assert.ok(errors.includes('class rfi has 1 items; needs >= 30'));
});

test('parseItems skips blank lines, reports bad JSON line number; sha256 is stable', () => {
  assert.equal(parseItems('{"id":"a","text":"t","label":"rfi"}\n\n').length, 1);
  assert.throws(() => parseItems('{"id":"a"}\n{oops'), /line 2/);
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
