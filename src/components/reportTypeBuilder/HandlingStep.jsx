// src/components/reportTypeBuilder/HandlingStep.jsx
//
// Step 2 of the report type builder: how reports of this type are handled.
// The old Governance column, regrouped into four short cards by the question
// each answers — who can report, who owns the cases, how fast, and for how
// long records are kept.
//
// None of this is applied to cases yet (no case inherits a tier or an SLA
// clock from its type); it is stored and exported. The page says so.
import { useEffect, useState } from 'react';
import { Archive, Check, Clock, Info, Lock, ShieldCheck, Users, FileText } from 'lucide-react';
import { useOrgRoles, isStaffRole } from '../../hooks/useOrgRoles';
import { reportTypesAPI } from '../../api';
import { parseServerDate } from '../../utils/formatters';
import { AUDIENCES, CONFIDENTIALITY_TIERS } from '../../utils/reportTypes';

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

const NumberRow = ({ id, label, value, onChange, unit }) => (
  <div className="flex items-center justify-between gap-3">
    <label htmlFor={id} className="text-sm text-ink-secondary">
      {label}
    </label>
    <span className="flex shrink-0 items-center gap-2">
      <input
        id={id}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="–"
        className={`${inputClass.replace('w-full', 'w-20')} text-right`}
      />
      <span className="w-9 text-sm text-ink-muted">{unit}</span>
    </span>
  </div>
);

const RoleSelect = ({ id, value, onChange, roles, nameFor, empty }) => (
  <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputClass}>
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

const HandlingStep = ({ draft, codeLocked, nameError }) => {
  const { form, setField } = draft;
  const { roles: allRoles, nameFor } = useOrgRoles();
  const roles = allRoles.filter(isStaffRole);
  const audience = form.audience || [];
  const approvedAt = parseServerDate(form.approved_at);

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

  const toggleAudience = (code) =>
    setField('audience', audience.includes(code) ? audience.filter((a) => a !== code) : [...audience, code]);

  return (
    <div className="mx-auto w-full max-w-260 space-y-5 px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-[-0.01em] text-ink sm:text-2xl">How these reports are handled</h1>
          <p className="mt-1 text-sm text-ink-muted">Change only what your policy needs. Everything here can be edited later.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-secondary">
          <Info className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
          Recorded on the type for audits; not yet applied to cases automatically
        </span>
      </div>

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
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card icon={Users} title="Who can report">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Who can file this type">
            {AUDIENCES.map((option) => {
              const on = audience.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleAudience(option.value)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${
                    on
                      ? 'border-line-accent bg-accent-soft font-medium text-accent-fg'
                      : 'border-line text-ink-secondary hover:border-line-strong hover:text-ink'
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="-mt-1 text-xs text-ink-muted">
            Set here only — spreadsheet imports and exports don't include it.
          </p>
          <Divider />
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-medium text-ink">Allow anonymous reports</span>
              <span className="block text-xs text-ink-muted">Reporters can file without giving their name</span>
            </span>
            <Switch
              checked={form.allows_anonymous ?? true}
              onChange={(on) => setField('allows_anonymous', on)}
              label="Allow anonymous reports"
            />
          </div>
        </Card>

        <Card icon={ShieldCheck} title="Who owns these cases">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rt-owner">Owner</Label>
              <RoleSelect
                id="rt-owner"
                value={form.default_owner_role}
                onChange={(role) => setField('default_owner_role', role)}
                roles={roles}
                nameFor={nameFor}
                empty="Not set"
              />
            </div>
            <div>
              <Label htmlFor="rt-alt-owner">Backup owner</Label>
              <RoleSelect
                id="rt-alt-owner"
                value={form.alternate_owner_role}
                onChange={(role) => setField('alternate_owner_role', role)}
                roles={roles}
                nameFor={nameFor}
                empty="Not set"
              />
            </div>
          </div>
          <p className="-mt-1 text-xs text-ink-muted">The backup takes over when a report names someone in the owner role.</p>
          <Divider />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-secondary" id="rt-tier-label">
              Confidentiality
            </span>
            <div role="radiogroup" aria-labelledby="rt-tier-label" className="grid grid-cols-3 gap-1 rounded-lg bg-active p-1">
              {CONFIDENTIALITY_TIERS.map((tier) => {
                const on = (form.confidentiality_tier || 'standard') === tier.value;
                return (
                  <button
                    key={tier.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setField('confidentiality_tier', tier.value)}
                    className={`rounded-md py-1.5 text-sm transition-colors ${
                      on ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink-muted hover:text-ink'
                    }`}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card icon={Clock} title="Response times">
          <div className="space-y-2.5">
            <NumberRow
              id="rt-ack"
              label="Acknowledge the reporter within"
              unit="days"
              value={form.ack_sla_days}
              onChange={(days) => setField('ack_sla_days', days)}
            />
            <NumberRow
              id="rt-triage"
              label="Triage within"
              unit="days"
              value={form.triage_sla_days}
              onChange={(days) => setField('triage_sla_days', days)}
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
            <p className="mt-1 text-xs text-ink-muted">Shown to case handlers as a reminder. Nobody is notified automatically.</p>
          </div>
        </Card>

        <Card icon={Archive} title="Records">
          <NumberRow
            id="rt-retention"
            label="Keep closed cases for"
            unit="years"
            value={form.retention_years}
            onChange={(years) => setField('retention_years', years)}
          />
          <Divider />
          <div>
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
                  className={`${inputClass} font-mono ${codeLocked ? 'pr-8' : ''}`}
                />
                {codeLocked && <Lock className="absolute right-3 top-2.5 h-4 w-4 text-ink-subtle" aria-hidden="true" />}
              </div>
            </div>
          </div>
          <p className="-mt-1 text-xs text-ink-muted">
            {codeLocked ? 'A compliance code is permanent once set.' : "The code can't be changed once the type is saved."}
          </p>
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
