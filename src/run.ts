import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadItems, sha256, sha256File } from './dataset.ts';
import { classify } from './openrouter.ts';
import { mulberry32 } from './stats.ts';
import { ARMS, type ArmName, type CallRecord, type Item, type Manifest, type ResolvedManifest } from './types.ts';

export type Prepared = { manifest: ResolvedManifest; items: Item[]; prompt: string };

/** Verify the dataset against its pre-registered hash and resolve the prompt. Makes no API calls. */
export function prepare(m: Manifest): Prepared {
  const actual = sha256File(m.dataset.path);
  if (actual !== m.dataset.sha256)
    throw new Error(
      `dataset hash mismatch for ${m.dataset.path}\n  manifest: ${m.dataset.sha256}\n  actual:   ${actual}\n` +
        'The dataset changed after pre-registration; no API calls were made.',
    );
  const prompt = readFileSync(m.prompt, 'utf8');
  return { manifest: { ...m, promptSha256: sha256(prompt) }, items: loadItems(m.dataset.path), prompt };
}

/** Rough pre-run estimate: ~4 chars per token, ~10 output tokens per call. */
export function estimate({ manifest: m, items, prompt }: Prepared) {
  const calls = items.length * ARMS.length * m.k;
  const inTok = items.reduce((s, it) => s + (prompt.length + it.text.length) / 4, 0) * m.k;
  const outTok = items.length * m.k * 10;
  const usd = ARMS.reduce((s, a) => {
    const p = m.prices[m[a].model];
    return s + (inTok * p.inPerMTok + outTok * p.outPerMTok) / 1e6;
  }, 0);
  return { calls, usd };
}

type Task = { item: Item; arm: ArmName; repeat: number };
const key = (id: string, arm: string, repeat: number) => `${id}|${arm}|${repeat}`;

export function readRecords(runDir: string): CallRecord[] {
  const p = join(runDir, 'responses.jsonl');
  return existsSync(p)
    ? readFileSync(p, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
}

export type ExecuteOpts = {
  prepared: Prepared;
  runDir: string;
  apiKey: string;
  fetch?: typeof fetch;
  retryDelayMs?: number;
  onProgress?: (done: number, total: number) => void;
};

/** Run (or resume) every (item, arm, repeat) call in a seeded shuffled order. Returns number of calls made. */
export async function execute(o: ExecuteOpts): Promise<number> {
  const { manifest: m, items, prompt } = o.prepared;
  mkdirSync(o.runDir, { recursive: true });
  const mPath = join(o.runDir, 'manifest.json');
  const resolved = JSON.stringify(m, null, 2) + '\n';
  if (existsSync(mPath) && readFileSync(mPath, 'utf8') !== resolved)
    throw new Error(`${o.runDir} was started with a different manifest; refusing to resume into it`);
  writeFileSync(mPath, resolved);
  if (!existsSync(join(o.runDir, 'env.json')))
    writeFileSync(
      join(o.runDir, 'env.json'),
      JSON.stringify({ harness: JSON.parse(readFileSync('package.json', 'utf8')).version, node: process.version, platform: process.platform }, null, 2) + '\n',
    );

  const done = new Set(readRecords(o.runDir).map((r) => key(r.item_id, r.arm, r.repeat)));
  const all: Task[] = items.flatMap((item) => ARMS.flatMap((arm) => Array.from({ length: m.k }, (_, repeat) => ({ item, arm, repeat }))));
  // Seeded Fisher-Yates: interleaves arms over time so they share network conditions.
  const rand = mulberry32(m.seed);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const todo = all.filter((t) => !done.has(key(t.item.id, t.arm, t.repeat)));

  const log = join(o.runDir, 'responses.jsonl');
  let next = 0;
  let made = 0;
  const worker = async () => {
    while (next < todo.length) {
      const t = todo[next++];
      const r = await classify({
        ...t,
        spec: m[t.arm],
        prompt,
        labels: m.labels,
        temperature: m.temperature,
        apiKey: o.apiKey,
        fetch: o.fetch,
        retryDelayMs: o.retryDelayMs,
      });
      appendFileSync(log, JSON.stringify(r) + '\n'); // one line per call, written immediately: the log is the resume state
      made++;
      o.onProgress?.(done.size + made, all.length);
    }
  };
  await Promise.all(Array.from({ length: m.concurrency ?? 4 }, worker));
  return made;
}
