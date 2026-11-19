// src/components/reports/FlagBadge.jsx
//
// A case flag (ROUTING_RULES.md §7): `{ code, label: { en, ar } | null,
// regulator, source }`. Shows the label in the interface language, else the
// code. A free-text regulatory trigger arrives as REGULATORY_TRIGGER with the
// text as its English label.
import { Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const flagLabel = (flag, lang) => {
  if (!flag) return '';
  const label = flag.label;
  if (label && typeof label === 'object') return (lang === 'ar' && label.ar) || label.en || label.ar || flag.code;
  return (typeof label === 'string' && label) || flag.code;
};

const FlagBadge = ({ flag, size = 'small' }) => {
  const { i18n } = useTranslation();
  const text = flagLabel(flag, i18n.resolvedLanguage);
  const title = [flag.code !== text ? flag.code : null, flag.regulator].filter(Boolean).join(' · ') || undefined;
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center gap-1 rounded-md border border-warning-line bg-warning-soft font-semibold text-warning-fg ${
        size === 'small' ? 'px-1.5 py-px text-[11px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate" dir="auto">{text}</span>
    </span>
  );
};

export default FlagBadge;
