// src/components/forms/ReportTypeGovernance.jsx
//
// The compliance side of a report type: code, status, owners, tier, SLAs,
// audience, retention. All of it is stored and exported, but nothing on the
// submission side reads it yet — no case inherits a tier or an SLA clock from
// its type. The panel says so, so nobody assumes these are in force.
//
// `audience` can only be set here: it is not in the import/export workbook.
import { Info, Lock } from 'lucide-react';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { parseServerDate } from '../../utils/formatters';
import { AUDIENCES, CONFIDENTIALITY_TIERS, REPORT_TYPE_STATUSES } from '../../utils/reportTypes';

const fieldClass =
  'w-full rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-accent disabled:cursor-not-allowed disabled:opacity-60';

const Label = ({ htmlFor, children, hint }) => (
  <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-ink-secondary">
    {children}
    {hint && <span className="ml-1 font-normal text-ink-subtle">{hint}</span>}
  </label>
);

const NumberField = ({ id, label, value, onChange, suffix, disabled }) => (
  <div>
    <Label htmlFor={id}>{label}</Label>
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="number"
        min="0"
        step="1"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={fieldClass}
      />
      <span className="shrink-0 text-xs text-ink-subtle">{suffix}</span>
    </div>
  </div>
);

const RoleField = ({ id, label, hint, value, onChange, roles, nameFor, disabled }) => (
  <div>
    <Label htmlFor={id} hint={hint}>
      {label}
    </Label>
    <select id={id} value={value || ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={fieldClass}>
      <option value="">Not set</option>
      {roles.map((role) => (
        <option key={role.code} value={role.code}>
          {role.name}
        </option>
      ))}
      {value && !roles.some((role) => role.code === value) && <option value={value}>{nameFor(value)}</option>}
    </select>
  </div>
);

/**
 * Props:
 *   value     – the builder's form data (reads the governance fields)
 *   onChange  – (field, value) => void
 *   codeLocked – the type already had a code; treat it as permanent
 *   readOnly
 */
const ReportTypeGovernance = ({ value, onChange, codeLocked = false, readOnly = false }) => {
  const { roles, nameFor } = useOrgRoles();
  const audience = value.audience || [];
  const approvedAt = parseServerDate(value.approved_at);

  const toggleAudience = (code) =>
    onChange('audience', audience.includes(code) ? audience.filter((a) => a !== code) : [...audience, code]);

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-xs leading-relaxed text-info-fg">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        Saved and exported with the type, but not applied to reports yet — cases don't inherit the tier, SLAs, owners or
        retention set here.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <Label htmlFor="rt-code" hint={codeLocked ? '' : 'e.g. FRD-CLM-01'}>
            Compliance code
          </Label>
          <div className="relative">
            <input
              id="rt-code"
              value={value.code || ''}
              onChange={(event) => onChange('code', event.target.value.toUpperCase())}
              disabled={readOnly || codeLocked}
              className={`${fieldClass} font-mono ${codeLocked ? 'pr-8' : ''}`}
              placeholder="Optional"
            />
            {codeLocked && <Lock className="absolute right-3 top-2.5 h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />}
          </div>
          {codeLocked ? (
            <p className="mt-1 text-[11px] text-ink-subtle">A code is permanent once set.</p>
          ) : (
            <p className="mt-1 text-[11px] text-ink-subtle">Can't be changed after it's saved.</p>
          )}
        </div>

        <div>
          <Label htmlFor="rt-category">Category</Label>
          <input
            id="rt-category"
            value={value.category || ''}
            onChange={(event) => onChange('category', event.target.value)}
            disabled={readOnly}
            className={fieldClass}
            placeholder="e.g. Fraud"
          />
        </div>

        <div>
          <Label htmlFor="rt-status">Status</Label>
          <select
            id="rt-status"
            value={value.status || 'active'}
            onChange={(event) => onChange('status', event.target.value)}
            disabled={readOnly}
            className={fieldClass}
          >
            {REPORT_TYPE_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="rt-tier">Confidentiality tier</Label>
          <select
            id="rt-tier"
            value={value.confidentiality_tier || 'standard'}
            onChange={(event) => onChange('confidentiality_tier', event.target.value)}
            disabled={readOnly}
            className={fieldClass}
          >
            {CONFIDENTIALITY_TIERS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
              </option>
            ))}
          </select>
        </div>

        <RoleField
          id="rt-owner"
          label="Default owner"
          hint="a role"
          value={value.default_owner_role}
          onChange={(role) => onChange('default_owner_role', role)}
          roles={roles}
          nameFor={nameFor}
          disabled={readOnly}
        />
        <RoleField
          id="rt-alt-owner"
          label="Alternate owner"
          hint="if the default is implicated"
          value={value.alternate_owner_role}
          onChange={(role) => onChange('alternate_owner_role', role)}
          roles={roles}
          nameFor={nameFor}
          disabled={readOnly}
        />

        <NumberField
          id="rt-ack"
          label="Acknowledge within"
          suffix="days"
          value={value.ack_sla_days}
          onChange={(days) => onChange('ack_sla_days', days)}
          disabled={readOnly}
        />
        <NumberField
          id="rt-triage"
          label="Triage within"
          suffix="days"
          value={value.triage_sla_days}
          onChange={(days) => onChange('triage_sla_days', days)}
          disabled={readOnly}
        />
        <NumberField
          id="rt-retention"
          label="Keep records for"
          suffix="years"
          value={value.retention_years}
          onChange={(years) => onChange('retention_years', years)}
          disabled={readOnly}
        />

        <div>
          <Label htmlFor="rt-regulatory" hint="advisory">
            Regulatory trigger
          </Label>
          <input
            id="rt-regulatory"
            value={value.regulatory_trigger || ''}
            onChange={(event) => onChange('regulatory_trigger', event.target.value)}
            disabled={readOnly}
            className={fieldClass}
            placeholder="e.g. Notify the regulator within 72 hours"
          />
          <p className="mt-1 text-[11px] text-ink-subtle">A reminder for handlers. Nobody is notified automatically.</p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-ink-secondary">Who can file it</legend>
        <div className="flex flex-wrap gap-1.5">
          {AUDIENCES.map((option) => {
            const on = audience.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={readOnly}
                onClick={() => toggleAudience(option.value)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                  on
                    ? 'border-line-accent bg-accent-soft text-accent-fg'
                    : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-subtle">
          Only set here — spreadsheet imports and exports don't include it.
        </p>
      </fieldset>

      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-ink">Allow anonymous reports</span>
          <span className="block text-xs text-ink-muted">Reporters may file without giving their identity.</span>
        </span>
        <input
          type="checkbox"
          checked={value.allows_anonymous ?? true}
          onChange={(event) => onChange('allows_anonymous', event.target.checked)}
          disabled={readOnly}
          className="h-4 w-4 accent-[var(--color-accent)]"
        />
      </label>

      {(value.approved_by || approvedAt) && (
        <p className="border-t border-line-subtle pt-3 text-xs text-ink-muted">
          Approved{value.approved_by && <> by <span className="font-medium text-ink">{value.approved_by}</span></>}
          {approvedAt && ` on ${approvedAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </p>
      )}
    </div>
  );
};

export default ReportTypeGovernance;
