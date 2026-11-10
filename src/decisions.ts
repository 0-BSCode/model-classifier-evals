import { call, type CallOpts } from './openrouter.ts';
import type { CallRecord, Question } from './types.ts';

// OpenRouter's Decisions endpoint: returns a choice plus a probability per option instead of generated text.
const URL = 'https://openrouter.ai/api/alpha/decisions';

export type DecideOpts = CallOpts & { question: Question };

export function decisionsBody(o: Pick<DecideOpts, 'spec' | 'item' | 'question'>) {
  return {
    model: o.spec.model,
    state: [o.item.text],
    questions: { label: { type: 'choice', instructions: o.question.instructions, criteria: o.question.criteria } },
    // fallbacks off, as for chat arms; no require_parameters: there are no optional parameters to require
    provider: { order: o.spec.providers, allow_fallbacks: false },
  };
}

/** One Decisions call, recorded like a chat call. `raw` keeps the whole answer, including every label's probability. */
export function decide(o: DecideOpts): Promise<CallRecord> {
  return call(o, URL, decisionsBody(o), (json) => {
    const answer = json.answers?.label;
    if (!answer || typeof answer !== 'object') return null;
    return {
      raw: JSON.stringify(answer),
      label: answer.choice,
      served_by: json.provider ?? null,
      model: json.model ?? null, // the dated snapshot, e.g. openai/gpt-6-luna-decisions-20261006
      prompt_tokens: json.usage?.input_tokens ?? null,
      completion_tokens: json.usage?.output_tokens ?? null,
      cost_usd: json.usage?.cost ?? null,
    };
  });
}
