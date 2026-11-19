// src/components/reports/EscalationPreview.jsx
//
// "Who would this report escalate to?" — the report's own free text run
// through the reporting hierarchy. Nothing is changed; it is a lookup.
//
// Three outcomes, each with its own wording, because they mean very
// different things in a system that decides who hears about an allegation
// against them:
//   matched, with someone above  → the route.
//   matched, no one above on file → someone was identified, but the ladder
//                                    stops there; a person must route it.
//   not matched                  → no one ON FILE is named. Never "nobody is
//                                    implicated": matching is exact and
//                                    whole-word by design, so a misspelling or
//                                    a person missing from the directory looks
//                                    the same as no name at all.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowDown, HelpCircle, Route, UserRound } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { getReportTexts } from '../../utils/reports';
import { describeError } from '../../utils/errors';
import SkippedManagers from './SkippedManagers';

const Person = ({ member, level, label }) => (
  <div className="flex items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{label}</p>
      <p className="text-sm font-medium text-ink" dir="auto">{member?.name || '—'}</p>
      <p className="text-xs text-ink-muted" dir="auto">
        {[member?.designation, level?.title || member?.level_code, member?.department].filter(Boolean).join(' · ')}
      </p>
    </div>
  </div>
);

const EscalationPreview = ({ report, hierarchyPath }) => {
  const { t } = useTranslation('cases');
  const { nameFor } = useOrgRoles();
  const [department, setDepartment] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  const texts = getReportTexts(report);

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setResult(await orgHierarchyAPI.resolve({ texts, department: department.trim() || null }));
    } catch (err) {
      setResult(null);
      setError(describeError(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Route className="h-4 w-4 text-accent-fg" aria-hidden="true" />
          {t('escalationPreview.title')}
        </Card.Title>
        <Card.Description>{t('escalationPreview.description')}</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div className="flex flex-col gap-2">
          <input
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder={t('escalationPreview.departmentPlaceholder')}
            aria-label={t('escalationPreview.department')}
            className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink hover:border-line-strong"
          />
          <Button variant="secondary" onClick={check} isLoading={checking} disabled={texts.length === 0}>
            {result ? t('escalationPreview.checkAgain') : t('escalationPreview.check')}
          </Button>
          <p className="text-xs text-ink-subtle">
            {t('escalationPreview.scans', { count: texts.length })}
          </p>
        </div>

        {error && <Alert variant="error" title={error.summary} />}

        {result?.matched && result.escalate_to_member && (
          <div className="space-y-2">
            <Person member={result.implicated_member} level={result.implicated_level} label={t('escalationPreview.named')} />
            <div className="flex justify-center">
              <ArrowDown className="h-4 w-4 text-ink-subtle" />
            </div>
            <Person member={result.escalate_to_member} level={result.escalate_to_level} label={t('escalationPreview.escalatesTo')} />
            {result.escalation_role && (
              <p className="text-xs text-ink-muted">
                {t('escalationPreview.routedToRole', { role: nameFor(result.escalation_role) })}
              </p>
            )}
            {result.reason && <p className="text-xs text-ink-subtle" dir="auto">{result.reason}</p>}
            <SkippedManagers skipped={result.skipped_managers} />
          </div>
        )}

        {result?.matched && !result.escalate_to_member && (
          <div className="space-y-2">
            <Person member={result.implicated_member} level={result.implicated_level} label={t('escalationPreview.named')} />
            <Alert variant="warning" title={t('escalationPreview.manualTitle')}>
              <p>{t('escalationPreview.manualBody')}</p>
              {result.reason && <p className="mt-1 text-xs" dir="auto">{result.reason}</p>}
              <div className="mt-2">
                <SkippedManagers skipped={result.skipped_managers} />
              </div>
              {hierarchyPath && (
                <Link to={hierarchyPath} className="mt-2 inline-block text-sm font-medium text-link hover:underline">
                  {t('escalationPreview.reviewHierarchy')}
                </Link>
              )}
            </Alert>
          </div>
        )}

        {result && !result.matched && (
          <div className="flex items-start gap-2 rounded-lg border border-line bg-subtle px-3 py-2.5">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
            <div className="space-y-1 text-sm text-ink-secondary">
              <p className="font-medium text-ink">{t('escalationPreview.noneTitle')}</p>
              <p className="text-xs">{t('escalationPreview.noneBody')}</p>
              {result.reason && <p className="text-xs text-ink-subtle" dir="auto">{result.reason}</p>}
              {hierarchyPath && (
                <Link to={hierarchyPath} className="inline-block text-xs font-medium text-link hover:underline">
                  {t('escalationPreview.checkDirectory')}
                </Link>
              )}
            </div>
          </div>
        )}

        {texts.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {t('escalationPreview.noAnswers')}
          </p>
        )}
      </Card.Content>
    </Card>
  );
};

export default EscalationPreview;
