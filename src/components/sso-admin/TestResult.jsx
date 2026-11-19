// src/components/sso-admin/TestResult.jsx
//
// The result of POST /sso-connections/{id}/test: overall ok, then each check.
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle } from 'lucide-react';

const TestResult = ({ result }) => {
  const { t } = useTranslation('ssoAdmin');
  return (
    <div role="status" className={`rounded-lg border p-3 text-sm ${result.ok ? 'border-success-line bg-success-soft' : 'border-danger-line bg-danger-soft'}`}>
      <p className={`font-semibold ${result.ok ? 'text-success-fg' : 'text-danger-fg'}`}>
        {result.ok ? t('test.passed') : t('test.failed')}
      </p>
      {result.error && <p className="mt-1 text-danger-fg">{result.error}</p>}
      {result.checks?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {result.checks.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-ink-secondary">
              {c.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-fg" aria-label={t('test.ok')} />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-fg" aria-label={t('test.notOk')} />
              )}
              <span>
                <span className="font-medium text-ink">{t(`test.checks.${c.check}`, { defaultValue: c.check })}</span>
                {c.message ? ` — ${c.message}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TestResult;
