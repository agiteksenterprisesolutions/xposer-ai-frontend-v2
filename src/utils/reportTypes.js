// src/utils/reportTypes.js
//
// A report type is a governed compliance object, not just a form: it carries
// a compliance code, status, owners, a confidentiality tier, SLAs, audience,
// retention and approval alongside its sections. These helpers keep every
// field intact between the API, the builder and the save payload — a field the
// builder doesn't edit must still survive a round trip, or saving a type
// silently strips it (core-field flags, option labels, section keys).

/** Who may file a report of this type. Stored singular and lower-case. */
export const AUDIENCES = [
  { value: 'employee', label: 'Employees' },
  { value: 'contractor', label: 'Contractors' },
  { value: 'board', label: 'Board members' },
  { value: 'member', label: 'Members' },
  { value: 'broker', label: 'Brokers' },
  { value: 'provider', label: 'Providers' },
  { value: 'supplier', label: 'Suppliers' },
  { value: 'public', label: 'The public' },
];

export const REPORT_TYPE_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'retired', label: 'Retired' },
];

export const CONFIDENTIALITY_TIERS = [
  { value: 'standard', label: 'Standard' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'restricted', label: 'Restricted' },
];

/** How an answer is classed; drives masking and logging on the server. */
export const SENSITIVE_DATA_CLASSES = [
  { value: 'none', label: 'Not sensitive' },
  { value: 'pii', label: 'Personal information' },
  { value: 'special_category', label: 'Special category' },
  { value: 'financial', label: 'Financial' },
  { value: 'government_id', label: 'Government ID' },
];

/**
 * The ten mandatory fields on every taxonomy-based report type. An import
 * missing one is rejected, and the editor must not let one be renamed or
 * deleted. Questions carry `is_core_field`; this list is for messages.
 */
export const CORE_FIELDS = [
  'incident_date',
  'entity',
  'previously_reported',
  'incident_title',
  'incident_description',
  'implicates_senior_person',
  'retaliation_concern',
  'anonymity_election',
  'reporter_relationship',
  'good_faith_declaration',
];

export const DEFAULT_CURRENCY = 'SAR';

/** Currencies offered by the currency widget; any ISO code is accepted. */
export const CURRENCIES = ['SAR', 'AED', 'BHD', 'KWD', 'OMR', 'QAR', 'EGP', 'USD', 'EUR', 'GBP', 'PKR', 'INR'];

/** Minor units per major unit; anything not listed uses 2 decimals. */
const MINOR_DIGITS = { BHD: 3, KWD: 3, OMR: 3, JPY: 0 };
export const currencyDigits = (currency) => MINOR_DIGITS[currency] ?? 2;

/** "1234.5" in SAR → 123450. Money is stored as an integer, never a float. */
export const toMinorUnits = (amount, currency = DEFAULT_CURRENCY) => {
  if (amount === '' || amount === null || amount === undefined) return null;
  const number = Number(amount);
  if (!Number.isFinite(number)) return null;
  return Math.round(number * 10 ** currencyDigits(currency));
};

export const fromMinorUnits = (minor, currency = DEFAULT_CURRENCY) =>
  minor === null || minor === undefined || minor === '' ? '' : (Number(minor) / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency));

/** True for a stored currency answer. */
export const isCurrencyAnswer = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && 'amount_minor' in value;

/** A stored currency answer: `{ amount_minor, currency }`. */
export const formatCurrencyAnswer = (answer) => {
  if (!answer || typeof answer !== 'object') return answer ?? '';
  const currency = answer.currency || DEFAULT_CURRENCY;
  if (answer.amount_minor === null || answer.amount_minor === undefined) return '';
  const amount = Number(answer.amount_minor) / 10 ** currencyDigits(currency);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(currencyDigits(currency))} ${currency}`;
  }
};

/**
 * The twelve validation constraints. The server only enforces max_length,
 * pattern and email format (and only in the conversational flow), so the
 * form renderer enforcing these is, for most of them, the only check there is.
 */
export const VALIDATION_KEYS = [
  'min_length',
  'max_length',
  'min_value',
  'max_value',
  'min_date',
  'max_date',
  'allowed_file_types',
  'max_file_size_mb',
  'max_files',
  'min_selections',
  'max_selections',
  'pattern',
];

const LEGACY_VALIDATION_KEYS = { min: 'min_value', max: 'max_value', minLength: 'min_length', maxLength: 'max_length' };

/**
 * A question's validation in the v2 keys. Older types used min/max/minLength/
 * maxLength; those are renamed, empty values dropped and unknown keys removed
 * (they are an error at import).
 */
export const normalizeValidation = (validation) => {
  const result = {};
  Object.entries(validation || {}).forEach(([key, value]) => {
    const name = LEGACY_VALIDATION_KEYS[key] || key;
    if (!VALIDATION_KEYS.includes(name)) return;
    if (value === '' || value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    // A legacy key never overwrites its v2 name.
    if (name !== key && result[name] !== undefined) return;
    result[name] = value;
  });
  return result;
};

/**
 * Options are either legacy bare strings or `{ value, label, display_order }`.
 * `value` is what is stored in the answer and referenced by conditional rules;
 * `label` is display only.
 */
export const normalizeOption = (option, index = 0) => {
  if (typeof option === 'string') return { value: option, label: option, display_order: index };
  if (option && typeof option === 'object') {
    const value = option.value ?? option.label ?? '';
    return { value: String(value), label: option.label || String(value), display_order: option.display_order ?? index };
  }
  return { value: '', label: '', display_order: index };
};

/** Options in display order, always as objects. */
export const normalizeOptions = (options) =>
  (Array.isArray(options) ? options : [])
    .map(normalizeOption)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

export const optionValue = (option) => (typeof option === 'string' ? option : option?.value ?? option?.label ?? '');
export const optionLabel = (option) =>
  typeof option === 'string' ? option : option?.label || String(option?.value ?? '');

/** The label for a stored value, falling back to the value itself. */
export const labelForValue = (options, value) => {
  const found = (options || []).find((option) => optionValue(option) === value);
  return found ? optionLabel(found) : value;
};

const OPTION_TYPES = ['select', 'multiselect'];

/** Governance fields, with the defaults a new type starts from. */
export const GOVERNANCE_DEFAULTS = {
  code: '',
  category: '',
  status: 'active',
  default_owner_role: '',
  alternate_owner_role: '',
  confidentiality_tier: 'standard',
  ack_sla_days: '',
  triage_sla_days: '',
  allows_anonymous: true,
  audience: [],
  retention_years: '',
  regulatory_trigger: '',
};

/**
 * Reshapes a report type as the API returns it into the shape
 * `ReportTypeBuilder` expects. Every field is kept — the builder only edits
 * some of them, and the rest must survive the save.
 */
export const toBuilderShape = (reportType) => {
  if (!reportType) return null;

  return {
    ...reportType,
    sections: reportType.sections?.map((section, sectionIndex) => ({
      ...section,
      id: section._id || section.id || `section_${sectionIndex}`,
      order: section.order || 0,
      conditional_logic: section.conditional_logic || null,
      questions: section.questions?.map((question, questionIndex) => ({
        ...question,
        id: question._id || question.id || `question_${sectionIndex}_${questionIndex}`,
        validation: normalizeValidation(question.validation),
        order: question.order || 0,
        conditional_logic: question.conditional_logic || null,
        options: normalizeOptions(question.options),
      })) || [],
    })) || [],
  };
};

const blankToNull = (value) => (value === '' || value === undefined ? null : value);
const toIntOrNull = (value) => (value === '' || value === null || value === undefined ? null : Number.parseInt(value, 10));

const cleanRules = (logic) => {
  if (!logic || !logic.rules?.length) return null;
  return {
    rules: logic.rules.map((rule) => ({
      condition_type: rule.condition_type || 'show',
      when_question: rule.when_question,
      operator: rule.operator,
      value: rule.value ?? null,
      values: rule.values?.length ? rule.values : null,
      target_question: rule.target_question ?? null,
      target_section: rule.target_section ?? null,
    })),
    logic_type: logic.logic_type || 'and',
  };
};

/**
 * The create/update body for a report type, from the builder's form data.
 * `keepIds` sends section and question ids so an update edits in place.
 */
export const toReportTypePayload = (formData, { keepIds = false } = {}) => ({
  name: formData.name?.trim(),
  description: formData.description || '',
  is_active: formData.is_active,
  code: blankToNull(formData.code?.trim()),
  category: blankToNull(formData.category?.trim()),
  status: formData.status || 'active',
  default_owner_role: blankToNull(formData.default_owner_role),
  alternate_owner_role: blankToNull(formData.alternate_owner_role),
  confidentiality_tier: formData.confidentiality_tier || 'standard',
  ack_sla_days: toIntOrNull(formData.ack_sla_days),
  triage_sla_days: toIntOrNull(formData.triage_sla_days),
  allows_anonymous: formData.allows_anonymous ?? true,
  audience: formData.audience || [],
  retention_years: toIntOrNull(formData.retention_years),
  regulatory_trigger: blankToNull(formData.regulatory_trigger?.trim()),
  sections: (formData.sections || []).map((section, sectionIndex) => ({
    ...(keepIds && section.id && !String(section.id).startsWith('section_') ? { id: section.id } : {}),
    section_key: section.section_key || null,
    title: section.title,
    description: section.description || '',
    order: section.order ?? sectionIndex,
    is_shared: Boolean(section.is_shared),
    conditional_logic: cleanRules(section.conditional_logic),
    questions: (section.questions || []).map((question, questionIndex) => {
      const body = {
        ...(keepIds && question.id && !String(question.id).startsWith('question_') ? { id: question.id } : {}),
        type: question.type,
        label: question.label,
        name: question.name,
        required: Boolean(question.required),
        is_core_field: Boolean(question.is_core_field),
        sensitive_data_class: question.sensitive_data_class || 'none',
        placeholder: question.placeholder || '',
        help_text: question.help_text || '',
        default_value: question.default_value ?? '',
        validation: normalizeValidation(question.validation),
        order: question.order ?? questionIndex,
        conditional_logic: cleanRules(question.conditional_logic),
      };
      if (OPTION_TYPES.includes(question.type)) {
        body.options = normalizeOptions(question.options)
          .map((option) => ({ ...option, value: option.value.trim(), label: (option.label || option.value).trim() }))
          .filter((option) => option.value)
          .map((option, index) => ({ ...option, display_order: index }));
      }
      return body;
    }),
  })),
});

/** Section, question, and required-question counts for a report type. */
export const summarizeReportType = (reportType) => {
  const sections = reportType?.sections || [];
  return {
    sections: sections.length,
    questions: sections.reduce((total, s) => total + (s.questions?.length || 0), 0),
    required: sections.reduce(
      (total, s) => total + (s.questions?.filter((q) => q.required)?.length || 0),
      0,
    ),
  };
};
