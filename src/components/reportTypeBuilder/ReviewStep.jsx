// src/components/reportTypeBuilder/ReviewStep.jsx
//
// Step 3 of the report type builder: what still needs fixing, a one-glance
// summary with links back, and the form on a phone or desktop. Errors block
// saving; suggestions don't.
import { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { CONFIDENTIALITY_TIERS, REPORT_TYPE_STATUSES, reportTypeStatus } from '../../utils/reportTypes';
import ReporterPreview from './ReporterPreview';
import { GovernanceProblems } from './HandlingStep';
import { countQuestions, estimateMinutes } from './model';

const PASSED = {
  steps: 'Every step has a title and at least one question',
  questions: 'Every question has wording and its own field name',
  answers: 'Every dropdown and checkbox question has answers',
  conditions: 'Conditions only look at earlier questions',
};

const Summary = ({ title, onEdit, children }) => (
  <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
    <div className="flex items-center justify-between">
      <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
      <button type="button" onClick={onEdit} className="text-sm font-medium text-link hover:underline">
        Edit
      </button>
    </div>
    {children}
  </section>
);

const ReviewStep = ({ draft, issues, isNew, onFix, problems = [] }) => {
  const { form, setField } = draft;
  const { nameFor } = useOrgRoles();
  const [device, setDevice] = useState('phone');

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const failing = new Set(issues.map((i) => i.check));
  const passed = Object.entries(PASSED).filter(([check]) => !failing.has(check));
  const questions = countQuestions(form.sections);
  const minutes = estimateMinutes(form.sections);
  const tier = CONFIDENTIALITY_TIERS.find((t) => t.value === (form.confidentiality_tier || 'standard'))?.label;

  const handling = [
    ['Category', form.category?.trim() || 'None'],
    ['Anonymous reports', form.allows_anonymous === false ? 'Not allowed — reporters must sign in' : 'Allowed'],
    [
      'Owner',
      form.default_owner_role
        ? `${nameFor(form.default_owner_role)}${form.alternate_owner_role ? ` · backup ${nameFor(form.alternate_owner_role)}` : ''}`
        : 'Not set — cases wait unassigned',
    ],
    ['Confidentiality', tier],
    [
      'Response',
      form.ack_sla_days || form.triage_sla_days
        ? [form.ack_sla_days && `Acknowledge in ${form.ack_sla_days} days`, form.triage_sla_days && `triage in ${form.triage_sla_days}`]
            .filter(Boolean)
            .join(' · ')
        : 'No targets set',
    ],
    ['Records', form.retention_years ? `Deleted ${form.retention_years} years after closing` : 'Kept until deleted by hand'],
  ];

  const fixButton = (issue) => (
    <button type="button" onClick={() => onFix(issue.target)} className="shrink-0 font-semibold underline underline-offset-2">
      {issue.level === 'error' ? 'Fix' : 'Review'}
    </button>
  );

  return (
    <div className="mx-auto flex w-full max-w-290 flex-wrap items-start gap-6 px-4 py-7 sm:px-6 lg:px-8">
      <div className="min-w-0 flex-[999_1_34rem] space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">
            {errors.length
              ? `${errors.length} thing${errors.length === 1 ? '' : 's'} to fix before saving`
              : isNew
                ? 'Ready to publish'
                : 'Ready to save'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {errors.length
              ? 'Each one links to the place to fix it.'
              : isNew
                ? 'Publish to make this type available to reporters, or keep it as a draft. You can edit it later.'
                : 'Your changes apply to new reports. Reports already filed keep their answers.'}
          </p>
        </div>

        <GovernanceProblems problems={problems} />

        <section className="rounded-2xl border border-line bg-surface py-2" data-tour="rtb-checklist" aria-label="Checks">
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
          {warnings.length > 0 && <p className="px-5 pb-2 pt-1 text-xs text-ink-muted">Suggestions don't block saving.</p>}
        </section>

        {!isNew && (
          <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[0.9375rem] font-semibold text-ink" id="rt-status-label">
              Availability
            </h2>
            <div role="radiogroup" aria-labelledby="rt-status-label" className="grid gap-2 sm:grid-cols-3">
              {REPORT_TYPE_STATUSES.map((status) => {
                const on = reportTypeStatus(form) === status.value;
                return (
                  <button
                    key={status.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setField('status', status.value)}
                    className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                      on ? 'border-accent bg-accent-soft/60 shadow-[0_0_0_1px_var(--color-accent)]' : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-ink">{status.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{status.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Summary title="Questions" onEdit={() => onFix({ step: 'questions' })}>
            <div className="flex gap-6">
              {[
                [form.sections.length, form.sections.length === 1 ? 'step' : 'steps'],
                [questions, questions === 1 ? 'question' : 'questions'],
                [`~${minutes} min`, 'to complete'],
              ].map(([value, label]) => (
                <div key={label}>
                  <div className="text-xl font-bold text-ink">{value}</div>
                  <div className="text-xs text-ink-muted">{label}</div>
                </div>
              ))}
            </div>
            <ol className="list-decimal space-y-1 border-t border-line-subtle pl-5 pt-3 text-sm text-ink-secondary">
              {form.sections.map((section) => (
                <li key={section.id}>
                  {section.title || <span className="italic text-ink-muted">Untitled step</span>}
                  <span className="text-ink-muted"> · {section.questions.length}</span>
                </li>
              ))}
            </ol>
          </Summary>

          <Summary title="Handling" onEdit={() => onFix({ step: 'handling' })}>
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

      <aside aria-label="Reporter preview" className="flex flex-[1_1_20rem] flex-col items-center gap-3 lg:sticky lg:top-6">
        <div className="flex w-full max-w-75 items-center justify-between text-sm">
          <span className="font-semibold text-ink">Reporter preview</span>
          <span className="flex rounded-lg bg-active p-0.5">
            {['phone', 'desktop'].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={device === d}
                onClick={() => setDevice(d)}
                className={`h-7 rounded-md px-2.5 text-xs font-medium capitalize ${device === d ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'}`}
              >
                {d}
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
