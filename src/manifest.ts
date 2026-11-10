import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Manifest } from './types.ts';

const REQUIRED: [path: string, type: 'string' | 'number' | 'object'][] = [
  ['name', 'string'],
  ['dataset.path', 'string'],
  ['dataset.sha256', 'string'],
  ['dataset.draftedBy', 'string'],
  ['prompt', 'string'],
  ['labels', 'object'],
  ['k', 'number'],
  ['seed', 'number'],
  ['incumbent.model', 'string'],
  ['incumbent.providers', 'object'],
  ['candidate.model', 'string'],
  ['candidate.providers', 'object'],
  ['prices', 'object'],
  ['decision.margin', 'number'],
  ['decision.costGain', 'number'],
  ['decision.latencyGain', 'number'],
  ['decision.maxErrorRate', 'number'],
  ['guardrails.criticalClasses', 'object'],
  ['guardrails.maxParseFailureRate', 'number'],
];

const get = (o: unknown, path: string) =>
  path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);

const vendor = (model: string) => model.split('/')[0];

/** Runtime checks for what the TS type cannot catch. Throws listing every problem. */
export function assertManifest(m: unknown): asserts m is Manifest {
  const errs = REQUIRED.filter(([p, t]) => typeof get(m, p) !== t || get(m, p) === null).map(
    ([p, t]) => `missing or invalid field \`${p}\` (expected ${t})`,
  );
  if (errs.length) throw new Error(`invalid manifest:\n- ${errs.join('\n- ')}`);
  const x = m as Manifest;

  if (!/^[0-9a-f]{64}$/.test(x.dataset.sha256)) errs.push('`dataset.sha256` must be 64 lowercase hex chars');
  if (!Number.isInteger(x.k) || x.k < 1) errs.push('`k` must be an integer >= 1');
  if (x.temperature !== undefined && typeof x.temperature !== 'number') errs.push('`temperature` must be a number or omitted');
  if (x.decision.margin > 0) errs.push('`decision.margin` must be <= 0 (the worst tolerated accuracy drop)');
  for (const a of [x.incumbent, x.candidate]) {
    if (!x.prices[a.model]) errs.push(`no pinned price for model \`${a.model}\``);
    if (a.providers.length !== 1) errs.push(`arm \`${a.model}\` must pin exactly one provider (served-by is then guaranteed)`);
    if (vendor(a.model) === vendor(x.dataset.draftedBy))
      errs.push(
        `arm \`${a.model}\` is from the same model family as the dataset's drafting model \`${x.dataset.draftedBy}\`: ` +
          'a model classifies text written in its own style unusually well (self-preference bias), which biases the comparison',
      );
  }
  for (const c of Object.keys(x.guardrails.criticalClasses))
    if (!x.labels.includes(c)) errs.push(`critical class \`${c}\` is not in \`labels\``);
  if (errs.length) throw new Error(`invalid manifest:\n- ${errs.join('\n- ')}`);
}

export async function loadManifest(path: string): Promise<Manifest> {
  const m = (await import(pathToFileURL(resolve(path)).href)).default;
  assertManifest(m);
  return m;
}
