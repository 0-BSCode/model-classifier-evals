import { ARMS, type CallRecord, type ResolvedManifest } from './types.ts';
import { majorityLabels } from './stats.ts';
import type { Report } from './verdict.ts';

export type RunData = { id: string; manifest: ResolvedManifest; records: CallRecord[]; report: Report };

/** The pre-registered parts of a manifest. Two runs are comparable only if these are identical. */
const comparableKey = (m: ResolvedManifest) =>
  JSON.stringify({
    dataset: m.dataset.sha256,
    prompt: m.promptSha256,
    labels: m.labels,
    k: m.k,
    temperature: m.temperature,
    incumbent: m.incumbent,
    candidate: m.candidate,
    prices: m.prices,
    decision: m.decision,
    guardrails: m.guardrails,
  });

export class NotComparable extends Error {}

export function compareRuns(ref: RunData, run: RunData): string {
  const ka = JSON.parse(comparableKey(ref.manifest));
  const kb = JSON.parse(comparableKey(run.manifest));
  const diffs = Object.keys(ka).filter((k) => JSON.stringify(ka[k]) !== JSON.stringify(kb[k]));
  if (diffs.length)
    throw new NotComparable(
      `runs are not comparable: pre-registered fields differ (${diffs.join(', ')}). A changed manifest is a new experiment, not a replication.`,
    );

  const replicated = ref.report.verdict === run.report.verdict;
  const agreement = ARMS.map((a) => {
    const x = majorityLabels(ref.records, a);
    const y = majorityLabels(run.records, a);
    const ids = [...x.keys()].filter((id) => y.has(id));
    const same = ids.filter((id) => x.get(id) === y.get(id)).length;
    return `- ${a}: ${ids.length ? ((100 * same) / ids.length).toFixed(1) : 'n/a'}% of ${ids.length} items have the same majority label`;
  });
  const line = (r: RunData) =>
    `| ${r.id} | ${r.report.verdict} | ${r.report.delta.delta.toFixed(3)} [${r.report.delta.lo.toFixed(3)}, ${r.report.delta.hi.toFixed(3)}] | ${r.report.rule} |`;

  return [
    `# ${replicated ? 'VERDICT REPLICATED' : 'VERDICT NOT REPLICATED'}`,
    '',
    '| run | verdict | accuracy delta [95% CI] | deciding rule |',
    '|---|---|---|---|',
    line(ref),
    line(run),
    '',
    'Label agreement between runs:',
    ...agreement,
    '',
  ].join('\n');
}
