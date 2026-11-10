import type { ArmName, CallRecord } from './types.ts';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const scored = (records: CallRecord[], arm: ArmName) => records.filter((r) => r.arm === arm && r.status !== 'error');

/** item id -> fraction of the arm's non-error repeats that match gold (parse failures count as wrong) */
export function itemScores(records: CallRecord[], gold: Map<string, string>, arm: ArmName): Map<string, number> {
  const acc = new Map<string, number[]>();
  for (const r of scored(records, arm)) {
    const xs = acc.get(r.item_id) ?? [];
    xs.push(r.status === 'ok' && r.label === gold.get(r.item_id) ? 1 : 0);
    acc.set(r.item_id, xs);
  }
  return new Map([...acc].map(([id, xs]) => [id, mean(xs)]));
}

export type Delta = { incumbent: number; candidate: number; delta: number; lo: number; hi: number; n: number };

/** Paired percentile bootstrap of mean(candidate) - mean(incumbent), resampling items. Deterministic for a given seed. */
export function pairedBootstrap(inc: Map<string, number>, cand: Map<string, number>, B: number, seed: number): Delta {
  const ids = [...inc.keys()].filter((id) => cand.has(id)).sort();
  const a = ids.map((id) => inc.get(id)!);
  const b = ids.map((id) => cand.get(id)!);
  const n = ids.length;
  const rand = mulberry32(seed);
  const deltas = new Float64Array(B);
  for (let i = 0; i < B; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) {
      const k = Math.floor(rand() * n);
      s += b[k] - a[k];
    }
    deltas[i] = s / n;
  }
  deltas.sort();
  const q = (p: number) => deltas[Math.min(B - 1, Math.floor(p * B))];
  return { incumbent: mean(a), candidate: mean(b), delta: mean(b) - mean(a), lo: q(0.025), hi: q(0.975), n };
}

/** Recall for one class: share of non-error calls on gold==cls items that predicted cls (averages over repeats). */
export function recall(records: CallRecord[], gold: Map<string, string>, arm: ArmName, cls: string): number {
  const rs = scored(records, arm).filter((r) => gold.get(r.item_id) === cls);
  return mean(rs.map((r) => (r.status === 'ok' && r.label === cls ? 1 : 0)));
}

/** Share of items whose non-error repeats all gave the same label (a parse failure counts as its own label). */
export function stability(records: CallRecord[], arm: ArmName): number {
  const labels = new Map<string, Set<string>>();
  for (const r of scored(records, arm)) {
    const s = labels.get(r.item_id) ?? new Set();
    s.add(r.status === 'ok' ? r.label! : '<parse_failure>');
    labels.set(r.item_id, s);
  }
  return mean([...labels.values()].map((s) => (s.size === 1 ? 1 : 0)));
}

export function rates(records: CallRecord[], arm: ArmName) {
  const all = records.filter((r) => r.arm === arm);
  const ok = scored(records, arm);
  return {
    calls: all.length,
    errorRate: all.length ? (all.length - ok.length) / all.length : 0,
    parseFailureRate: ok.length ? ok.filter((r) => r.status === 'parse_failure').length / ok.length : 0,
  };
}

/** Mean USD per call from token counts x pinned price (immune to later price changes). */
export function costPerCall(records: CallRecord[], arm: ArmName, price: { inPerMTok: number; outPerMTok: number }): number {
  return mean(scored(records, arm).map((r) => ((r.prompt_tokens ?? 0) * price.inPerMTok + (r.completion_tokens ?? 0) * price.outPerMTok) / 1e6));
}

export const medianLatency = (records: CallRecord[], arm: ArmName) => median(scored(records, arm).map((r) => r.latency_ms));

/** Most frequent label per item (parse failure = '<parse_failure>'), ties broken alphabetically. */
export function majorityLabels(records: CallRecord[], arm: ArmName): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const r of scored(records, arm)) {
    const c = counts.get(r.item_id) ?? new Map();
    const l = r.status === 'ok' ? r.label! : '<parse_failure>';
    c.set(l, (c.get(l) ?? 0) + 1);
    counts.set(r.item_id, c);
  }
  return new Map(
    [...counts].map(([id, c]) => [id, [...c].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0][0]]),
  );
}
