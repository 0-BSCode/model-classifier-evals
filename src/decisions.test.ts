import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, type DecideOpts } from './decisions.ts';

// Shape observed from the live endpoint in the exploration probe.
const answer = (choice: string) => ({
  type: 'choice',
  choice,
  probabilities: { rfi: 0.58, early_warning: 0.42 },
  confidence: 0.47,
});
const reply = (choice: string, status = 200) =>
  new Response(
    JSON.stringify({
      model: 'v/m-decisions-20261006',
      answers: { label: answer(choice) },
      usage: { input_tokens: 381, output_tokens: 0, cost: 0.0000381 },
      provider: 'OpenAI',
    }),
    { status },
  );

function opts(fetchImpl: (url: string, init: RequestInit) => Promise<Response>): DecideOpts {
  return {
    arm: 'candidate',
    spec: { model: 'v/m-decisions', providers: ['openai'], api: 'decisions', question: 'q.json' },
    item: { id: 'i1', text: 'hello', label: 'rfi' },
    repeat: 1,
    labels: ['rfi', 'early_warning'],
    question: { instructions: 'Classify.', criteria: { rfi: 'asks a question', early_warning: 'flags a risk' } },
    apiKey: 'k',
    fetch: fetchImpl as typeof fetch,
    retryDelayMs: 1,
  };
}

test('ok answer -> label, full answer in raw, snapshot, host, tokens, cost; request pins the host', async () => {
  let url = '';
  let sent: any;
  const r = await decide(opts(async (u, init) => ((url = u), (sent = JSON.parse(init.body as string)), reply('rfi'))));
  assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
  assert.deepEqual(sent.state, ['hello']);
  assert.deepEqual(sent.questions.label, { type: 'choice', instructions: 'Classify.', criteria: { rfi: 'asks a question', early_warning: 'flags a risk' } });
  assert.deepEqual(sent.provider, { order: ['openai'], allow_fallbacks: false });
  assert.equal(r.status, 'ok');
  assert.equal(r.label, 'rfi');
  assert.deepEqual(JSON.parse(r.raw!), answer('rfi'));
  assert.equal(r.served_by, 'OpenAI');
  assert.equal(r.model, 'v/m-decisions-20261006');
  assert.equal(r.prompt_tokens, 381);
  assert.equal(r.completion_tokens, 0);
  assert.equal(r.cost_usd, 0.0000381);
  assert.equal(r.repeat, 1);
  assert.equal(r.request_hash.length, 64);
});

test('choice outside the labels -> parse_failure with raw kept', async () => {
  const r = await decide(opts(async () => reply('general_correspondence')));
  assert.equal(r.status, 'parse_failure');
  assert.equal(r.label, null);
  assert.equal(JSON.parse(r.raw!).choice, 'general_correspondence');
});

test('429 is retried, then succeeds', async () => {
  let n = 0;
  const r = await decide(opts(async () => (++n === 1 ? new Response('rate limited', { status: 429 }) : reply('early_warning'))));
  assert.equal(n, 2);
  assert.equal(r.status, 'ok');
  assert.equal(r.label, 'early_warning');
});

test('pinned host unavailable (404) -> error, not retried, never served elsewhere', async () => {
  let n = 0;
  const r = await decide(opts(async () => (n++, new Response('{"error":{"message":"No endpoints found","code":404}}', { status: 404 }))));
  assert.equal(n, 1);
  assert.equal(r.status, 'error');
  assert.match(r.error!, /HTTP 404/);
  assert.equal(r.served_by, null);
});

test('response without an answer -> error', async () => {
  const r = await decide(opts(async () => new Response(JSON.stringify({ answers: {} }))));
  assert.equal(r.status, 'error');
  assert.match(r.error!, /bad response/);
});
