import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, type ClassifyOpts } from './openrouter.ts';

const reply = (content: string, status = 200) =>
  new Response(
    JSON.stringify({ model: 'v/m', provider: 'Host', choices: [{ message: { content } }], usage: { prompt_tokens: 12, completion_tokens: 3, cost: 0.0001 } }),
    { status },
  );

function opts(fetchImpl: (url: string, init: RequestInit) => Promise<Response>): ClassifyOpts {
  return {
    arm: 'candidate',
    spec: { model: 'v/m', providers: ['host'] },
    item: { id: 'i1', text: 'hello', label: 'rfi' },
    repeat: 2,
    prompt: 'Classify: {{text}}',
    labels: ['rfi', 'early_warning'],
    temperature: 0,
    apiKey: 'k',
    fetch: fetchImpl as typeof fetch,
    retryDelayMs: 1,
  };
}

test('valid label -> ok record with metadata; request pins provider and schema', async () => {
  let sent: any;
  const r = await classify(opts(async (_u, init) => ((sent = JSON.parse(init.body as string)), reply('{"label":"rfi"}'))));
  assert.equal(r.status, 'ok');
  assert.equal(r.label, 'rfi');
  assert.deepEqual([r.served_by, r.model, r.prompt_tokens, r.completion_tokens, r.cost_usd], ['Host', 'v/m', 12, 3, 0.0001]);
  assert.equal(r.repeat, 2);
  assert.match(r.request_hash, /^[0-9a-f]{64}$/);
  assert.deepEqual(sent.provider, { order: ['host'], allow_fallbacks: false, require_parameters: true });
  assert.deepEqual(sent.response_format.json_schema.schema.properties.label.enum, ['rfi', 'early_warning']);
  assert.equal(sent.messages[0].content, 'Classify: hello');
});

test('out-of-set label -> parse_failure with raw text kept', async () => {
  const r = await classify(opts(async () => reply('{"label":"spam"}')));
  assert.equal(r.status, 'parse_failure');
  assert.equal(r.label, null);
  assert.equal(r.raw, '{"label":"spam"}');
});

test('non-JSON content -> parse_failure, not coerced', async () => {
  const r = await classify(opts(async () => reply('```json\n{"label":"rfi"}\n```')));
  assert.equal(r.status, 'parse_failure');
});

test('HTTP 400 -> error, no retry', async () => {
  let calls = 0;
  const r = await classify(opts(async () => (calls++, new Response('bad provider', { status: 400 }))));
  assert.equal(r.status, 'error');
  assert.match(r.error!, /HTTP 400: bad provider/);
  assert.equal(calls, 1);
});

test('429 is retried, then succeeds', async () => {
  let calls = 0;
  const r = await classify(opts(async () => (++calls < 3 ? new Response('slow down', { status: 429 }) : reply('{"label":"early_warning"}'))));
  assert.equal(calls, 3);
  assert.equal(r.label, 'early_warning');
});

test('network failure on every attempt -> error record, never throws', async () => {
  const r = await classify(opts(async () => {
    throw new Error('ECONNRESET');
  }));
  assert.equal(r.status, 'error');
  assert.equal(r.error, 'ECONNRESET');
});

test('omitted temperature is not sent (hosts that reject it would otherwise be unroutable)', async () => {
  let sent: any;
  const o = opts(async (_u, init) => ((sent = JSON.parse(init.body as string)), reply('{"label":"rfi"}')));
  delete o.temperature;
  await classify(o);
  assert.ok(!('temperature' in sent));
});
