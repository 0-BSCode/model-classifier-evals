import exp from './luna-decisions-vs-jev.ts';

// Plumbing check before the reference run (served-by, snapshot, cost, parse status). Not a pre-registered experiment:
// its accuracy numbers must not be used to change the experiment. referenceRun cleared: k=1 is not comparable with k=3.
export default { ...exp, name: 'luna-decisions-vs-jev-pilot', k: 1, referenceRun: undefined };
