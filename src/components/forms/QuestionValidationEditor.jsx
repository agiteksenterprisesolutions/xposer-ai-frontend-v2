// src/components/forms/QuestionValidationEditor.jsx
//
// The validation constraints that apply to a question's type, in the v2 keys
// (min_length, max_value, min_date, …). The server enforces only max_length,
// pattern and email format, so for the rest the form renderer is the only
// check — worth knowing when relying on one.
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
  min_length: { label: 'Minimum characters', input: 'number' },
  max_length: { label: 'Maximum characters', input: 'number' },
  pattern: { label: 'Must match (regular expression)', input: 'text', mono: true, wide: true },
  min_value: { label: 'Minimum', input: 'number' },
  max_value: { label: 'Maximum', input: 'number' },
  min_date: { label: 'Earliest date', input: 'date' },
  max_date: { label: 'Latest date', input: 'date' },
  min_selections: { label: 'Choose at least', input: 'number' },
  max_selections: { label: 'Choose at most', input: 'number' },
  allowed_file_types: { label: 'Allowed file types', input: 'list', wide: true, placeholder: '.pdf, .jpg, .png' },
  max_file_size_mb: { label: 'Largest file (MB)', input: 'number' },
  max_files: { label: 'Most files', input: 'number' },
};

export const validationFieldsFor = (type) => FIELDS_BY_TYPE[type] || [];

/** A date bound is an ISO date or the keyword `today`, resolved at render. */
const DateBound = ({ id, value, onChange }) => {
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
        Today
      </label>
    </div>
  );
};

const QuestionValidationEditor = ({ question, onChange }) => {
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
      <p className="mb-3 text-sm font-semibold text-ink">Validation</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((key) => {
          const info = FIELD_INFO[key];
          const id = `${question.id}-${key}`;
          const value = validation[key];
          return (
            <div key={key} className={info.wide ? 'sm:col-span-2' : ''}>
              <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-secondary">
                {info.label}
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
                  placeholder={info.placeholder || 'No limit'}
                  className={`${fieldClass} ${info.mono ? 'font-mono' : ''}`}
                />
              )}
            </div>
          );
        })}
      </div>
      {question.type === 'currency' && (
        <p className="mt-2 text-[11px] text-ink-subtle">In the major unit — e.g. 1500 for SAR 1,500.</p>
      )}
    </div>
  );
};

export default QuestionValidationEditor;
