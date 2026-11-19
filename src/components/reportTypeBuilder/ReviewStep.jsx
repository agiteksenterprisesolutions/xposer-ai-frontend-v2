// src/components/reportTypeBuilder/ReviewStep.jsx
//
// Step 3 of the report type builder: what still needs fixing, a one-glance
// summary with links back, and the form on a phone or desktop. Errors block
// saving; suggestions don't.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { CONFIDENTIALITY_TIERS, REPORT_TYPE_STATUSES, reportTypeStatus } from '../../utils/reportTypes';
import ReporterPreview from './ReporterPreview';
import { GovernanceProblems } from './HandlingStep';
import { countQuestions, estimateMinutes } from './model';
import { missingCore } from './catalog';

// Checks that passed, by check id; the text is builder:review.passed.<check>.
const PASSED = ['steps', 'questions', 'answers', 'conditions', 'core'];

const Summary = ({ title, onEdit, children }) => {
  const { t } = useTranslation('builder');
  return (
  <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
    <div className="flex items-center justify-between">
      <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
      <button type="button" onClick={onEdit} className="text-sm font-medium text-link hover:underline">
        {t('common:actions.edit')}
      </button>
    </div>
    {children}
  </section>
  );
};

const ReviewStep = ({ draft, issues, isNew, onFix, problems = [], activationBlock = [], coreError = null }) => {
  const { form, setField, catalog } = draft;
  const { t } = useTranslation('builder');
  const labelOf = (name) => catalog?.byName.get(name)?.label || name;
  const { nameFor } = useOrgRoles({ source: 'owners' });
  const [device, setDevice] = useState('phone');

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const failing = new Set(issues.map((i) => i.check));
  // Core is only checked for a live type; claim it only when it's really asked.
  const asksCore = Boolean(catalog) && missingCore(form, catalog).length === 0;
  const passed = PASSED.filter((check) => !failing.has(check) && (check !== 'core' || asksCore)).map((check) => [
    check,
    t(`review.passed.${check}`),
  ]);
  const questions = countQuestions(form.sections);
  const minutes = estimateMinutes(form.sections);
  const tier = CONFIDENTIALITY_TIERS.find((option) => option.value === (form.confidentiality_tier || 'standard'))?.label;

  const handling = [
    [t('review.handling.category'), form.category?.trim() || t('review.handling.none')],
    [
      t('review.handling.anonymous'),
      form.allows_anonymous === false ? t('review.handling.anonymousOff') : t('review.handling.anonymousOn'),
    ],
    [
      t('review.handling.escalation'),
      form.escalate_on_subject === false ? t('review.handling.escalationOff') : t('review.handling.escalationOn'),
    ],
    [
      t('review.handling.owner'),
      form.default_owner_role
        ? form.alternate_owner_role
          ? t('review.handling.ownerWithBackup', {
              owner: nameFor(form.default_owner_role),
              backup: nameFor(form.alternate_owner_role),
            })
          : nameFor(form.default_owner_role)
        : t('review.handling.ownerNone'),
    ],
    [t('review.handling.confidentiality'), tier],
    [
      t('review.handling.response'),
      form.ack_sla_days || form.triage_sla_days
        ? [
            form.ack_sla_days && t('review.handling.ack', { count: Number(form.ack_sla_days) }),
            form.triage_sla_days && t('review.handling.triage', { count: Number(form.triage_sla_days) }),
          ]
            .filter(Boolean)
            .join(' · ')
        : t('review.handling.noTargets'),
    ],
    [
      t('review.handling.records'),
      form.retention_years
        ? t('review.handling.deletedAfter', { count: Number(form.retention_years) })
        : t('review.handling.keptByHand'),
    ],
  ];

  const fixButton = (issue) => (
    <button type="button" onClick={() => onFix(issue.target)} className="shrink-0 font-semibold underline underline-offset-2">
      {issue.level === 'error' ? t('review.fix') : t('review.reviewIt')}
    </button>
  );

  return (
    <div className="mx-auto flex w-full max-w-290 flex-wrap items-start gap-6 px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-[999_1_34rem] flex-col gap-5">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">
            {errors.length
              ? t('review.toFix', { count: errors.length })
              : isNew
                ? t('review.readyPublish')
                : t('review.readySave')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {errors.length
              ? t('review.toFixHint')
              : isNew
                ? t('review.readyPublishHint')
                : t('review.readySaveHint')}
          </p>
        </div>

        <GovernanceProblems problems={problems} />

        {coreError && (
          <section role="alert" className="flex flex-col gap-2 rounded-2xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-fg">
            <p className="font-semibold">{t('review.notSavedCore')}</p>
            <p>{coreError.message}</p>
            <div className="flex flex-wrap gap-2">
              {coreError.fields.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onFix({ standard: name })}
                  className="rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-danger-fg shadow-sm hover:brightness-95"
                >
                  {t('review.addQuestion', { question: labelOf(name) })}
                </button>
              ))}
            </div>
          </section>
        )}

        {isNew && !coreError && activationBlock.length > 0 && (
          <section className="flex flex-col gap-2 rounded-2xl border border-warning-line bg-warning-soft p-4 text-sm text-warning-fg">
            {activationBlock.map((issue) => (
              <p key={issue.target.standard} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 flex-1">{t('review.canStillDraft', { message: issue.message })}</span>
                <button type="button" onClick={() => onFix(issue.target)} className="shrink-0 font-semibold underline underline-offset-2">
                  {t('review.addIt')}
                </button>
              </p>
            ))}
          </section>
        )}

        <section className="rounded-2xl border border-line bg-surface py-2" data-tour="rtb-checklist" aria-label={t('review.checks')}>
          <ul>
            {errors.map((issue, i) => (
              <li key={`e${i}`} className="mx-2 my-1 flex items-center gap-3 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger-fg">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-danger-solid text-white">
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">{issue.message}</span>
                {fixButton(issue)}
              </li>
            ))}
            {warnings.map((issue, i) => (
              <li key={`w${i}`} className="mx-2 my-1 flex items-center gap-3 rounded-xl bg-warning-soft px-3 py-2.5 text-sm text-warning-fg">
                <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">{issue.message}</span>
                {fixButton(issue)}
              </li>
            ))}
            {passed.map(([check, text]) => (
              <li key={check} className="flex items-center gap-3 px-5 py-2.5 text-sm text-ink-secondary">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-fg">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
          {warnings.length > 0 && <p className="px-5 pb-2 pt-1 text-xs text-ink-muted">{t('review.suggestionsDontBlock')}</p>}
        </section>

        {!isNew && (
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[0.9375rem] font-semibold text-ink" id="rt-status-label">
              {t('review.availability')}
            </h2>
            <div role="radiogroup" aria-labelledby="rt-status-label" className="grid gap-2 sm:grid-cols-3">
              {REPORT_TYPE_STATUSES.map((status) => {
                const on = reportTypeStatus(form) === status.value;
                // Going live needs the core question; a type already live keeps the choice so it can be fixed.
                const blocked = status.value === 'active' && !on && activationBlock.length > 0;
                return (
                  <button
                    key={status.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={blocked}
                    title={blocked ? activationBlock[0].message : undefined}
                    onClick={() => setField('status', status.value)}
                    className={`rounded-xl border px-3.5 py-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      on ? 'border-accent bg-accent-soft/60 shadow-[0_0_0_1px_var(--color-accent)]' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-ink">{status.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{status.hint}</span>
                  </button>
                );
              })}
            </div>
            {activationBlock.length > 0 && reportTypeStatus(form) !== 'active' && (
              <p className="text-xs text-warning-fg">
                {t('review.sentence', { message: activationBlock[0].message })}{' '}
                <button type="button" onClick={() => onFix(activationBlock[0].target)} className="font-semibold underline underline-offset-2">
                  {t('review.addIt')}
                </button>
              </p>
            )}
          </section>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Summary title={t('steps.questions')} onEdit={() => onFix({ step: 'questions' })}>
            <div className="flex gap-6">
              {[
                [form.sections.length, t('review.stepsUnit', { count: form.sections.length })],
                [questions, t('review.questionsUnit', { count: questions })],
                [t('review.minutes', { count: minutes }), t('review.toComplete')],
              ].map(([value, label]) => (
                <div key={label}>
                  <div className="text-xl font-bold text-ink">{value}</div>
                  <div className="text-xs text-ink-muted">{label}</div>
                </div>
              ))}
            </div>
            <ol className="list-decimal flex flex-col gap-1 border-t border-line-subtle ps-5 pt-3 text-sm text-ink-secondary">
              {form.sections.map((section) => (
                <li key={section.id}>
                  {section.title || <span className="italic text-ink-muted">{t('preview.untitledStep')}</span>}
                  <span className="text-ink-muted"> · {section.questions.length}</span>
                </li>
              ))}
            </ol>
          </Summary>

          <Summary title={t('steps.handling')} onEdit={() => onFix({ step: 'handling' })}>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              {handling.map(([term, value]) => (
                <div key={term} className="contents">
                  <dt className="text-ink-muted">{term}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Summary>
        </div>
      </div>

      <aside aria-label={t('review.reporterPreview')} className="flex flex-[1_1_20rem] flex-col items-center gap-3 lg:sticky lg:top-6">
        <div className="flex w-full max-w-75 items-center justify-between text-sm">
          <span className="font-semibold text-ink">{t('review.reporterPreview')}</span>
          <span className="flex rounded-lg bg-active p-0.5">
            {['phone', 'desktop'].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={`h-7 rounded-md px-2.5 text-xs font-medium ${device === d ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'}`}
              >
                {t(`review.device.${d}`)}
              </button>
            ))}
          </span>
        </div>
        {device === 'phone' ? (
          <ReporterPreview form={form} device="phone" />
        ) : (
          <div className="w-full">
            <ReporterPreview form={form} device="desktop" />
          </div>
        )}
      </aside>
    </div>
  );
};

export default ReviewStep;
