// src/components/forms/ReportTypeGovernance.jsx
//
// The compliance side of a report type: code, status, owners, tier, SLAs,
// retention. Each is copied onto a case when it is filed and enforced there.
import { Info, Lock } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { intlLocale } from '../../utils/locale';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { parseServerDate } from '../../utils/formatters';
import { CONFIDENTIALITY_TIERS, REPORT_TYPE_STATUSES } from '../../utils/reportTypes';

const fieldClass =
  'w-full rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-accent disabled:cursor-not-allowed disabled:opacity-60';

const Label = ({ htmlFor, children, hint }) => (
  <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-ink-secondary">
    {children}
    {hint && <span className="ms-1 font-normal text-ink-subtle">{hint}</span>}
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

const RoleField = ({ id, label, hint, value, onChange, roles, nameFor, disabled, notSet }) => (
  <div>
    <Label htmlFor={id} hint={hint}>
      {label}
    </Label>
    <select id={id} value={value || ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={fieldClass}>
      <option value="">{notSet}</option>
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
  const { roles, nameFor } = useOrgRoles({ source: 'owners' });
  const approvedAt = parseServerDate(value.approved_at);
  const { t } = useTranslation('reportTypes');

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-xs leading-relaxed text-info-fg">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        {t('governance.intro')}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <Label htmlFor="rt-code" hint={codeLocked ? '' : t('governance.codeExample')}>
            {t('governance.code')}
          </Label>
          <div className="relative">
            <input
              id="rt-code"
              value={value.code || ''}
              onChange={(event) => onChange('code', event.target.value.toUpperCase())}
              disabled={readOnly || codeLocked}
              className={`${fieldClass} font-mono ${codeLocked ? 'pe-8' : ''}`}
              placeholder={t('governance.optional')}
            />
            {codeLocked && <Lock className="absolute end-3 top-2.5 h-3.5 w-3.5 text-ink-subtle" aria-hidden="true" />}
          </div>
          {codeLocked ? (
            <p className="mt-1 text-[11px] text-ink-subtle">{t('governance.codeLocked')}</p>
          ) : (
            <p className="mt-1 text-[11px] text-ink-subtle">{t('governance.codePermanent')}</p>
          )}
        </div>

        <div>
          <Label htmlFor="rt-category">{t('governance.category')}</Label>
          <input
            id="rt-category"
            value={value.category || ''}
            onChange={(event) => onChange('category', event.target.value)}
            disabled={readOnly}
            className={fieldClass}
            placeholder={t('governance.categoryExample')}
          />
        </div>

        <div>
          <Label htmlFor="rt-status">{t('governance.status')}</Label>
          <select
            id="rt-status"
            value={value.status || 'active'}
            onChange={(event) => onChange('status', event.target.value)}
            disabled={readOnly}
            className={fieldClass}
          >
            {REPORT_TYPE_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {t(`status.${status.value}`, { defaultValue: status.label })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="rt-tier">{t('governance.tier')}</Label>
          <select
            id="rt-tier"
            value={value.confidentiality_tier || 'standard'}
            onChange={(event) => onChange('confidentiality_tier', event.target.value)}
            disabled={readOnly}
            className={fieldClass}
          >
            {CONFIDENTIALITY_TIERS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {t(`tiers.${tier.value}`, { defaultValue: tier.label })}
              </option>
            ))}
          </select>
        </div>

        <RoleField
          id="rt-owner"
          label={t('governance.defaultOwner')}
          hint={t('governance.defaultOwnerHint')}
          notSet={t('governance.notSet')}
          value={value.default_owner_role}
          onChange={(role) => onChange('default_owner_role', role)}
          roles={roles}
          nameFor={nameFor}
          disabled={readOnly}
        />
        <RoleField
          id="rt-alt-owner"
          label={t('governance.alternateOwner')}
          hint={t('governance.alternateOwnerHint')}
          notSet={t('governance.notSet')}
          value={value.alternate_owner_role}
          onChange={(role) => onChange('alternate_owner_role', role)}
          roles={roles}
          nameFor={nameFor}
          disabled={readOnly}
        />

        <NumberField
          id="rt-ack"
          label={t('governance.ackWithin')}
          suffix={t('governance.days')}
          value={value.ack_sla_days}
          onChange={(days) => onChange('ack_sla_days', days)}
          disabled={readOnly}
        />
        <NumberField
          id="rt-triage"
          label={t('governance.triageWithin')}
          suffix={t('governance.days')}
          value={value.triage_sla_days}
          onChange={(days) => onChange('triage_sla_days', days)}
          disabled={readOnly}
        />
        <NumberField
          id="rt-retention"
          label={t('governance.keepFor')}
          suffix={t('governance.years')}
          value={value.retention_years}
          onChange={(years) => onChange('retention_years', years)}
          disabled={readOnly}
        />

        <div>
          <Label htmlFor="rt-regulatory" hint={t('governance.advisory')}>
            {t('governance.regulatory')}
          </Label>
          <input
            id="rt-regulatory"
            value={value.regulatory_trigger || ''}
            onChange={(event) => onChange('regulatory_trigger', event.target.value)}
            disabled={readOnly}
            className={fieldClass}
            placeholder={t('governance.regulatoryExample')}
          />
          <p className="mt-1 text-[11px] text-ink-subtle">{t('governance.regulatoryHint')}</p>
        </div>
      </div>

      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-ink">{t('governance.anonymous')}</span>
          <span className="block text-xs text-ink-muted">{t('governance.anonymousHint')}</span>
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
          {(() => {
            const date = approvedAt
              ? approvedAt.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
              : null;
            const by = value.approved_by ? <span className="font-medium text-ink" dir="auto" /> : null;
            const key = value.approved_by ? (date ? 'governance.approvedByOn' : 'governance.approvedBy') : 'governance.approvedOn';
            return (
              <Trans t={t} i18nKey={key} values={{ name: value.approved_by, date }} components={by ? { name: by } : {}} />
            );
          })()}
        </p>
      )}
    </div>
  );
};

export default ReportTypeGovernance;
