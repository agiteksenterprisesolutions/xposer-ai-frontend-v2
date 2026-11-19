// src/components/reports/CaseGovernance.jsx
//
// What a case inherited from its report type, as small pieces the case list,
// My Cases and the case page share: its confidentiality level, its two
// deadlines (acknowledge the reporter, triage) and who owns it.
//
// The backend computes each deadline's state on read (`sla_status`), so these
// only display it — no clock arithmetic happens here.
import { Check, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { intlLocale } from '../../utils/locale';
import Badge from '../ui/Badge';
import { parseServerDate } from '../../utils/formatters';

// Labels built outside components are translated when read, not at load.
const tc = (key, options) => i18n.t(key, { ns: 'cases', ...options });

// ─── Confidentiality ─────────────────────────────────────────────────────

/** Nothing for standard (and for old cases, which have no level). */
export const TierBadge = ({ tier, size = 'small' }) => {
  const { t } = useTranslation('cases');
  if (tier === 'confidential') {
    return (
      <Badge variant="warning" size={size} title={t('tier.confidentialTitle')}>
        <Lock className="h-2.5 w-2.5" aria-hidden="true" />
        {t('tier.confidential')}
      </Badge>
    );
  }
  if (tier === 'restricted') {
    return (
      <Badge variant="danger" size={size} title={t('tier.restrictedTitle')}>
        <Lock className="h-2.5 w-2.5" aria-hidden="true" />
        {t('tier.restricted')}
      </Badge>
    );
  }
  return null;
};

// ─── Deadlines ───────────────────────────────────────────────────────────

// `label` and `short` are getters so they follow the interface language.
const clockDef = (key) => ({
  key,
  get label() { return tc(`sla.clock.${key}`); },
  get short() { return tc(`sla.clockShort.${key}`); },
});
export const SLA_CLOCKS = [clockDef('acknowledge'), clockDef('triage')];

/** The `?sla=` filter values, in the order the filter offers them. */
export const SLA_FILTERS = ['breached', 'due_soon', 'on_track', 'met', 'met_late'].map((value) => ({
  value,
  get label() { return tc(`sla.filter.${value}`); },
}));

export const slaClock = (report, key) => report?.sla_status?.[key] || null;

export const formatWhen = (value, { time = true } = {}) => {
  const date = parseServerDate(value);
  if (!date) return '';
  return date.toLocaleString(intlLocale(), {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

const SLA_STATES = {
  on_track: { variant: 'default', label: (clock) => tc('sla.state.dueOn', { date: formatWhen(clock.due_at, { time: false }) }) },
  due_soon: { variant: 'warning', label: () => tc('sla.state.due_soon') },
  breached: { variant: 'danger', label: () => tc('sla.state.breached') },
  met: { variant: 'success', label: () => tc('sla.state.met'), icon: true },
  met_late: { variant: 'default', label: () => tc('sla.state.met_late') },
  stopped: { variant: 'default', label: () => tc('sla.state.stopped') },
};

const slaExplain = (state) => tc(`sla.explain.${state}`);

/** One clock's state. Nothing when the type sets no deadline. */
export const SlaBadge = ({ clock, prefix, size = 'small' }) => {
  useTranslation('cases'); // re-render on a language change
  const state = SLA_STATES[clock?.state];
  if (!state) return null;
  const due = formatWhen(clock.due_at);
  return (
    <Badge
      variant={state.variant}
      size={size}
      title={due ? tc('sla.explainDue', { explain: slaExplain(clock.state), due }) : slaExplain(clock.state)}
    >
      {state.icon && <Check className="h-2.5 w-2.5" aria-hidden="true" />}
      {prefix && <span className="font-medium">{prefix}</span>}
      {state.label(clock)}
    </Badge>
  );
};

/** For sorting: 0 overdue, 1 due soon, 2 on track, 3 nothing pending. */
export const slaUrgency = (report) => {
  const states = SLA_CLOCKS.map(({ key }) => slaClock(report, key)?.state);
  if (states.includes('breached')) return 0;
  if (states.includes('due_soon')) return 1;
  if (states.includes('on_track')) return 2;
  return 3;
};

/** Both clocks, stacked, for a table cell. A dash when neither is set. */
export const SlaCell = ({ report }) => {
  const shown = SLA_CLOCKS.filter(({ key }) => SLA_STATES[slaClock(report, key)?.state]);
  if (!shown.length) return <span className="text-ink-subtle">—</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {shown.map(({ key, short }) => (
        <SlaBadge key={key} clock={slaClock(report, key)} prefix={short} />
      ))}
    </div>
  );
};

// ─── Owner ───────────────────────────────────────────────────────────────

/** Assigned by routing rather than by a person. */
export const isAutoAssigned = (report) => report?.assigned_by?.id === 'system';

export const ownerName = (report, nameFor = (code) => code) =>
  report?.assigned_to?.full_name ||
  report?.assigned_to?.username ||
  (report?.routed_to_role ? nameFor(report.routed_to_role) : '');

/** The assignee, else the role the case was routed to; "auto" when routing chose. */
export const OwnerCell = ({ report, nameFor }) => {
  const { t } = useTranslation('cases');
  const name = ownerName(report, nameFor);
  if (!name) return <span className="text-ink-subtle">{t('owner.unassigned')}</span>;
  const waiting = !report?.assigned_to && report?.routed_to_role;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={waiting ? 'text-ink-muted' : ''} title={waiting ? t('owner.waitingRole') : undefined}>
        {name}
      </span>
      {isAutoAssigned(report) && (
        <span
          className="rounded bg-active px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-ink-muted"
          title={t('owner.autoTitle')}
        >
          {t('owner.auto')}
        </span>
      )}
    </span>
  );
};

// ─── Sensitive answers ───────────────────────────────────────────────────

export const maskedHint = () => tc('masked.hint');

/** Answer keys the server hid from this viewer. */
export const maskedKeys = (report) => new Set(Array.isArray(report?.masked_fields) ? report.masked_fields : []);

/** A hidden answer: "••••" or "••••1234", with a lock and the reason on hover. */
export const MaskedValue = ({ value }) => {
  const { t } = useTranslation('cases');
  const hint = t('masked.hint');
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-sm text-ink-muted" title={hint}>
      <Lock className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
      <span dir="ltr">{typeof value === 'string' && value ? value : '••••'}</span>
      <span className="sr-only">{hint}</span>
    </span>
  );
};
