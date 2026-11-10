import { ARMS, type ArmName, type CallRecord, type Manifest } from './types.ts';
import { costPerCall, itemScores, medianLatency, pairedBootstrap, rates, recall, stability, type Delta } from './stats.ts';

export type Verdict = 'GO' | 'NO-GO' | 'INCONCLUSIVE';

type ArmStats = {
  model: string;
  servedBy: string[];
  calls: number;
  errorRate: number;
  parseFailureRate: number;
  stability: number;
  costPerCall: number;
  medianLatencyMs: number;
  recall: Record<string, number>;
};

export type Report = {
  name: string;
  datasetSha256: string;
  k: number;
  delta: Delta;
  arms: Record<ArmName, ArmStats>;
  guardrails: { name: string; pass: boolean; detail: string }[];
  verdict: Verdict;
  rule: string;
};

export function buildReport(records: CallRecord[], gold: Map<string, string>, m: Manifest): Report {
  const arms = Object.fromEntries(
    ARMS.map((a) => {
      const r = rates(records, a);
      const model = m[a].model;
      const served = new Set(records.filter((x) => x.arm === a && x.status !== 'error').map((x) => x.served_by ?? 'unreported'));
      return [
        a,
        {
          model,
          servedBy: [...served].sort(),
          ...r,
          stability: stability(records, a),
          costPerCall: costPerCall(records, a, m.prices[model]),
          medianLatencyMs: medianLatency(records, a),
          recall: Object.fromEntries(m.labels.map((c) => [c, recall(records, gold, a, c)])),
        },
      ];
    }),
  ) as Record<ArmName, ArmStats>;

  const delta = pairedBootstrap(
    itemScores(records, gold, 'incumbent'),
    itemScores(records, gold, 'candidate'),
    m.bootstrap ?? 10_000,
    m.seed,
  );

  const guardrails = [
    ...Object.entries(m.guardrails.criticalClasses).map(([cls, tol]) => {
      const i = arms.incumbent.recall[cls];
      const c = arms.candidate.recall[cls];
      return {
        name: `recall(${cls}) no regression > ${pct(tol)}`,
        pass: c >= i - tol, // NaN (no items) fails
        detail: `incumbent ${pct(i)}, candidate ${pct(c)}`,
      };
    }),
    ...ARMS.map((a) => ({
      name: `${a} parse failures <= ${pct(m.guardrails.maxParseFailureRate)}`,
      pass: arms[a].parseFailureRate <= m.guardrails.maxParseFailureRate,
      detail: pct(arms[a].parseFailureRate),
    })),
  ];

  const { verdict, rule } = decide(delta, arms, guardrails, m.decision);
  return { name: m.name, datasetSha256: m.dataset.sha256, k: m.k, delta, arms, guardrails, verdict, rule };
}

export function decide(
  d: Delta,
  arms: Record<ArmName, Pick<ArmStats, 'errorRate' | 'costPerCall' | 'medianLatencyMs'>>,
  guardrails: { pass: boolean }[],
  dec: Manifest['decision'],
): { verdict: Verdict; rule: string } {
  const worstErr = Math.max(arms.incumbent.errorRate, arms.candidate.errorRate);
  if (worstErr > dec.maxErrorRate)
    return { verdict: 'INCONCLUSIVE', rule: `0 (errors): API error rate ${pct(worstErr)} exceeds ${pct(dec.maxErrorRate)}` };
  // A failed guardrail is decisive on its own: missing more critical items is a NO-GO however uncertain accuracy is.
  if (guardrails.some((g) => !g.pass)) return { verdict: 'NO-GO', rule: '1 (guardrail): a guardrail failed' };
  if (d.hi < dec.margin) return { verdict: 'NO-GO', rule: `2 (accuracy): delta CI entirely below margin ${fmt(dec.margin)}` };
  if (d.lo < dec.margin)
    return { verdict: 'INCONCLUSIVE', rule: `3 (accuracy): delta CI includes margin ${fmt(dec.margin)}; more items needed` };
  if (d.lo > 0) return { verdict: 'GO', rule: '4 (accuracy): candidate strictly better' };
  const { incumbent: i, candidate: c } = arms;
  if (c.costPerCall <= i.costPerCall * (1 - dec.costGain))
    return { verdict: 'GO', rule: `5 (cost): non-inferior and >= ${pct(dec.costGain)} cheaper` };
  if (c.medianLatencyMs <= i.medianLatencyMs * (1 - dec.latencyGain))
    return { verdict: 'GO', rule: `6 (latency): non-inferior and >= ${pct(dec.latencyGain)} faster` };
  return { verdict: 'NO-GO', rule: '7 (no benefit): non-inferior but neither cheaper nor faster enough to switch' };
}

const fmt = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a');

export function renderVerdict(r: Report): string {
  const { incumbent: i, candidate: c } = r.arms;
  const row = (label: string, f: (a: ArmStats) => string) => `| ${label} | ${f(i)} | ${f(c)} |`;
  return [
    `# Verdict: ${r.verdict}, decided by rule ${r.rule}`,
    '',
    `Experiment \`${r.name}\`, dataset sha256 \`${r.datasetSha256}\`, k=${r.k}.`,
    '',
    '## Accuracy (candidate - incumbent, paired bootstrap 95% CI over items)',
    '',
    `delta ${fmt(r.delta.delta)}  CI [${fmt(r.delta.lo)}, ${fmt(r.delta.hi)}]  (n=${r.delta.n} items; incumbent ${fmt(r.delta.incumbent)}, candidate ${fmt(r.delta.candidate)})`,
    '',
    '## Guardrails',
    '',
    ...r.guardrails.map((g) => `- [${g.pass ? 'x' : ' '}] ${g.name}: ${g.detail}`),
    '',
    '## Arms',
    '',
    '| | incumbent | candidate |',
    '|---|---|---|',
    row('model', (a) => `\`${a.model}\``),
    row('served by', (a) => a.servedBy.join(', ')),
    row('calls', (a) => String(a.calls)),
    row('API error rate', (a) => pct(a.errorRate)),
    row('parse failure rate', (a) => pct(a.parseFailureRate)),
    row('stability (all k repeats agree)', (a) => pct(a.stability)),
    row('cost per call (pinned prices, USD)', (a) => fmt(a.costPerCall, 6)),
    row('median latency (ms, same run)', (a) => fmt(a.medianLatencyMs, 0)),
    ...Object.keys(i.recall).map((cls) => row(`recall ${cls}`, (a) => pct(a.recall[cls]))),
    '',
    'Guardrails compare point estimates. With small classes this deliberately leans toward NO-GO.',
    '',
  ].join('\n');
}
