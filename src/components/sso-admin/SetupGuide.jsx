// src/components/sso-admin/SetupGuide.jsx
//
// What the customer's IT does in Microsoft Entra or Google Cloud (SSO.md §4),
// with this connection's redirect URL filled in once it has one (after the
// first save). Product UI names stay in English in every language: they are
// what IT sees on screen.
import { useTranslation } from 'react-i18next';
import CopyField from './CopyField';

const SetupGuide = ({ provider, redirectUri }) => {
  const { t } = useTranslation('ssoAdmin');
  if (provider !== 'microsoft' && provider !== 'google') return null;
  const steps = t(`guide.${provider}.steps`, { returnObjects: true });

  return (
    <details className="group rounded-lg border border-line bg-subtle p-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent-ring rounded">
        {t(`guide.${provider}.title`)}
      </summary>
      <div className="mt-3 space-y-3 text-ink-secondary">
        <p>{t('guide.intro')}</p>
        {redirectUri ? (
          <CopyField label={t('fields.redirectUri')} value={redirectUri} />
        ) : (
          <p className="text-ink-muted">{t('guide.saveFirst')}</p>
        )}
        <ol className="list-decimal space-y-1.5 ps-5">
          {(Array.isArray(steps) ? steps : []).map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
    </details>
  );
};

export default SetupGuide;
