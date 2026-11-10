import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { compareRuns, type RunData } from './compare.ts';
import { loadItems, sha256File, validateDataset } from './dataset.ts';
import { loadManifest } from './manifest.ts';
import { estimate, execute, pastRecords, prepare, readRecords } from './run.ts';
import type { ResolvedManifest } from './types.ts';
import { buildReport, renderVerdict } from './verdict.ts';

const USAGE = `usage:
  pnpm eval run <experiment.ts> [--yes] [--resume <runDir>]   verify, estimate, run, score, compare to referenceRun
  pnpm eval score <runDir>                                    offline re-score (no API key needed)
  pnpm eval compare <referenceRunDir> <runDir>                replication report
  pnpm eval validate-data <data.jsonl>`;

/** Offline: score a run directory from its own manifest.json + the hash-checked dataset. Writes verdict.md. */
function score(runDir: string): RunData {
  const manifest: ResolvedManifest = JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8'));
  const actual = sha256File(manifest.dataset.path);
  if (actual !== manifest.dataset.sha256) throw new Error(`dataset ${manifest.dataset.path} does not match the run's hash ${manifest.dataset.sha256}`);
  const gold = new Map(loadItems(manifest.dataset.path).map((it) => [it.id, it.label]));
  const records = readRecords(runDir);
  const report = buildReport(records, gold, manifest);
  writeFileSync(join(runDir, 'verdict.md'), renderVerdict(report));
  return { id: basename(runDir), manifest, records, report };
}

async function confirm(q: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const a = await rl.question(q);
  rl.close();
  return /^y(es)?$/i.test(a.trim());
}

async function main([cmd, ...args]: string[]): Promise<number> {
  switch (cmd) {
    case 'run': {
      const m = await loadManifest(args[0]);
      const p = prepare(m);
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set (only needed for live runs; `score` works offline)');
      const est = estimate(p, pastRecords());
      console.log(`${m.name}: ${est.calls} calls, estimated cost ~$${est.usd.toFixed(2)} at the manifest's pinned prices`);
      for (const a of est.arms) console.log(`  ${a.arm} ${a.model}: ~$${a.usd.toFixed(2)} (tokens per call: ${a.basis})`);
      if (!args.includes('--yes') && !(await confirm('Proceed? [y/N] '))) return 0;

      const ri = args.indexOf('--resume');
      const runDir = ri >= 0 ? args[ri + 1] : join('runs', m.name, new Date().toISOString().replace(/[:.]/g, '-'));
      await execute({
        prepared: p,
        runDir,
        apiKey,
        onProgress: (d, t) => process.stderr.write(`\r${d}/${t} calls`),
      });
      process.stderr.write('\n');
      const run = score(runDir);
      console.log(`\n${readFileSync(join(runDir, 'verdict.md'), 'utf8')}\nwritten to ${runDir}/verdict.md`);
      if (m.referenceRun && resolve(m.referenceRun) !== resolve(runDir)) {
        const out = compareRuns(score(m.referenceRun), run);
        writeFileSync(join(runDir, 'replication.md'), out);
        console.log(`\n${out}`);
      }
      return 0;
    }
    case 'score': {
      score(args[0]);
      process.stdout.write(readFileSync(join(args[0], 'verdict.md'), 'utf8'));
      return 0;
    }
    case 'compare': {
      console.log(compareRuns(score(args[0]), score(args[1])));
      return 0;
    }
    case 'validate-data': {
      const { errors, counts } = validateDataset(loadItems(args[0]));
      console.log(Object.entries(counts).map(([l, n]) => `${l}: ${n}`).join('\n'));
      if (errors.length) {
        console.error(`\n${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
        return 1;
      }
      console.log('\ndataset OK');
      return 0;
    }
    default:
      console.error(USAGE);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
