import { appendFileSync, existsSync, globSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadItems, sha256, sha256File } from './dataset.ts';
import { decide } from './decisions.ts';
import { classify } from './openrouter.ts';
import { mulberry32 } from './stats.ts';
import { ARMS, type ArmName, type CallRecord, type Item, type Manifest, type Question, type ResolvedManifest } from './types.ts';

export type Prepared = { manifest: ResolvedManifest; items: Item[]; prompt: string; questions: Partial<Record<ArmName, Question>> };

/** Verify the dataset against its pre-registered hash and resolve the prompt and question files. Makes no API calls. */
export function prepare(m: Manifest): Prepared {
  const actual = sha256File(m.dataset.path);
  if (actual !== m.dataset.sha256)
    throw new Error(
      `dataset hash mismatch for ${m.dataset.path}\n  manifest: ${m.dataset.sha256}\n  actual:   ${actual}\n` +
        'The dataset changed after pre-registration; no API calls were made.',
    );
  const prompt = readFileSync(m.prompt, 'utf8');
  const manifest: ResolvedManifest = { ...m, promptSha256: sha256(prompt) };
  const questions: Prepared['questions'] = {};
  for (const a of ARMS) {
    if (m[a].api !== 'decisions') continue; // chat arms stay byte-identical in manifest.json
    const text = readFileSync(m[a].question!, 'utf8');
    const q: Question = JSON.parse(text);
    const keys = Object.keys(q.criteria ?? {});
    const missing = m.labels.filter((l) => !keys.includes(l));
    const extra = keys.filter((k) => !m.labels.includes(k));
    if (typeof q.instructions !== 'string' || missing.length || extra.length)
      throw new Error(
        `question file ${m[a].question} must have \`instructions\` and exactly one description per label` +
          (missing.length ? `; missing: ${missing.join(', ')}` : '') +
          (extra.length ? `; not in labels: ${extra.join(', ')}` : ''),
      );
    manifest[a] = { ...m[a], questionSha256: sha256(text) };
    questions[a] = q;
  }
  return { manifest, items: loadItems(m.dataset.path), prompt, questions };
}

/**
 * Pre-run cost estimate. Per model, uses average token counts from past calls when there are any
 * (e.g. a pilot or reference run). Otherwise it assumes ~4 chars per input token and a conservative
 * 300 output tokens per call, because reasoning models bill hidden thinking as output.
 */
export function estimate({ manifest: m, items, prompt }: Prepared, past: CallRecord[] = []) {
  const perArm = items.length * m.k;
  const arms = ARMS.map((a) => {
    const model = m[a].model;
    const seen = past.filter((r) => r.model === model && r.status !== 'error' && r.prompt_tokens != null);
    const avg = (f: (r: CallRecord) => number) => seen.reduce((s, r) => s + f(r), 0) / seen.length;
    const [inTok, outTok] = seen.length
      ? [avg((r) => r.prompt_tokens!), avg((r) => r.completion_tokens ?? 0)]
      : [items.reduce((s, it) => s + (prompt.length + it.text.length) / 4, 0) / items.length, 300];
    const p = m.prices[model];
    return { arm: a, model, basis: seen.length ? `${seen.length} past calls` : 'assumed', usd: (perArm * (inTok * p.inPerMTok + outTok * p.outPerMTok)) / 1e6 };
  });
  return { calls: perArm * ARMS.length, usd: arms.reduce((s, a) => s + a.usd, 0), arms };
}

/** Every record from committed/previous runs, for estimates. */
export const pastRecords = () => globSync('runs/*/*/responses.jsonl').flatMap((f) => readRecords(join(f, '..')));

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
      const common = { ...t, spec: m[t.arm], labels: m.labels, apiKey: o.apiKey, fetch: o.fetch, retryDelayMs: o.retryDelayMs };
      const r =
        m[t.arm].api === 'decisions'
          ? await decide({ ...common, question: o.prepared.questions[t.arm]! })
          : await classify({ ...common, prompt, temperature: m.temperature });
      appendFileSync(log, JSON.stringify(r) + '\n'); // one line per call, written immediately: the log is the resume state
      made++;
      o.onProgress?.(done.size + made, all.length);
    }
  };
  await Promise.all(Array.from({ length: m.concurrency ?? 4 }, worker));
  return made;
}
