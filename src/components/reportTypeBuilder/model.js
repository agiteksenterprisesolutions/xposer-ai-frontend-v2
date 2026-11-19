// src/components/reportTypeBuilder/model.js
//
// The report type builder's pure helpers: question types, the core fieldset a
// new type starts from, field-name generation, the reporter's time estimate
// and the checks that run before a type is saved. Nothing here touches React
// state, so each piece can be reasoned about (and reused) on its own.
import {
  Banknote,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Hash,
  List,
  ListChecks,
  Mail,
  Phone,
  Text,
  Type,
  Upload,
} from 'lucide-react';
import { normalizeOptions, normalizeValidation, reportTypeStatus } from '../../utils/reportTypes';
import i18n from '../../i18n';

// Builder text, translated when it's read (never at module load).
const tb = (key, options) => i18n.t(key, { ns: 'builder', ...options });

// A catalogue entry whose `label` is read in the current interface language.
const labelled = (entry, key) =>
  Object.defineProperty(entry, 'label', { get: () => tb(key), enumerable: true, configurable: true });

/** Every question type, in the order the type picker lists them. */
export const QUESTION_TYPES = [
  labelled({ value: 'text', icon: Type, seconds: 20 }, 'questionTypes.text'),
  labelled({ value: 'textarea', icon: Text, seconds: 60 }, 'questionTypes.textarea'),
  labelled({ value: 'select', icon: List, seconds: 10 }, 'questionTypes.select'),
  labelled({ value: 'multiselect', icon: ListChecks, seconds: 15 }, 'questionTypes.multiselect'),
  labelled({ value: 'boolean', icon: CheckCircle2, seconds: 5 }, 'questionTypes.boolean'),
  labelled({ value: 'date', icon: Calendar, seconds: 10 }, 'questionTypes.date'),
  labelled({ value: 'datetime', icon: CalendarClock, seconds: 15 }, 'questionTypes.datetime'),
  labelled({ value: 'time', icon: Clock, seconds: 10 }, 'questionTypes.time'),
  labelled({ value: 'number', icon: Hash, seconds: 10 }, 'questionTypes.number'),
  labelled({ value: 'currency', icon: Banknote, seconds: 15 }, 'questionTypes.currency'),
  labelled({ value: 'email', icon: Mail, seconds: 10 }, 'questionTypes.email'),
  labelled({ value: 'phone', icon: Phone, seconds: 10 }, 'questionTypes.phone'),
  labelled({ value: 'file', icon: Upload, seconds: 30 }, 'questionTypes.file'),
];

/** The types one click away under the form; the rest sit behind "More". */
export const QUICK_TYPES = ['text', 'textarea', 'select', 'boolean', 'date', 'file'];

export const typeInfo = (type) => QUESTION_TYPES.find((t) => t.value === type) || QUESTION_TYPES[0];

export const OPTION_TYPES = ['select', 'multiselect'];
export const hasOptions = (question) => OPTION_TYPES.includes(question?.type);

/** Condition operators, worded to read as part of a sentence. */
export const OPERATORS = [
  labelled({ value: 'equals' }, 'operators.equals'),
  labelled({ value: 'not_equals' }, 'operators.not_equals'),
  labelled({ value: 'in' }, 'operators.in'),
  labelled({ value: 'not_in' }, 'operators.not_in'),
  labelled({ value: 'contains' }, 'operators.contains'),
  labelled({ value: 'not_contains' }, 'operators.not_contains'),
  labelled({ value: 'starts_with' }, 'operators.starts_with'),
  labelled({ value: 'ends_with' }, 'operators.ends_with'),
  labelled({ value: 'greater_than' }, 'operators.greater_than'),
  labelled({ value: 'less_than' }, 'operators.less_than'),
  labelled({ value: 'is_not_empty' }, 'operators.is_not_empty'),
  labelled({ value: 'is_empty' }, 'operators.is_empty'),
];

export const isListOperator = (operator) => operator === 'in' || operator === 'not_in';
export const isValuelessOperator = (operator) => operator === 'is_empty' || operator === 'is_not_empty';

/** The operators that make sense for the question a rule looks at. */
export const operatorsFor = (question) => {
  const type = question?.type;
  if (type === 'boolean') return OPERATORS.filter((o) => ['equals', 'not_equals', 'is_not_empty', 'is_empty'].includes(o.value));
  if (OPTION_TYPES.includes(type))
    return OPERATORS.filter((o) => ['equals', 'not_equals', 'in', 'not_in', 'is_not_empty', 'is_empty'].includes(o.value));
  if (['number', 'currency'].includes(type))
    return OPERATORS.filter((o) => ['equals', 'not_equals', 'greater_than', 'less_than', 'is_not_empty', 'is_empty'].includes(o.value));
  return OPERATORS;
};

export const isCore = (question) => Boolean(question?.is_core_field);

let idCounter = 0;
const tempId = (prefix) => `${prefix}_${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/** `section_…` / `question_…` ids are client-only and never sent as ids. */
export const newSection = (overrides = {}) => ({
  id: tempId('section'),
  section_key: null,
  title: '',
  description: '',
  is_shared: false,
  conditional_logic: null,
  questions: [],
  ...overrides,
});

export const newQuestion = (type = 'text', overrides = {}) => ({
  id: tempId('question'),
  type,
  label: '',
  name: '',
  // A new question's field name follows its label until someone edits it.
  _autoName: true,
  required: false,
  is_core_field: false,
  sensitive_data_class: 'none',
  placeholder: '',
  help_text: '',
  default_value: '',
  options: OPTION_TYPES.includes(type)
    ? [
        { value: 'option_1', label: 'Option 1', display_order: 0 },
        { value: 'option_2', label: 'Option 2', display_order: 1 },
      ]
    : [],
  validation: {},
  conditional_logic: null,
  ...overrides,
});

/** A blank form: one empty step, ready for its first question. */
export const blankSections = () => [newSection()];

// ── Field names ─────────────────────────────────────────────────────────────

export const FIELD_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const fieldNameFrom = (label) => {
  const base = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 48)
    .replace(/_+$/, '');
  if (!base) return '';
  return /^[a-z_]/.test(base) ? base : `field_${base}`;
};

/**
 * `base`, or `base_2`, `base_3`… — whichever no other question uses and isn't
 * `reserved` (the standard questions' names, which belong to them).
 */
export const uniqueFieldName = (base, sections, exceptId, reserved = []) => {
  if (!base) return '';
  const taken = new Set([
    ...sections.flatMap((s) => s.questions).filter((q) => q.id !== exceptId).map((q) => q.name),
    ...reserved,
  ]);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}_${n}`)) n += 1;
  return `${base}_${n}`;
};

// ── Reading the form ────────────────────────────────────────────────────────

export const allQuestions = (sections) =>
  sections.flatMap((section, sectionIndex) =>
    section.questions.map((question, questionIndex) => ({ question, section, sectionIndex, questionIndex })),
  );

/** Questions that come before a point in the form — the ones a rule can look at. */
export const questionsBefore = (sections, sectionId, questionId = null) => {
  const result = [];
  for (const section of sections) {
    if (section.id === sectionId) {
      if (questionId) {
        for (const question of section.questions) {
          if (question.id === questionId) break;
          result.push(question);
        }
      }
      break;
    }
    result.push(...section.questions);
  }
  return result;
};

const hasRules = (logic) => Boolean(logic?.rules?.length);
export const isConditional = (item) => hasRules(item?.conditional_logic);

/**
 * Roughly how long a reporter spends on the form, in minutes. Questions shown
 * only under a condition count half, since many reporters never see them.
 */
export const estimateMinutes = (sections) => {
  const seconds = allQuestions(sections).reduce((total, { question, section }) => {
    const weight = isConditional(question) || isConditional(section) ? 0.5 : 1;
    return total + typeInfo(question.type).seconds * weight;
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
};

export const countQuestions = (sections) => sections.reduce((total, s) => total + s.questions.length, 0);

// ── Checks ──────────────────────────────────────────────────────────────────

const ruleProblem = (rule, earlier) => {
  if (!rule.when_question) return tb('issues.rule.noQuestion');
  if (!earlier.some((q) => q.name === rule.when_question)) return tb('issues.rule.laterQuestion');
  if (isValuelessOperator(rule.operator)) return null;
  if (isListOperator(rule.operator)) return rule.values?.length ? null : tb('issues.rule.noAnswers');
  return rule.value === '' || rule.value === null || rule.value === undefined ? tb('issues.rule.noAnswer') : null;
};

/** The retention-period message, in the current interface language. */
export const retentionMessage = () => tb('issues.retention');

/** The retention period is optional, but when set the server takes 1–100 whole years. */
export const retentionProblem = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const years = Number(value);
  return Number.isInteger(years) && years >= 1 && years <= 100 ? null : retentionMessage();
};

/**
 * Everything worth flagging before save. `error`s block saving; `warning`s are
 * suggestions. Each carries where to fix it: a question, a section, or a step.
 */
export const findIssues = (form, catalog = null) => {
  const issues = [];
  const sections = form.sections || [];
  // `blank` marks what is simply not filled in yet — not worth flagging on a
  // question someone has only just added, until they try to save. `about`
  // names the setting it concerns (wording, fieldName, options, condition,
  // title), so the inspector can show it under that field in any language.
  const push = (level, check, message, target, blank = false, about = null) =>
    issues.push({ level, check, message, target, blank, about });

  if (!form.name?.trim()) push('error', 'name', tb('issues.noName'), { field: 'name' });
  if (sections.length === 0) push('error', 'steps', tb('issues.noSteps'), { step: 'questions' });

  const seen = new Map();
  sections.forEach((section, sectionIndex) => {
    const sectionLabel = section.title?.trim() || tb('issues.stepN', { n: sectionIndex + 1 });
    const atSection = { sectionId: section.id };
    if (!section.title?.trim()) push('error', 'steps', tb('issues.stepNoTitle', { n: sectionIndex + 1 }), atSection, true, 'title');
    if (section.questions.length === 0) push('error', 'steps', tb('issues.stepNoQuestions', { step: sectionLabel }), atSection, true);

    const sectionRules = section.conditional_logic?.rules || [];
    const beforeSection = questionsBefore(sections, section.id);
    const sectionRuleProblem = sectionRules.map((rule) => ruleProblem(rule, beforeSection)).find(Boolean);
    if (sectionRuleProblem) push('error', 'conditions', tb('issues.inItem', { item: sectionLabel, problem: sectionRuleProblem }), atSection, false, 'condition');

    section.questions.forEach((question, questionIndex) => {
      const label = question.label?.trim() || tb('issues.questionNOf', { n: questionIndex + 1, step: sectionLabel });
      const at = { sectionId: section.id, questionId: question.id };
      if (!question.label?.trim()) push('error', 'questions', tb('issues.noWording', { question: label }), at, true, 'wording');
      if (!question.name?.trim()) push('error', 'questions', tb('issues.noFieldName', { question: label }), at, true, 'fieldName');
      else if (!FIELD_NAME_PATTERN.test(question.name))
        push('error', 'questions', tb('issues.badFieldName', { question: label }), at, false, 'fieldName');
      else if (seen.has(question.name)) push('error', 'questions', tb('issues.duplicateFieldName', { question: label, other: seen.get(question.name) }), at, false, 'fieldName');
      else if (question._custom && catalog?.byName.has(question.name))
        push(
          'error',
          'questions',
          tb('issues.standardFieldName', { question: label, standard: catalog.byName.get(question.name).label }),
          at,
          false,
          'fieldName',
        );
      else seen.set(question.name, label);

      if (hasOptions(question)) {
        const options = normalizeOptions(question.options).filter((o) => String(o.value).trim());
        if (options.length === 0) push('error', 'answers', tb('issues.noOptions', { question: label }), at, false, 'options');
      }
      const rules = question.conditional_logic?.rules || [];
      const earlier = questionsBefore(sections, section.id, question.id);
      const problem = rules.map((rule) => ruleProblem(rule, earlier)).find(Boolean);
      if (problem) push('error', 'conditions', tb('issues.inItem', { item: label, problem }), at, false, 'condition');
    });
  });

  // A live type must ask the core questions. Types with no compliance code
  // predate the taxonomy and are exempt, so for them it's a warning.
  if (reportTypeStatus(form) === 'active') {
    const present = new Set(sections.flatMap((s) => s.questions).filter((q) => !q._custom).map((q) => q.name));
    (catalog?.entries || [])
      .filter((entry) => entry.can_disable === false && !present.has(entry.name))
      .forEach((entry) => {
        if (form.code?.trim()) {
          push('error', 'core', tb('issues.coreMissing', { question: entry.label }), { standard: entry.name });
        } else {
          push('warning', 'core', [tb('issues.coreNotAsked', { question: entry.label }), entry.if_disabled].filter(Boolean).join(' '), { standard: entry.name });
        }
      });
  }

  if (retentionProblem(form.retention_years)) push('error', 'retention', retentionProblem(form.retention_years), { step: 'handling' });
  if (!form.default_owner_role)
    push('warning', 'owner', tb('issues.noOwner'), { step: 'handling' });

  return issues;
};

/** The form as the builder holds it, from a type loaded through toBuilderShape. */
export const fromLoaded = (data) => ({
  ...data,
  sections: (data.sections || []).map((section) => ({
    ...section,
    questions: (section.questions || []).map((question) => ({
      ...question,
      type: String(question.type || 'text').toLowerCase().replace(/_/g, '-').replace('date-time', 'datetime'),
      options: normalizeOptions(question.options),
      validation: normalizeValidation(question.validation),
      _autoName: false,
    })),
  })),
});

/** A copy of an existing type, ready to save as a new one. */
export const asCopy = (data, name) => {
  const loaded = fromLoaded(data);
  return {
    ...loaded,
    id: undefined,
    name,
    code: '',
    approved_by: null,
    approved_at: null,
    sections: loaded.sections.map((section) => ({
      ...section,
      id: tempId('section'),
      questions: section.questions.map((question) => ({ ...question, id: tempId('question') })),
    })),
  };
};

const answerLabel = (question, value) => {
  if (question?.type === 'boolean') return value === true || value === 'true' || value === 1 || value === '1' ? tb('logic.yes') : tb('logic.no');
  const option = normalizeOptions(question?.options).find((o) => o.value === value);
  return option?.label || String(value ?? '');
};

/** "“Was anyone hurt?” is Yes", for a step's or question's show-when logic. */
export const describeLogic = (logic, sections, { subject = 'question' } = {}) => {
  const rules = logic?.rules || [];
  if (!rules.length) return '';
  const byName = new Map(sections.flatMap((s) => s.questions).map((q) => [q.name, q]));
  const [rule] = rules;
  const question = byName.get(rule.when_question);
  const name = question?.label || rule.when_question || tb('logic.aQuestion');
  const operator = OPERATORS.find((o) => o.value === rule.operator)?.label || rule.operator;
  let answer = '';
  if (isListOperator(rule.operator)) answer = (rule.values || []).map((v) => answerLabel(question, v)).join(tb('logic.listSeparator'));
  else if (!isValuelessOperator(rule.operator)) answer = answerLabel(question, rule.value);
  const more =
    rules.length > 1
      ? tb(logic.logic_type === 'or' ? 'logic.orMore' : 'logic.andMore', { count: rules.length - 1 })
      : '';
  const skipped = rule.condition_type === 'skip' || rule.condition_type === 'hide';
  const key = subject === 'step' ? (skipped ? 'logic.stepSkippedWhen' : 'logic.stepShownWhen') : skipped ? 'logic.skippedWhen' : 'logic.shownWhen';
  return tb(key, {
    question: name,
    condition: answer ? `${operator} ${answer}` : operator,
    more,
  });
};

/**
 * A refused save, pinned to the field it is about, so the reason shows under
 * that field instead of in a toast:
 *   409 changing or clearing a compliance code     → code
 *   400 an owner role that is unknown or can't own cases → that owner field
 *   422 (PUT) / 400 (PATCH) retention outside 1–100  → retention_years
 * Returns {} when the error isn't about one of these fields.
 */
export const saveErrorFields = ({ status, summary, problems = [] }, form) => {
  const text = summary || '';
  const fields = {};
  problems.forEach((p) => {
    const field = String(p.field || '').split('.').pop();
    if (field === 'retention_years') fields.retention_years = retentionMessage();
    else if (['default_owner_role', 'alternate_owner_role', 'code'].includes(field)) fields[field] = p.message;
  });
  if (Object.keys(fields).length) return fields;

  if (/retention/i.test(text)) return { retention_years: retentionMessage() };
  if (status === 409 && /code/i.test(text)) return { code: text };
  if (status === 400 && /role/i.test(text)) {
    // The message names the role it refused; pin it to the field holding that role.
    const names = (role) => Boolean(role) && text.toLowerCase().includes(String(role).toLowerCase());
    const aboutBackup =
      /alternate|backup/i.test(text) || (names(form.alternate_owner_role) && !names(form.default_owner_role));
    return { [aboutBackup ? 'alternate_owner_role' : 'default_owner_role']: text };
  }
  return {};
};
