// src/utils/reportAnswers.js
//
// How a report's answers read on screen. An answer stores the option's
// `value`; the label shown comes from the form the report was filed against
// (reportTypesAPI.formForReport), so an option renamed or removed later still
// reads as what the reporter chose.
import { formatDate, formatDateTime } from './formatters';
import { formatCurrencyAnswer, isCurrencyAnswer, labelForValue } from './reportTypes';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Question name → question, across every section of a form. */
export const questionsByName = (form) =>
  new Map((form?.sections || []).flatMap((section) => section.questions || []).map((q) => [q.name, q]));

/** One answer as text. `question` (optional) supplies option labels. */
export const formatAnswer = (value, question) => {
  if (isCurrencyAnswer(value)) return formatCurrencyAnswer(value) || 'N/A';
  if (value === null || value === undefined || value === '') return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  // The voice agent stores a yes/no answer as text.
  if (question?.type === 'boolean' && (value === 'true' || value === 'false')) return value === 'true' ? 'Yes' : 'No';
  const label = (v) => (question?.options?.length ? labelForValue(question.options, v) : v);
  if (Array.isArray(value)) return value.length ? value.map((v) => String(label(v))).join(', ') : 'N/A';
  if (typeof value === 'object') return JSON.stringify(value);

  const str = String(label(value));
  if (ISO_DATE.test(str.trim())) return str.includes('T') ? formatDateTime(str) : formatDate(str);
  return str;
};

/**
 * `form_data` as `[{ key, label, value, question }]`, in the form's own order
 * (sections, then questions); answers the form doesn't know go last, labelled
 * from their key.
 */
export const orderedAnswers = (formData, form) => {
  const entries = Object.entries(formData || {});
  const sections = [...(form?.sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const position = new Map();
  sections.forEach((section, s) => {
    [...(section.questions || [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .forEach((q, i) => position.set(q.name, [s, i]));
  });
  const questions = questionsByName(form);
  const rank = (key) => position.get(key) || [Infinity, 0];
  return entries
    .map(([key, value], index) => ({ key, value, question: questions.get(key), index }))
    .sort((a, b) => {
      const [as, ai] = rank(a.key);
      const [bs, bi] = rank(b.key);
      return as - bs || ai - bi || a.index - b.index;
    })
    .map(({ key, value, question }) => ({
      key,
      value,
      question,
      label: question?.label || key.replace(/_/g, ' '),
    }));
};
