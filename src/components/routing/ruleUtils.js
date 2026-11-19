// src/components/routing/ruleUtils.js
//
// Helpers for routing rules (ROUTING_RULES.md): the short condition summary
// in the list, problems by field, which roles can take cases, and turning the
// editor's form into the request body.
import { isListOperator, isValuelessOperator } from '../reportTypeBuilder/model';

export const FLAG_PATTERN = /^[A-Za-z0-9_-]+$/;
export const TIERS = ['standard', 'confidential', 'restricted'];

// A role can take cases when it can open them.
const CASE_PERMS = ['report:read_all', 'report:read_subordinates', 'report:read_assigned'];

/** Roles that can open cases; a role whose permissions we can't see is kept. */
export const caseRoles = (roles = []) =>
  roles.filter((r) => r.code !== 'reporter' && (!Array.isArray(r.permissions) || r.permissions.some((p) => CASE_PERMS.includes(p))));

/** The problems for one editor field: exact field or anything under it. */
export const problemsFor = (problems = [], prefix) =>
  problems.filter((p) => p?.field && (p.field === prefix || p.field.startsWith(`${prefix}.`) || p.field.startsWith(`${prefix}[`)));

export const errorsOf = (problems = []) => problems.filter((p) => p.severity === 'error');
export const warningsOf = (problems = []) => problems.filter((p) => p.severity !== 'error');

/** Which report types the type conditions select (all types when none are set). */
export const matchingTypes = (types = [], match = {}) => {
  const prefixes = (match.code_prefixes || []).map((p) => p.toUpperCase());
  const categories = (match.categories || []).map((c) => c.toLowerCase());
  const codes = match.report_type_codes || [];
  if (!prefixes.length && !categories.length && !codes.length) return types;
  return types.filter((type) => {
    const code = (type.code || '').toUpperCase();
    if (prefixes.length && !prefixes.some((p) => code.startsWith(p))) return false;
    if (categories.length && !categories.includes((type.category || '').toLowerCase())) return false;
    if (codes.length && !codes.includes(type.code)) return false;
    return true;
  });
};

/** Every question of these types, once per question name, in form order. */
export const questionsOf = (types = []) => {
  const seen = new Map();
  types.forEach((type) =>
    (type.sections || []).forEach((section) =>
      (section.questions || []).forEach((q) => {
        if (q?.name && !seen.has(q.name) && q.type !== 'file') seen.set(q.name, { ...q, id: q.name });
      }),
    ),
  );
  return [...seen.values()];
};

/** Prefix suggestions from the type codes: "FRD-CLM-01" → "FRD-CLM", "FRD". */
export const prefixSuggestions = (types = []) => {
  const out = new Set();
  types.forEach((type) => {
    const parts = (type.code || '').toUpperCase().split('-').filter(Boolean);
    for (let i = 1; i < parts.length; i += 1) out.add(parts.slice(0, i).join('-'));
  });
  return [...out].sort();
};

export const emptyForm = () => ({
  name: '',
  description: '',
  priority: '100',
  active: true,
  match: { code_prefixes: [], categories: [], report_type_codes: [], entity_codes: [], answers: null },
  actions: { owner_role: '', backup_role: '', add_flags: [], raise_tier: '' },
});

export const formFromRule = (rule) => ({
  name: rule.name || '',
  description: rule.description || '',
  priority: String(rule.priority ?? 100),
  active: rule.active !== false,
  match: {
    code_prefixes: rule.match?.code_prefixes || [],
    categories: rule.match?.categories || [],
    report_type_codes: rule.match?.report_type_codes || [],
    entity_codes: rule.match?.entity_codes || [],
    answers: rule.match?.answers?.rules?.length ? rule.match.answers : null,
  },
  actions: {
    owner_role: rule.actions?.owner_role || '',
    backup_role: rule.actions?.backup_role || '',
    add_flags: rule.actions?.add_flags || [],
    raise_tier: rule.actions?.raise_tier || '',
  },
});

/** Answer conditions in the stored shape; numbers as numbers. */
const cleanAnswers = (answers, questions) => {
  const rules = (answers?.rules || []).filter((r) => r.when_question);
  if (!rules.length) return null;
  const byName = new Map(questions.map((q) => [q.name, q]));
  return {
    logic_type: answers.logic_type === 'or' ? 'or' : 'and',
    rules: rules.map((r) => {
      const out = { when_question: r.when_question, operator: r.operator };
      if (isValuelessOperator(r.operator)) return out;
      if (isListOperator(r.operator)) return { ...out, values: r.values || [] };
      const type = byName.get(r.when_question)?.type;
      const numeric = ['number', 'currency'].includes(type) && r.value !== '' && r.value !== null && !Number.isNaN(Number(r.value));
      return { ...out, value: numeric ? Number(r.value) : r.value };
    }),
  };
};

export const bodyFromForm = (form, questions = []) => ({
  name: form.name.trim(),
  description: form.description.trim() || null,
  priority: Number.parseInt(form.priority, 10),
  active: form.active,
  match: {
    code_prefixes: form.match.code_prefixes,
    categories: form.match.categories,
    report_type_codes: form.match.report_type_codes,
    entity_codes: form.match.entity_codes,
    answers: cleanAnswers(form.match.answers, questions),
  },
  actions: {
    owner_role: form.actions.owner_role || null,
    backup_role: form.actions.backup_role || null,
    add_flags: form.actions.add_flags,
    raise_tier: form.actions.raise_tier || null,
  },
});

export const hasCondition = (match) =>
  ['code_prefixes', 'categories', 'report_type_codes', 'entity_codes'].some((k) => match[k]?.length) || Boolean(match.answers?.rules?.length);

export const hasAction = (actions) =>
  Boolean(actions.owner_role || actions.backup_role || actions.add_flags?.length || actions.raise_tier);

/**
 * Only the top-level fields that changed (match and actions go whole).
 * `baseline` is the stored rule put through the same form → body path, so
 * key order and empty values compare equal.
 */
export const changedFields = (body, baseline) => {
  const out = {};
  Object.keys(body).forEach((key) => {
    if (JSON.stringify(body[key]) !== JSON.stringify(baseline[key])) out[key] = body[key];
  });
  return out;
};
