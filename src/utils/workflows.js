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
      problems.push({ stage: null, code: 'missing_key', message: 'Every step needs a key.' });
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
        message: `Choose ${stage.executor_type === EXECUTOR_HUMAN ? 'a role' : 'an agent'} to run this step.`,
      });
    }
  });
  seen.forEach((count, key) => {
    if (count > 1) problems.push({ stage: key, code: 'duplicate_key', message: `Two steps use the key "${key}".` });
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

// ─── Canvas helpers ──────────────────────────────────────────────────────

/** A key no other stage uses: "review", then "review_2", "review_3"… */
export const uniqueKey = (base, stages, ignoreId) => {
  const root = base || 'step';
  const taken = new Set(stages.filter((s) => s._id !== ignoreId).map((s) => s.key));
  taken.add(NEXT).add(END);
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}_${n}`)) n += 1;
  return `${root}_${n}`;
};

/**
 * The outcomes a stage can branch on — one connection point each.
 *
 * An agent offers the decisions it declares, whether or not a rule exists for
 * them yet; a rule on a decision it does not declare is kept and flagged. A
 * person's outcomes are whatever rules have been written for the stage.
 * `goto` is null when nothing is written down, i.e. it continues to the next
 * stage.
 */
export const stagePorts = (stage, agent) => {
  if (stage.executor_type === EXECUTOR_HUMAN) {
    return stage.transitions.map((t, index) => ({
      id: `t:${index}`,
      index,
      decision: t.when_decision,
      goto: t.goto,
      declared: true,
    }));
  }
  const declared = agent?.decisions || [];
  const ports = declared.map((decision) => {
    const index = stage.transitions.findIndex((t) => t.when_decision === decision);
    return { id: `d:${decision}`, index, decision, goto: index >= 0 ? stage.transitions[index].goto : null, declared: true };
  });
  stage.transitions.forEach((t, index) => {
    if (!declared.includes(t.when_decision)) {
      ports.push({ id: `d:${t.when_decision}`, index, decision: t.when_decision, goto: t.goto, declared: false });
    }
  });
  return ports;
};

/** Point `decision` at `goto`, or drop its rule when `goto` is empty. */
export const setBranch = (stage, decision, goto) => {
  const exists = stage.transitions.some((t) => t.when_decision === decision);
  if (!goto) return { ...stage, transitions: stage.transitions.filter((t) => t.when_decision !== decision) };
  return {
    ...stage,
    transitions: exists
      ? stage.transitions.map((t) => (t.when_decision === decision ? { ...t, goto } : t))
      : [...stage.transitions, { when_decision: decision, goto }],
  };
};

/** Move the stage at `from` so it ends up at `to` in the final order. */
export const moveStage = (stages, from, to) => {
  if (from === to || from < 0 || from >= stages.length) return stages;
  const next = [...stages];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
};
