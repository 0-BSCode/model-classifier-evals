export type ArmName = 'incumbent' | 'candidate';
export const ARMS: readonly ArmName[] = ['incumbent', 'candidate'];

export type Arm = { model: string; providers: string[] };

export type Manifest = {
  name: string;
  /** draftedBy: OpenRouter id of the model that drafted the items; its vendor may not be an arm's vendor */
  dataset: { path: string; sha256: string; draftedBy: string };
  /** path to the prompt template; `{{text}}` is replaced by the item text */
  prompt: string;
  labels: string[];
  k: number;
  seed: number;
  temperature: number;
  bootstrap?: number;
  concurrency?: number;
  incumbent: Arm;
  candidate: Arm;
  /** USD per million tokens, pinned at pre-registration, keyed by model id */
  prices: Record<string, { inPerMTok: number; outPerMTok: number }>;
  decision: { margin: number; costGain: number; latencyGain: number; maxErrorRate: number };
  /** criticalClasses: class -> max tolerated recall drop (candidate vs incumbent) */
  guardrails: { criticalClasses: Record<string, number>; maxParseFailureRate: number };
  referenceRun?: string;
};

export type Item = { id: string; text: string; label: string; notes?: string };

export type CallRecord = {
  item_id: string;
  arm: ArmName;
  repeat: number;
  request_hash: string;
  status: 'ok' | 'parse_failure' | 'error';
  label: string | null;
  raw: string | null;
  error: string | null;
  served_by: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number;
  ts: string;
};

/** What a run directory's manifest.json holds: the manifest plus the hash of the prompt file it used. */
export type ResolvedManifest = Manifest & { promptSha256: string };
