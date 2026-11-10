import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemScores, majorityLabels, median, pairedBootstrap, recall, stability } from './stats.ts';
import { rec } from './testkit.ts';

const gold = new Map([['a', 'x'], ['b', 'y'], ['c', 'x'], ['d', 'y']]);

test('itemScores averages repeats, parse failure is wrong, errors excluded', () => {
  const s = itemScores(
    [
      rec({ item_id: 'a', arm: 'incumbent', label: 'x' }),
      rec({ item_id: 'a', arm: 'incumbent', status: 'parse_failure' }),
      rec({ item_id: 'a', arm: 'incumbent', status: 'error' }),
      rec({ item_id: 'b', arm: 'incumbent', label: 'y' }),
    ],
    gold,
    'incumbent',
  );
  assert.deepEqual([...s], [['a', 0.5], ['b', 1]]);
});

test('paired bootstrap: known delta and deterministic for a seed', () => {
  const inc = new Map([['a', 1], ['b', 1], ['c', 0], ['d', 0]]);
  const cand = new Map([['a', 1], ['b', 1], ['c', 1], ['d', 0]]);
  const r1 = pairedBootstrap(inc, cand, 2000, 7);
  const r2 = pairedBootstrap(inc, cand, 2000, 7);
  assert.equal(r1.delta, 0.25);
  assert.equal(r1.n, 4);
  assert.deepEqual(r1, r2);
  assert.ok(r1.lo <= r1.delta && r1.delta <= r1.hi);
  // identical arms -> zero-width CI at 0
  const same = pairedBootstrap(inc, inc, 500, 1);
  assert.deepEqual([same.lo, same.hi], [0, 0]);
});

test('paired bootstrap only uses items present in both arms', () => {
  const r = pairedBootstrap(new Map([['a', 1], ['z', 0]]), new Map([['a', 0]]), 100, 1);
  assert.equal(r.n, 1);
  assert.equal(r.delta, -1);
});

test('recall over repeats for one class', () => {
  const rs = [
    rec({ item_id: 'a', arm: 'candidate', label: 'x' }),
    rec({ item_id: 'a', arm: 'candidate', label: 'y' }),
    rec({ item_id: 'c', arm: 'candidate', label: 'x' }),
    rec({ item_id: 'c', arm: 'candidate', label: 'x' }),
    rec({ item_id: 'b', arm: 'candidate', label: 'x' }), // gold y: not in recall(x) denominator
  ];
  assert.equal(recall(rs, gold, 'candidate', 'x'), 0.75);
});

test('stability and majority labels', () => {
  const rs = [
    rec({ item_id: 'a', arm: 'incumbent', label: 'x' }),
    rec({ item_id: 'a', arm: 'incumbent', label: 'x' }),
    rec({ item_id: 'b', arm: 'incumbent', label: 'y' }),
    rec({ item_id: 'b', arm: 'incumbent', label: 'x' }),
  ];
  assert.equal(stability(rs, 'incumbent'), 0.5);
  assert.deepEqual([...majorityLabels(rs, 'incumbent')], [['a', 'x'], ['b', 'x']]); // tie -> alphabetical
});

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
});
