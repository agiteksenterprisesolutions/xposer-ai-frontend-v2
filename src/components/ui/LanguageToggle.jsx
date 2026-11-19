// src/components/ui/LanguageToggle.jsx
//
// Switches the interface between English and Arabic. The button shows the
// language you'd switch *to*, in that language (someone looking for Arabic
// scans for العربية), and carries its `lang` so screen readers pronounce it.
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, CHOSEN_KEY } from '../../i18n';

const LanguageToggle = ({ className = '', compact = false }) => {
  const { i18n, t } = useTranslation('common');
  const current = i18n.resolvedLanguage || 'en';
  const next = LANGUAGES.find((l) => l.code !== current) || LANGUAGES[0];

  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem(CHOSEN_KEY, '1');
        } catch {
          /* private mode: the choice still applies to this page */
        }
        i18n.changeLanguage(next.code);
      }}
      lang={next.code}
      aria-label={compact ? t('language.switchTo', { language: next.native, lng: next.code }) : undefined}
      title={t('language.switchTo', { language: next.native, lng: next.code })}
      className={[
        'inline-flex items-center gap-1.5 h-9 rounded-lg text-sm text-ink-muted bg-transparent border border-transparent',
        'transition-colors hover:text-ink hover:bg-hover',
        compact ? 'w-9 justify-center' : 'px-2.5',
        className,
      ].join(' ')}
    >
      <Languages className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!compact && <span>{next.native}</span>}
    </button>
  );
};

export default LanguageToggle;
