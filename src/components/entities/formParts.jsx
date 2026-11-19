// src/components/entities/formParts.jsx
//
// Small form pieces shared by the legal entity form and the organization
// defaults page (ENTITIES.md).
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { localized } from '../../api/jurisdiction';

export const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent focus:ring-2 focus:ring-accent-ring read-only:bg-sunken disabled:bg-sunken disabled:text-ink-muted';

export const CURRENCIES = ['AED', 'SAR', 'USD', 'EUR', 'GBP', 'BHD', 'KWD', 'OMR', 'QAR'];
export const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

/** A labelled field with its hint or error, linked for screen readers. */
export const Field = ({ label, htmlFor, hint, error, required, badge, children }) => {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;
  return (
    <div className="space-y-1.5">
      {/* One line, fixed height, so fields side by side line up whether or
          not they carry a button (Override / Reset). */}
      <div className={`flex items-center justify-between gap-2 ${badge ? 'min-h-8' : ''}`}>
        <label htmlFor={htmlFor} className="block min-w-0 text-sm font-medium text-ink-secondary">
          {label}
          {required && <span className="ms-0.5 text-danger-fg" aria-hidden="true">*</span>}
        </label>
        {badge && <div className="-me-2 shrink-0 whitespace-nowrap">{badge}</div>}
      </div>
      {typeof children === 'function' ? children(describedBy) : children}
      {error ? (
        <p id={describedBy} className="text-xs text-danger-fg">{error}</p>
      ) : (
        hint && <p id={describedBy} className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
};

/** Retention years for display: 0 → "Forever". */
export const RetentionText = ({ years }) => {
  const { t } = useTranslation('entities');
  if (years === null || years === undefined || years === '') return <span className="text-ink-muted">—</span>;
  return Number(years) === 0 ? t('values.forever') : t('values.years', { count: Number(years) });
};

/** One of the five inheritable values, as text (language name, Forever, …). */
export const inheritedText = (field, value, t, packs = []) => {
  if (field === 'calendar_pack_code' && !value) return t('values.followsPack');
  if (value === null || value === undefined || value === '') return t('values.notSet');
  if (field === 'retention_years') return Number(value) === 0 ? t('values.forever') : t('values.years', { count: Number(value) });
  if (field === 'default_language') return t(`values.language.${value}`, { defaultValue: value });
  if (field === 'jurisdiction_pack_code' || field === 'calendar_pack_code') {
    const pack = packs.find((p) => p.code === value);
    return pack ? `${value} · ${localized(pack.name)}` : value;
  }
  return String(value);
};
