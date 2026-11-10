import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Item } from './types.ts';

export const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export const sha256File = (path: string) => sha256(readFileSync(path));

export function parseItems(jsonl: string): Item[] {
  return jsonl
    .split('\n')
    .map((l, i) => [l, i + 1] as const)
    .filter(([l]) => l.trim())
    .map(([l, n]) => {
      try {
        return JSON.parse(l) as Item;
      } catch {
        throw new Error(`line ${n}: invalid JSON`);
      }
    });
}

export const loadItems = (path: string) => parseItems(readFileSync(path, 'utf8'));

/** Rules for the demo correspondence dataset (spec: correspondence-dataset). */
export const DEMO_RULES = {
  labels: ['general_correspondence', 'rfi', 'variation_request', 'early_warning', 'notice_of_delay_or_claim'],
  minItems: 250,
  maxItems: 400,
  critical: 'notice_of_delay_or_claim',
  minCritical: 50,
  minOther: 30,
};

export function validateDataset(items: Item[], rules = DEMO_RULES): { errors: string[]; counts: Record<string, number> } {
  const errors: string[] = [];
  const seen = new Set<string>();
  const counts = Object.fromEntries(rules.labels.map((l) => [l, 0]));
  items.forEach((it, i) => {
    const where = `item ${typeof it.id === 'string' && it.id ? it.id : `#${i + 1}`}`;
    if (typeof it.id !== 'string' || !it.id) errors.push(`${where}: missing id`);
    else if (seen.has(it.id)) errors.push(`${where}: duplicate id`);
    seen.add(it.id);
    if (typeof it.text !== 'string' || !it.text.trim()) errors.push(`${where}: empty text`);
    if (!rules.labels.includes(it.label)) errors.push(`${where}: unknown label "${it.label}"`);
    else counts[it.label]++;
  });
  if (items.length < rules.minItems || items.length > rules.maxItems)
    errors.push(`dataset has ${items.length} items; expected ${rules.minItems}-${rules.maxItems}`);
  for (const l of rules.labels) {
    const min = l === rules.critical ? rules.minCritical : rules.minOther;
    if (counts[l] < min) errors.push(`class ${l} has ${counts[l]} items; needs >= ${min}`);
  }
  return { errors, counts };
}
