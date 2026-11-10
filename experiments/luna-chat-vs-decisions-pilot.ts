import exp from './luna-chat-vs-decisions.ts';

// Plumbing check before the reference run (served-by, snapshot, cost, parse status). Not a pre-registered experiment:
// its accuracy numbers must not be used to change the experiment.
// referenceRun cleared: a k=1 pilot is not comparable with the k=3 reference run.
export default { ...exp, name: 'luna-chat-vs-decisions-pilot', k: 1, referenceRun: undefined };
