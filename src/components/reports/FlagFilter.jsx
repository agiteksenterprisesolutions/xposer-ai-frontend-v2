// src/components/reports/FlagFilter.jsx
//
// The case list's flag filter (ROUTING_RULES.md §7: GET /reports/?flag=).
// Suggests the flags seen on the loaded cases plus the organization pack's
// regulatory triggers; any other code can be typed. Applied on Enter, on
// picking a suggestion, or when the field loses focus.
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { flagLabel } from './FlagBadge';

const FlagFilter = ({ value, onChange, options = [] }) => {
  const { t, i18n } = useTranslation('cases');
  const listId = useId();
  const [draft, setDraft] = useState(value || '');
  useEffect(() => setDraft(value || ''), [value]);

  const apply = (next) => {
    const code = (next ?? draft).trim().toUpperCase();
    if (code !== (value || '')) onChange(code);
  };

  return (
    <>
      <input
        type="search"
        list={listId}
        dir="ltr"
        value={draft}
        aria-label={t('list.flagFilter')}
        placeholder={t('list.flagPlaceholder')}
        onChange={(e) => {
          setDraft(e.target.value);
          // Picking a suggestion from the list applies it straight away.
          if (options.some((o) => o.code === e.target.value.toUpperCase())) apply(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            apply();
          }
        }}
        onBlur={() => apply()}
        className={`h-9 w-36 shrink-0 rounded-lg border bg-surface px-2.5 text-sm uppercase outline-none placeholder:normal-case focus:border-line-accent ${
          value ? 'border-line-accent text-accent-fg' : 'border-line-strong text-ink-secondary'
        }`}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.code} value={o.code}>{flagLabel(o, i18n.resolvedLanguage)}</option>
        ))}
      </datalist>
    </>
  );
};

export default FlagFilter;
