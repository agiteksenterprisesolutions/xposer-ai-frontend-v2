// src/utils/workflows.js
//
// Helpers for the workflow builder. The server's /validate is the authority
// on whether a workflow can run; the local checks here only give instant
// feedback on things visible without it (a blank or duplicate key).
import { CODE_PATTERN } from './codes';

// Reserved `goto` targets.
export const NEXT = 'next';
export const END = 'end';

export const EXECUTOR_AGENT = 'agent';
export const EXECUTOR_HUMAN = 'human';

/** Stored stages may omit `optional`, `name` or `transitions`. */
export const normalizeStage = (stage = {}) => ({
  key: stage.key || '',
  name: stage.name || '',
  executor_type: stage.executor_type || EXECUTOR_AGENT,
  executor_ref: stage.executor_ref || '',
  transitions: (stage.transitions || []).map((t) => ({ when_decision: t.when_decision || '', goto: t.goto || NEXT })),
  optional: stage.optional ?? false,
});

/** The stage list as the API takes it: no blank rows, no blank names. */
export const toApiStages = (stages) =>
  stages.map((stage) => ({
    key: stage.key.trim(),
    name: stage.name.trim() || null,
    executor_type: stage.executor_type,
    executor_ref: stage.executor_ref,
    transitions: stage.transitions
      .filter((t) => t.when_decision)
      .map((t) => ({ when_decision: t.when_decision, goto: t.goto || NEXT })),
    optional: Boolean(stage.optional),
  }));

/** Rewrite every `goto` pointing at `oldKey` so a renamed stage keeps its inbound branches. */
export const renameKeyReferences = (stages, oldKey, newKey) =>
  !oldKey || oldKey === newKey
    ? stages
    : stages.map((stage) => ({
        ...stage,
        transitions: stage.transitions.map((t) => (t.goto === oldKey ? { ...t, goto: newKey } : t)),
      }));

/** Problems the builder can see without asking the server: [{ stage, code, message }]. */
export const localProblems = (stages) => {
  const problems = [];
  const seen = new Map();
  stages.forEach((stage) => {
    const key = stage.key.trim();
    if (!key) {
      problems.push({ stage: null, code: 'missing_key', message: 'Every stage needs a key.' });
    } else if (!CODE_PATTERN.test(key)) {
      problems.push({ stage: key, code: 'bad_key', message: 'Keys use lowercase letters, numbers and underscores, starting with a letter.' });
    } else if ([NEXT, END].includes(key)) {
      problems.push({ stage: key, code: 'reserved_key', message: `"${key}" is reserved for branching.` });
    }
    if (key) seen.set(key, (seen.get(key) || 0) + 1);
    if (!stage.executor_ref) {
      problems.push({
        stage: key || null,
        code: 'missing_executor',
        message: `Choose ${stage.executor_type === EXECUTOR_HUMAN ? 'a role' : 'an agent'} to run this stage.`,
      });
    }
  });
  seen.forEach((count, key) => {
    if (count > 1) problems.push({ stage: key, code: 'duplicate_key', message: `Two stages use the key "${key}".` });
  });
  return problems;
};

/** Where a `goto` leads, in words. */
export const gotoLabel = (goto, stagesByKey) => {
  if (goto === NEXT) return 'the next stage';
  if (goto === END) return 'end the run';
  const stage = stagesByKey.get(goto);
  return stage ? stage.name || stage.key : `"${goto}" (missing)`;
};
