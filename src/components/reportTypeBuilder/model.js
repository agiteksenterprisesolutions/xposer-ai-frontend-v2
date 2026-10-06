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
import { CORE_FIELDS, normalizeOptions, normalizeValidation } from '../../utils/reportTypes';

/** Every question type, in the order the type picker lists them. */
export const QUESTION_TYPES = [
  { value: 'text', label: 'Short answer', icon: Type, seconds: 20 },
  { value: 'textarea', label: 'Paragraph', icon: Text, seconds: 60 },
  { value: 'select', label: 'Dropdown', icon: List, seconds: 10 },
  { value: 'multiselect', label: 'Checkboxes', icon: ListChecks, seconds: 15 },
  { value: 'boolean', label: 'Yes / No', icon: CheckCircle2, seconds: 5 },
  { value: 'date', label: 'Date', icon: Calendar, seconds: 10 },
  { value: 'datetime', label: 'Date & time', icon: CalendarClock, seconds: 15 },
  { value: 'time', label: 'Time', icon: Clock, seconds: 10 },
  { value: 'number', label: 'Number', icon: Hash, seconds: 10 },
  { value: 'currency', label: 'Amount', icon: Banknote, seconds: 15 },
  { value: 'email', label: 'Email', icon: Mail, seconds: 10 },
  { value: 'phone', label: 'Phone', icon: Phone, seconds: 10 },
  { value: 'file', label: 'File upload', icon: Upload, seconds: 30 },
];

/** The types one click away under the form; the rest sit behind "More". */
export const QUICK_TYPES = ['text', 'textarea', 'select', 'boolean', 'date', 'file'];

export const typeInfo = (type) => QUESTION_TYPES.find((t) => t.value === type) || QUESTION_TYPES[0];

export const OPTION_TYPES = ['select', 'multiselect'];
export const hasOptions = (question) => OPTION_TYPES.includes(question?.type);

/** Condition operators, worded to read as part of a sentence. */
export const OPERATORS = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'is not' },
  { value: 'in', label: 'is any of' },
  { value: 'not_in', label: 'is none of' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: "doesn't contain" },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'greater_than', label: 'is more than' },
  { value: 'less_than', label: 'is less than' },
  { value: 'is_not_empty', label: 'is answered' },
  { value: 'is_empty', label: 'is not answered' },
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

// ── The core fieldset ─────────────────────────────────────────────────────────
// The ten questions every taxonomy-based report type carries, worded as the
// backend's import template words them. Their field names drive routing,
// analytics and the conflict-of-interest bypass, so they are locked.

const opts = (pairs) => pairs.map(([value, label], index) => ({ value, label, display_order: index }));

const CORE_QUESTIONS = {
  incident_title: { type: 'text', label: 'Give this report a short title', validation: { max_length: 200 } },
  incident_description: {
    type: 'textarea',
    label: 'Describe what happened, in as much detail as you can',
    validation: { min_length: 50 },
  },
  incident_date: { type: 'date', label: 'When did this happen?', validation: { max_date: 'today' } },
  entity: {
    type: 'select',
    label: 'Which entity does this concern?',
    options: opts([
      ['entity_a', 'Entity A'],
      ['entity_b', 'Entity B'],
      ['other', 'Other, or I am not sure'],
    ]),
  },
  previously_reported: { type: 'boolean', label: 'Have you reported this before?' },
  implicates_senior_person: {
    type: 'select',
    label: 'Does this involve someone senior to you?',
    options: opts([
      ['none', 'No one senior'],
      ['line_manager', 'My line manager'],
      ['function_head', 'A function head'],
      ['executive', 'An executive'],
      ['control_function', 'Someone in a control function'],
      ['unsure', 'I am not sure'],
    ]),
  },
  retaliation_concern: {
    type: 'select',
    label: 'Are you concerned about retaliation?',
    options: opts([
      ['yes', 'Yes'],
      ['no', 'No'],
      ['unsure', 'I am not sure'],
    ]),
  },
  reporter_relationship: {
    type: 'select',
    label: 'What is your relationship to this organization?',
    options: opts([
      ['employee', 'Employee'],
      ['contractor', 'Contractor'],
      ['member', 'Member'],
      ['provider', 'Provider'],
      ['other', 'Other'],
    ]),
  },
  anonymity_election: {
    type: 'select',
    label: 'How would you like to be identified?',
    options: opts([
      ['named', 'Named — handlers may contact me directly'],
      ['confidential', 'Confidential — intake team only'],
      ['anonymous', 'Anonymous — do not record who I am'],
    ]),
  },
  good_faith_declaration: { type: 'boolean', label: 'I believe this report is true to the best of my knowledge' },
};

const coreQuestion = (name) =>
  newQuestion(CORE_QUESTIONS[name].type, {
    ...CORE_QUESTIONS[name],
    name,
    _autoName: false,
    required: true,
    is_core_field: true,
  });

const BASICS = ['incident_title', 'incident_description', 'incident_date', 'entity', 'previously_reported'];
const PROTECTION = [
  'implicates_senior_person',
  'retaliation_concern',
  'reporter_relationship',
  'anonymity_election',
  'good_faith_declaration',
];

/** The sections a new "essentials" type starts with. */
export const coreSections = () => [
  newSection({
    section_key: 'sec_basics',
    title: 'Report basics',
    description: 'What happened, when, and where.',
    questions: BASICS.map(coreQuestion),
  }),
  newSection({
    section_key: 'sec_protection',
    title: 'Protection and declarations',
    description: 'Who is involved, and how you would like to be contacted.',
    questions: PROTECTION.map(coreQuestion),
  }),
];

/** The core field names a form does not have yet. */
export const missingCoreFields = (sections) => {
  const present = new Set(sections.flatMap((s) => s.questions).map((q) => q.name));
  return CORE_FIELDS.filter((name) => !present.has(name));
};

/** A section holding the given core questions, to add what a form lacks. */
export const sectionForCoreFields = (names) =>
  newSection({
    title: 'Required questions',
    description: 'Questions every report needs.',
    questions: names.map(coreQuestion),
  });

/** True when the entity question still offers the template's placeholders. */
export const hasPlaceholderEntities = (sections) =>
  sections
    .flatMap((s) => s.questions)
    .some((q) => q.name === 'entity' && (q.options || []).some((o) => ['entity_a', 'entity_b'].includes(o.value)));

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

/** `base`, or `base_2`, `base_3`… — whichever no other question uses. */
export const uniqueFieldName = (base, sections, exceptId) => {
  if (!base) return '';
  const taken = new Set(
    sections.flatMap((s) => s.questions).filter((q) => q.id !== exceptId).map((q) => q.name),
  );
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
  if (!rule.when_question) return 'a condition has no question picked';
  if (!earlier.some((q) => q.name === rule.when_question)) return 'a condition looks at a question that comes later or no longer exists';
  if (isValuelessOperator(rule.operator)) return null;
  if (isListOperator(rule.operator)) return rule.values?.length ? null : 'a condition has no answers picked';
  return rule.value === '' || rule.value === null || rule.value === undefined ? 'a condition has no answer picked' : null;
};

/**
 * Everything worth flagging before save. `error`s block saving; `warning`s are
 * suggestions. Each carries where to fix it: a question, a section, or a step.
 */
export const findIssues = (form, { isNew = false } = {}) => {
  const issues = [];
  const sections = form.sections || [];
  // `blank` marks what is simply not filled in yet — not worth flagging on a
  // question someone has only just added, until they try to save.
  const push = (level, check, message, target, blank = false) => issues.push({ level, check, message, target, blank });

  if (!form.name?.trim()) push('error', 'name', 'The report type needs a name', { field: 'name' });
  if (sections.length === 0) push('error', 'steps', 'Add at least one step with a question', { step: 'questions' });

  const seen = new Map();
  sections.forEach((section, sectionIndex) => {
    const sectionLabel = section.title?.trim() || `Step ${sectionIndex + 1}`;
    const atSection = { sectionId: section.id };
    if (!section.title?.trim()) push('error', 'steps', `Step ${sectionIndex + 1} needs a title`, atSection, true);
    if (section.questions.length === 0) push('error', 'steps', `"${sectionLabel}" has no questions`, atSection, true);

    const sectionRules = section.conditional_logic?.rules || [];
    const beforeSection = questionsBefore(sections, section.id);
    const sectionRuleProblem = sectionRules.map((rule) => ruleProblem(rule, beforeSection)).find(Boolean);
    if (sectionRuleProblem) push('error', 'conditions', `In "${sectionLabel}", ${sectionRuleProblem}`, atSection);

    section.questions.forEach((question, questionIndex) => {
      const label = question.label?.trim() || `Question ${questionIndex + 1} of "${sectionLabel}"`;
      const at = { sectionId: section.id, questionId: question.id };
      if (!question.label?.trim()) push('error', 'questions', `${label} has no wording`, at, true);
      if (!question.name?.trim()) push('error', 'questions', `"${label}" needs a field name`, at, true);
      else if (!FIELD_NAME_PATTERN.test(question.name))
        push('error', 'questions', `"${label}" has a field name with spaces or symbols`, at);
      else if (seen.has(question.name)) push('error', 'questions', `"${label}" uses the same field name as "${seen.get(question.name)}"`, at);
      else seen.set(question.name, label);

      if (hasOptions(question)) {
        const options = normalizeOptions(question.options).filter((o) => String(o.value).trim());
        if (options.length === 0) push('error', 'answers', `"${label}" has no answers to choose from`, at);
      }
      const rules = question.conditional_logic?.rules || [];
      const earlier = questionsBefore(sections, section.id, question.id);
      const problem = rules.map((rule) => ruleProblem(rule, earlier)).find(Boolean);
      if (problem) push('error', 'conditions', `In "${label}", ${problem}`, at);
    });
  });

  const missing = missingCoreFields(sections);
  if (missing.length > 0 && sections.length > 0)
    push('warning', 'core', `${missing.length} of the 10 questions every report needs ${missing.length === 1 ? 'is' : 'are'} missing`, {
      action: 'addCore',
    });
  if (hasPlaceholderEntities(sections)) {
    const entity = allQuestions(sections).find(({ question }) => question.name === 'entity');
    push('warning', 'entities', '"Which entity does this concern?" still lists Entity A and Entity B', {
      sectionId: entity.section.id,
      questionId: entity.question.id,
    });
  }
  if (!form.default_owner_role) push('warning', 'owner', 'No owner is set for these cases', { step: 'handling' });
  if (isNew && !form.code?.trim())
    push('warning', 'code', "No compliance code yet. It can't be added once the type is saved", { step: 'handling' });

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
  if (question?.type === 'boolean') return value === true || value === 'true' || value === 1 || value === '1' ? 'Yes' : 'No';
  const option = normalizeOptions(question?.options).find((o) => o.value === value);
  return option?.label || String(value ?? '');
};

/** "“Was anyone hurt?” is Yes", for a step's or question's show-when logic. */
export const describeLogic = (logic, sections) => {
  const rules = logic?.rules || [];
  if (!rules.length) return '';
  const byName = new Map(sections.flatMap((s) => s.questions).map((q) => [q.name, q]));
  const [rule] = rules;
  const question = byName.get(rule.when_question);
  const name = `“${question?.label || rule.when_question || 'a question'}”`;
  const operator = OPERATORS.find((o) => o.value === rule.operator)?.label || rule.operator;
  let answer = '';
  if (isListOperator(rule.operator)) answer = (rule.values || []).map((v) => answerLabel(question, v)).join(', ');
  else if (!isValuelessOperator(rule.operator)) answer = answerLabel(question, rule.value);
  const more = rules.length > 1 ? ` ${logic.logic_type === 'or' ? 'or' : 'and'} ${rules.length - 1} more` : '';
  const verb = rule.condition_type === 'skip' || rule.condition_type === 'hide' ? 'Skipped' : 'Only shown';
  return `${verb} when ${name} ${operator}${answer ? ` ${answer}` : ''}${more}`;
};
