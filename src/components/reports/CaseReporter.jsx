// src/components/reports/CaseReporter.jsx
//
// Who filed the case, as far as staff may know (SSO.md §2.8).
//
//   anonymous                       "Anonymous"
//   identity.method sso             name and email, "Verified by company sign-in"
//   identity.method email_password  name and email, "Verified work email"
//   identity.email_hidden           the reporter chose confidential:
//                                   "Confidential reporter — identity verified"
//
// `identity.entity_code` is the reporter's own entity, not the case's.
// Older cases without `identity` show nothing beyond "Anonymous".
import { BadgeCheck, EyeOff, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const CaseReporter = ({ report }) => {
  const { t } = useTranslation('sso');
  const identity = report?.identity;
  const verified = identity && (identity.method === 'sso' || identity.method === 'email_password');

  if (!verified && !report?.is_anonymous) return null;

  let body;
  if (!verified) {
    body = (
      <p className="flex items-center gap-1.5 text-sm text-ink-secondary">
        <EyeOff className="h-4 w-4 text-ink-subtle" aria-hidden="true" /> {t('case.anonymous')}
      </p>
    );
  } else if (identity.email_hidden) {
    body = (
      <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <BadgeCheck className="h-4 w-4 text-success-fg" aria-hidden="true" /> {t('case.confidentialVerified')}
      </p>
    );
  } else {
    body = (
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <UserRound className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
          <span dir="auto">{identity.name || identity.email}</span>
        </p>
        {identity.email && <p className="text-xs text-ink-muted" dir="ltr">{identity.email}</p>}
        <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-px text-[11px] font-semibold text-success-fg">
          <BadgeCheck className="h-3 w-3" aria-hidden="true" />
          {identity.method === 'sso' ? t('case.verifiedSso') : t('case.verifiedEmail')}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-ink-muted">{t('case.reporter')}</p>
      {body}
    </div>
  );
};

export default CaseReporter;
