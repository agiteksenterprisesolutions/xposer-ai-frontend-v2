// src/components/reportTypeBuilder/HandlingStep.jsx
//
// Step 2 of the report type builder: how reports of this type are handled.
// Every setting here is copied onto each new case of the type and enforced
// there — who it is assigned to, who may open it, its deadlines and how long
// it is kept. Cases already filed keep the settings they were filed under.
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, Archive, Clock, FileText, Info, Lock, ShieldCheck, Users } from 'lucide-react';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useOrgJurisdiction } from '../../hooks/useOrgJurisdiction';
import { reportTypesAPI } from '../../api';
import { parseServerDate } from '../../utils/formatters';
import { intlLocale } from '../../utils/locale';
import { CONFIDENTIALITY_TIERS } from '../../utils/reportTypes';
import { retentionProblem } from './model';

const inputClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted';

const Card = ({ icon: Icon, title, children, className = '', tour }) => (
  <section className={`flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`} data-tour={tour}>
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
    </div>
    {children}
  </section>
);

const Label = ({ htmlFor, children, hint }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-secondary">
    {children}
    {hint && <span className="ms-1 font-normal text-ink-muted">{hint}</span>}
  </label>
);

const Divider = () => <div className="border-t border-line-subtle" />;

const FieldNote = ({ error, children }) => (
  <p className={`mt-1 text-xs ${error ? 'text-danger-fg' : 'text-ink-muted'}`}>{error || children}</p>
);

const NumberRow = ({ id, label, value, onChange, unit, hint, error, min = 0, max }) => (
  <div>
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-ink-secondary">
        {label}
      </label>
      <span className="flex shrink-0 items-center gap-2">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step="1"
          inputMode="numeric"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="–"
          aria-invalid={Boolean(error)}
          aria-describedby={hint || error ? `${id}-hint` : undefined}
          className={`${inputClass.replace('w-full', 'w-20')} text-end ${error ? 'border-danger-line' : ''}`}
        />
        <span className="min-w-9 text-sm text-ink-muted">{unit}</span>
      </span>
    </div>
    {(error || hint) && (
      <p id={`${id}-hint`} className={`mt-1 text-xs ${error ? 'text-danger-fg' : 'text-ink-muted'}`}>
        {error || hint}
      </p>
    )}
  </div>
);

const RoleSelect = ({ id, value, onChange, roles, nameFor, empty, error }) => (
  <select
    id={id}
    value={value || ''}
    onChange={(e) => onChange(e.target.value)}
    aria-invalid={Boolean(error)}
    className={`${inputClass} ${error ? 'border-danger-line' : ''}`}
  >
    <option value="">{empty}</option>
    {roles.map((role) => (
      <option key={role.code} value={role.code}>
        {role.name}
      </option>
    ))}
    {value && !roles.some((role) => role.code === value) && <option value={value}>{nameFor(value)}</option>}
  </select>
);

const Switch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-active'}`}
  >
    <span className={`absolute top-1 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${checked ? 'start-6' : 'start-1'}`} />
  </button>
);

/** What each confidentiality level means, under the radio buttons: builder:handling.tierHints.<tier>. */

/**
 * The server's own check of the saved settings (`governance_problems`) — an
 * owner role nobody holds, a role that can't open cases, an anonymity option
 * the type refuses. Errors in red, warnings in amber, worded as sent.
 */
export const GovernanceProblems = ({ problems }) => {
  const { t } = useTranslation('builder');
  if (!problems?.length) return null;
  const errors = problems.filter((p) => p.severity === 'error');
  const warnings = problems.filter((p) => p.severity !== 'error');
  return (
    <section aria-label={t('handling.problemsLabel')} className="flex flex-col gap-2">
      {[...errors, ...warnings].map((problem, i) => {
        const isError = problem.severity === 'error';
        const Icon = isError ? AlertCircle : AlertTriangle;
        return (
          <p
            key={`${problem.code}-${i}`}
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
              isError ? 'border-danger-line bg-danger-soft text-danger-fg' : 'border-warning-line bg-warning-soft text-warning-fg'
            }`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{problem.message}</span>
          </p>
        );
      })}
    </section>
  );
};

/**
 * Props:
 *   draft        – useReportTypeDraft()
 *   codeLocked   – the saved type already has a compliance code
 *   nameError    – shown under Name after a save is tried without one
 *   problems     – governance_problems from the last load or save
 *   serverErrors – { field: message } from a refused save, shown under the field
 *   onClearError – (field) => void, once the field is edited
 */
const HandlingStep = ({ draft, codeLocked, nameError, problems = [], serverErrors = {}, onClearError }) => {
  const { form, setField: setDraftField } = draft;
  const { t } = useTranslation('builder');
  const { roles, nameFor } = useOrgRoles({ source: 'owners' });
  const approvedAt = parseServerDate(form.approved_at);
  const tier = form.confidentiality_tier || 'standard';
  const retentionError = serverErrors.retention_years || retentionProblem(form.retention_years);
  // A case keeps the longer of this and its jurisdiction pack's minimum, so a
  // shorter setting here doesn't shorten anything. Only an active pack counts.
  const { pack, active } = useOrgJurisdiction();
  const packMinimum = active ? pack?.retention?.min_years : null;
  const belowPack = packMinimum != null && Number(form.retention_years) > 0 && Number(form.retention_years) < packMinimum;

  const setField = (field, value) => {
    setDraftField(field, value);
    if (serverErrors[field]) onClearError?.(field);
  };

  // Categories already in use, offered as suggestions so types group consistently.
  const [categories, setCategories] = useState([]);
  useEffect(() => {
    let live = true;
    reportTypesAPI
      .getReportTypes(false, false)
      .then((list) => live && setCategories([...new Set(list.map((type) => type.category?.trim()).filter(Boolean))].sort()))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-260 flex-col gap-5 px-4 py-7 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">{t('handling.title')}</h1>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('handling.intro')}
        </p>
      </div>

      <GovernanceProblems problems={problems} />

      <Card icon={FileText} title={t('handling.aboutType')} tour="rtb-handling-basics">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="rt-name">{t('start.name')}</Label>
            <input
              id="rt-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder={t('start.namePlaceholder')}
              aria-invalid={Boolean(nameError)}
              className={`${inputClass} ${nameError ? 'border-danger-line' : ''}`}
            />
            {nameError && <p className="mt-1 text-xs text-danger-fg">{nameError}</p>}
          </div>
          <div>
            <Label htmlFor="rt-category" hint={t('common:form.optional')}>
              {t('start.category')}
            </Label>
            <input
              id="rt-category"
              list="rt-categories"
              value={form.category || ''}
              onChange={(e) => setField('category', e.target.value)}
              placeholder={t('start.categoryPlaceholder')}
              className={inputClass}
            />
            <datalist id="rt-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="rt-description" hint={t('common:form.optional')}>
              {t('handling.description')}
            </Label>
            <input
              id="rt-description"
              value={form.description || ''}
              onChange={(e) => setField('description', e.target.value)}
              placeholder={t('handling.descriptionPlaceholder')}
              className={inputClass}
            />
          </div>
        </div>
        <Divider />
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-ink">{t('handling.allowAnonymous')}</span>
            <span className="block text-xs text-ink-muted">{t('handling.allowAnonymousHint')}</span>
          </span>
          <Switch
            checked={form.allows_anonymous ?? true}
            onChange={(on) => setField('allows_anonymous', on)}
            label={t('handling.allowAnonymous')}
          />
        </div>
        <Divider />
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-ink">{t('handling.escalate')}</span>
            <span className="block text-xs text-ink-muted">{t('handling.escalateHint')}</span>
          </span>
          <Switch
            checked={form.escalate_on_subject ?? true}
            onChange={(on) => setField('escalate_on_subject', on)}
            label={t('handling.escalate')}
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card icon={Users} title={t('handling.whoOwns')}>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="rt-owner">{t('handling.owner')}</Label>
              <RoleSelect
                id="rt-owner"
                value={form.default_owner_role}
                onChange={(role) => setField('default_owner_role', role)}
                roles={roles}
                nameFor={nameFor}
                empty={t('review.handling.ownerNone')}
                error={serverErrors.default_owner_role}
              />
              <FieldNote error={serverErrors.default_owner_role}>{t('handling.ownerHint')}</FieldNote>
            </div>
            <div>
              <Label htmlFor="rt-alt-owner" hint={t('common:form.optional')}>
                {t('handling.backupOwner')}
              </Label>
              <RoleSelect
                id="rt-alt-owner"
                value={form.alternate_owner_role}
                onChange={(role) => setField('alternate_owner_role', role)}
                roles={roles}
                nameFor={nameFor}
                empty={t('handling.notSet')}
                error={serverErrors.alternate_owner_role}
              />
              <FieldNote error={serverErrors.alternate_owner_role}>
                {t('handling.backupHint')}
              </FieldNote>
            </div>
          </div>
        </Card>

        <Card icon={ShieldCheck} title={t('review.handling.confidentiality')}>
          <p className="-mt-1 text-xs text-ink-muted">{t('handling.confidentialityHint')}</p>
          <div role="radiogroup" aria-label={t('review.handling.confidentiality')} className="flex flex-col gap-2">
            {CONFIDENTIALITY_TIERS.map((option) => {
              const on = tier === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setField('confidentiality_tier', option.value)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-start transition-colors ${
                    on ? 'border-accent bg-accent-soft/60 shadow-[0_0_0_1px_var(--color-accent)]' : 'border-line hover:border-line-strong'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                      on ? 'border-accent' : 'border-line-strong'
                    }`}
                  >
                    {on && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="block text-xs text-ink-muted">{t(`handling.tierHints.${option.value}`)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-muted">
            {t('handling.tierRaise')}
          </p>
        </Card>

        <Card icon={Clock} title={t('handling.responseTimes')}>
          <div className="flex flex-col gap-3">
            <NumberRow
              id="rt-ack"
              label={t('handling.ackWithin')}
              unit={t('handling.daysUnit')}
              value={form.ack_sla_days}
              onChange={(days) => setField('ack_sla_days', days)}
              hint={t('handling.calendarDays')}
            />
            <NumberRow
              id="rt-triage"
              label={t('handling.triageWithin')}
              unit={t('handling.daysUnit')}
              value={form.triage_sla_days}
              onChange={(days) => setField('triage_sla_days', days)}
              hint={t('handling.calendarDays')}
            />
          </div>
          <Divider />
          <div>
            <Label htmlFor="rt-regulatory" hint={t('common:form.optional')}>
              {t('handling.regulatorReminder')}
            </Label>
            <input
              id="rt-regulatory"
              value={form.regulatory_trigger || ''}
              onChange={(e) => setField('regulatory_trigger', e.target.value)}
              placeholder={t('handling.regulatorPlaceholder')}
              className={inputClass}
            />
            <FieldNote>{t('handling.regulatorHint')}</FieldNote>
          </div>
        </Card>

        <Card icon={Archive} title={t('review.handling.records')}>
          <NumberRow
            id="rt-retention"
            label={t('handling.keepFor')}
            unit={t('handling.yearsUnit')}
            min={1}
            max={100}
            value={form.retention_years}
            onChange={(years) => setField('retention_years', years)}
            error={retentionError}
            hint={t('handling.keepHint')}
          />
          {belowPack && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-fg">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('handling.packMinimum', { pack: pack.code, count: packMinimum })}
            </p>
          )}
          <Divider />
          <div>
            <Label htmlFor="rt-code" hint={codeLocked ? t('handling.fixed') : t('common:form.optional')}>
              {t('handling.complianceCode')}
            </Label>
            <div className="relative">
              <input
                id="rt-code"
                value={form.code || ''}
                onChange={(e) => setField('code', e.target.value.toUpperCase())}
                disabled={codeLocked}
                placeholder="e.g. HR-CND-01"
                aria-invalid={Boolean(serverErrors.code)}
                className={`${inputClass} font-mono ${codeLocked ? 'pe-8' : ''} ${serverErrors.code ? 'border-danger-line' : ''}`}
              />
              {codeLocked && <Lock className="absolute end-3 top-2.5 h-4 w-4 text-ink-subtle" aria-hidden="true" />}
            </div>
            <FieldNote error={serverErrors.code}>{t('handling.codeHint')}</FieldNote>
          </div>
          {(form.approved_by || approvedAt) && (
            <p className="border-t border-line-subtle pt-3 text-xs text-ink-muted">
              <Trans
                t={t}
                i18nKey={
                  form.approved_by && approvedAt ? 'handling.approvedByOn' : form.approved_by ? 'handling.approvedBy' : 'handling.approvedOn'
                }
                values={{
                  name: form.approved_by,
                  date: approvedAt?.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }),
                }}
                components={{ b: <span className="font-medium text-ink" /> }}
              />
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default HandlingStep;
