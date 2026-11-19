// src/components/forms/QuestionValidationEditor.jsx
//
// The validation constraints that apply to a question's type, in the v2 keys
// (min_length, max_value, min_date, …). The server enforces only max_length,
// pattern and email format, so for the rest the form renderer is the only
// check — worth knowing when relying on one.
import { useTranslation } from 'react-i18next';
const fieldClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-accent';

/** Which constraints each question type offers. */
const FIELDS_BY_TYPE = {
  text: ['min_length', 'max_length', 'pattern'],
  textarea: ['min_length', 'max_length'],
  number: ['min_value', 'max_value'],
  currency: ['min_value', 'max_value'],
  date: ['min_date', 'max_date'],
  datetime: ['min_date', 'max_date'],
  multiselect: ['min_selections', 'max_selections'],
  file: ['allowed_file_types', 'max_file_size_mb', 'max_files'],
};

const FIELD_INFO = {
  // Labels are keys under builder:validation.*, resolved at render.
  min_length: { input: 'number' },
  max_length: { input: 'number' },
  pattern: { input: 'text', mono: true, wide: true },
  min_value: { input: 'number' },
  max_value: { input: 'number' },
  min_date: { input: 'date' },
  max_date: { input: 'date' },
  min_selections: { input: 'number' },
  max_selections: { input: 'number' },
  allowed_file_types: { input: 'list', wide: true, placeholder: '.pdf, .jpg, .png' },
  max_file_size_mb: { input: 'number' },
  max_files: { input: 'number' },
};

export const validationFieldsFor = (type) => FIELDS_BY_TYPE[type] || [];

/** A date bound is an ISO date or the keyword `today`, resolved at render. */
const DateBound = ({ id, value, onChange }) => {
  const { t } = useTranslation('builder');
  const isToday = value === 'today';
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="date"
        value={isToday ? '' : value || ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={isToday}
        className={`${fieldClass} disabled:opacity-50`}
      />
      <label className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
        <input type="checkbox" checked={isToday} onChange={(event) => onChange(event.target.checked ? 'today' : '')} />
        {t('validation.today')}
      </label>
    </div>
  );
};

const QuestionValidationEditor = ({ question, onChange }) => {
  const { t } = useTranslation('builder');
  const fields = validationFieldsFor(question.type);
  if (fields.length === 0) return null;
  const validation = question.validation || {};

  const set = (key, raw) => {
    const info = FIELD_INFO[key];
    let next = raw;
    if (info.input === 'number') next = raw === '' ? '' : Number(raw);
    if (info.input === 'list') {
      next = raw
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
        .map((part) => (part.startsWith('.') ? part : `.${part}`));
    }
    onChange(key, next);
  };

  return (
    <div className="rounded-lg border border-line bg-subtle p-4">
      <p className="mb-3 text-sm font-semibold text-ink">{t('validation.title')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((key) => {
          const info = FIELD_INFO[key];
          const id = `${question.id}-${key}`;
          const value = validation[key];
          return (
            <div key={key} className={info.wide ? 'sm:col-span-2' : ''}>
              <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-secondary">
                {t(`validation.fields.${key}`)}
              </label>
              {info.input === 'date' ? (
                <DateBound id={id} value={value} onChange={(next) => set(key, next)} />
              ) : (
                <input
                  id={id}
                  type={info.input === 'number' ? 'number' : 'text'}
                  min={info.input === 'number' && !key.endsWith('_value') ? 0 : undefined}
                  value={Array.isArray(value) ? value.join(', ') : value ?? ''}
                  onChange={(event) => set(key, event.target.value)}
                  placeholder={info.placeholder || t('validation.noLimit')}
                  className={`${fieldClass} ${info.mono ? 'font-mono' : ''}`}
                />
              )}
            </div>
          );
        })}
      </div>
      {question.type === 'currency' && (
        <p className="mt-2 text-[11px] text-ink-subtle">{t('validation.currencyHint')}</p>
      )}
    </div>
  );
};

export default QuestionValidationEditor;
