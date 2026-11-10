import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Question } from './types.ts';

/** Every piece of the decisions question must appear word for word in the chat prompt, so the two arms get the same wording. */
export function driftFrom(chatPrompt: string, q: Question): string[] {
  return [
    ...q.instructions.split('\n\n').filter((p) => !chatPrompt.includes(p)),
    ...Object.entries(q.criteria)
      .map(([label, desc]) => `- ${label}: ${desc}`)
      .filter((line) => !chatPrompt.includes(line)),
  ];
}

const chat = readFileSync('prompts/triage-v1.md', 'utf8');
const question: Question = JSON.parse(readFileSync('prompts/triage-v1.decisions.json', 'utf8'));

test('triage-v1.decisions.json uses the chat prompt wording exactly', () => {
  assert.deepEqual(driftFrom(chat, question), []);
});

test('a one-word change is caught', () => {
  const edited = { ...question, criteria: { ...question.criteria, rfi: question.criteria.rfi.replace('question', 'query') } };
  assert.deepEqual(driftFrom(chat, edited), [`- rfi: ${edited.criteria.rfi}`]);
  const edited2 = { ...question, instructions: question.instructions.replace('severe', 'serious') };
  assert.equal(driftFrom(chat, edited2).length, 1);
});
