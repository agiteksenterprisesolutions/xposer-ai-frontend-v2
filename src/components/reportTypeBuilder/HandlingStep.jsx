// src/components/reportTypeBuilder/HandlingStep.jsx
//
// Step 2 of the report type builder: how reports of this type are handled.
// Every setting here is copied onto each new case of the type and enforced
// there — who it is assigned to, who may open it, its deadlines and how long
// it is kept. Cases already filed keep the settings they were filed under.
import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Archive, Clock, FileText, Info, Lock, ShieldCheck, Users } from 'lucide-react';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { reportTypesAPI } from '../../api';
import { parseServerDate } from '../../utils/formatters';
import { CONFIDENTIALITY_TIERS } from '../../utils/reportTypes';
import { retentionProblem } from './model';

const inputClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted';

const Card = ({ icon: Icon, title, children, className = '', tour }) => (
  <section className={`space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`} data-tour={tour}>
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
    {hint && <span className="ml-1 font-normal text-ink-muted">{hint}</span>}
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
          className={`${inputClass.replace('w-full', 'w-20')} text-right ${error ? 'border-danger-line' : ''}`}
        />
        <span className="w-9 text-sm text-ink-muted">{unit}</span>
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
    <span className={`absolute top-1 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${checked ? 'left-6' : 'left-1'}`} />
  </button>
);

/** What each confidentiality level means, under the radio buttons. */
const TIER_HINTS = {
  standard: 'Anyone who handles cases.',
  confidential: 'Only staff cleared for confidential cases.',
  restricted: 'Only staff cleared for restricted cases.',
};

/**
 * The server's own check of the saved settings (`governance_problems`) — an
 * owner role nobody holds, a role that can't open cases, an anonymity option
 * the type refuses. Errors in red, warnings in amber, worded as sent.
 */
export const GovernanceProblems = ({ problems }) => {
  if (!problems?.length) return null;
  const errors = problems.filter((p) => p.severity === 'error');
  const warnings = problems.filter((p) => p.severity !== 'error');
  return (
    <section aria-label="Problems with these settings" className="space-y-2">
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
  const { roles, nameFor } = useOrgRoles();
  const approvedAt = parseServerDate(form.approved_at);
  const tier = form.confidentiality_tier || 'standard';
  const retentionError = serverErrors.retention_years || retentionProblem(form.retention_years);

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
      .then((list) => live && setCategories([...new Set(list.map((t) => t.category?.trim()).filter(Boolean))].sort()))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-260 space-y-5 px-4 py-7 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">How these reports are handled</h1>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          These settings apply to every new case of this type. Cases already filed keep the settings they were filed under.
        </p>
      </div>

      <GovernanceProblems problems={problems} />

      <Card icon={FileText} title="About this type" tour="rtb-handling-basics">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="rt-name">Name</Label>
            <input
              id="rt-name"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Workplace harassment"
              aria-invalid={Boolean(nameError)}
              className={`${inputClass} ${nameError ? 'border-danger-line' : ''}`}
            />
            {nameError && <p className="mt-1 text-xs text-danger-fg">{nameError}</p>}
          </div>
          <div>
            <Label htmlFor="rt-category" hint="optional">
              Category
            </Label>
            <input
              id="rt-category"
              list="rt-categories"
              value={form.category || ''}
              onChange={(e) => setField('category', e.target.value)}
              placeholder="e.g. Fraud, Conduct, Health & safety"
              className={inputClass}
            />
            <datalist id="rt-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="rt-description" hint="optional">
              Description
            </Label>
            <input
              id="rt-description"
              value={form.description || ''}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="One line on when to choose this type"
              className={inputClass}
            />
          </div>
        </div>
        <Divider />
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-ink">Allow anonymous reports</span>
            <span className="block text-xs text-ink-muted">When off, reporters must sign in to file this type.</span>
          </span>
          <Switch
            checked={form.allows_anonymous ?? true}
            onChange={(on) => setField('allows_anonymous', on)}
            label="Allow anonymous reports"
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card icon={Users} title="Who owns these cases">
          <div className="space-y-4">
            <div>
              <Label htmlFor="rt-owner">Owner</Label>
              <RoleSelect
                id="rt-owner"
                value={form.default_owner_role}
                onChange={(role) => setField('default_owner_role', role)}
                roles={roles}
                nameFor={nameFor}
                empty="Not set — cases wait unassigned"
                error={serverErrors.default_owner_role}
              />
              <FieldNote error={serverErrors.default_owner_role}>New cases are assigned to someone in this role.</FieldNote>
            </div>
            <div>
              <Label htmlFor="rt-alt-owner" hint="optional">
                Backup owner
              </Label>
              <RoleSelect
                id="rt-alt-owner"
                value={form.alternate_owner_role}
                onChange={(role) => setField('alternate_owner_role', role)}
                roles={roles}
                nameFor={nameFor}
                empty="Not set"
                error={serverErrors.alternate_owner_role}
              />
              <FieldNote error={serverErrors.alternate_owner_role}>
                The backup takes over when a report names someone in the owner role.
              </FieldNote>
            </div>
          </div>
        </Card>

        <Card icon={ShieldCheck} title="Confidentiality">
          <p className="-mt-1 text-xs text-ink-muted">Only staff cleared for this level can see these cases.</p>
          <div role="radiogroup" aria-label="Confidentiality" className="space-y-2">
            {CONFIDENTIALITY_TIERS.map((option) => {
              const on = tier === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setField('confidentiality_tier', option.value)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
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
                    <span className="block text-xs text-ink-muted">{TIER_HINTS[option.value]}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-muted">
            A report naming a senior person can be raised to a higher level automatically, never lowered.
          </p>
        </Card>

        <Card icon={Clock} title="Response times">
          <div className="space-y-3">
            <NumberRow
              id="rt-ack"
              label="Acknowledge the reporter within"
              unit="days"
              value={form.ack_sla_days}
              onChange={(days) => setField('ack_sla_days', days)}
              hint="Calendar days from submission."
            />
            <NumberRow
              id="rt-triage"
              label="Triage within"
              unit="days"
              value={form.triage_sla_days}
              onChange={(days) => setField('triage_sla_days', days)}
              hint="Calendar days from submission."
            />
          </div>
          <Divider />
          <div>
            <Label htmlFor="rt-regulatory" hint="optional">
              Regulator reminder
            </Label>
            <input
              id="rt-regulatory"
              value={form.regulatory_trigger || ''}
              onChange={(e) => setField('regulatory_trigger', e.target.value)}
              placeholder="e.g. Notify the regulator within 72 hours if personal data is involved"
              className={inputClass}
            />
            <FieldNote>Shown to case handlers as a reminder. Nobody is notified automatically.</FieldNote>
          </div>
        </Card>

        <Card icon={Archive} title="Records">
          <NumberRow
            id="rt-retention"
            label="Keep closed cases for"
            unit="years"
            min={1}
            max={100}
            value={form.retention_years}
            onChange={(years) => setField('retention_years', years)}
            error={retentionError}
            hint="After this, the case's answers, messages and files are permanently deleted."
          />
          <Divider />
          <div>
            <Label htmlFor="rt-code" hint={codeLocked ? 'fixed' : 'optional'}>
              Compliance code
            </Label>
            <div className="relative">
              <input
                id="rt-code"
                value={form.code || ''}
                onChange={(e) => setField('code', e.target.value.toUpperCase())}
                disabled={codeLocked}
                placeholder="e.g. HR-CND-01"
                aria-invalid={Boolean(serverErrors.code)}
                className={`${inputClass} font-mono ${codeLocked ? 'pr-8' : ''} ${serverErrors.code ? 'border-danger-line' : ''}`}
              />
              {codeLocked && <Lock className="absolute right-3 top-2.5 h-4 w-4 text-ink-subtle" aria-hidden="true" />}
            </div>
            <FieldNote error={serverErrors.code}>A compliance code is permanent once set.</FieldNote>
          </div>
          {(form.approved_by || approvedAt) && (
            <p className="border-t border-line-subtle pt-3 text-xs text-ink-muted">
              Approved{form.approved_by && <> by <span className="font-medium text-ink">{form.approved_by}</span></>}
              {approvedAt && ` on ${approvedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default HandlingStep;
