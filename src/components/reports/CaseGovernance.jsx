// src/components/reports/CaseGovernance.jsx
//
// What a case inherited from its report type, as small pieces the case list,
// My Cases and the case page share: its confidentiality level, its two
// deadlines (acknowledge the reporter, triage) and who owns it.
//
// The backend computes each deadline's state on read (`sla_status`), so these
// only display it — no clock arithmetic happens here.
import { Check, Lock } from 'lucide-react';
import Badge from '../ui/Badge';
import { parseServerDate } from '../../utils/formatters';

// ─── Confidentiality ─────────────────────────────────────────────────────

/** Nothing for standard (and for old cases, which have no level). */
export const TierBadge = ({ tier, size = 'small' }) => {
  if (tier === 'confidential') {
    return (
      <Badge variant="warning" size={size} title="Only staff cleared for confidential cases can see this">
        <Lock className="h-2.5 w-2.5" aria-hidden="true" />
        Confidential
      </Badge>
    );
  }
  if (tier === 'restricted') {
    return (
      <Badge variant="danger" size={size} title="Only staff cleared for restricted cases can see this">
        <Lock className="h-2.5 w-2.5" aria-hidden="true" />
        Restricted
      </Badge>
    );
  }
  return null;
};

// ─── Deadlines ───────────────────────────────────────────────────────────

export const SLA_CLOCKS = [
  { key: 'acknowledge', label: 'Acknowledge', short: 'Ack' },
  { key: 'triage', label: 'Triage', short: 'Triage' },
];

/** The `?sla=` filter values, in the order the filter offers them. */
export const SLA_FILTERS = [
  { value: 'breached', label: 'Overdue' },
  { value: 'due_soon', label: 'Due soon' },
  { value: 'on_track', label: 'On track' },
  { value: 'met', label: 'Met' },
  { value: 'met_late', label: 'Met late' },
];

export const slaClock = (report, key) => report?.sla_status?.[key] || null;

export const formatWhen = (value, { time = true } = {}) => {
  const date = parseServerDate(value);
  if (!date) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
};

const SLA_STATES = {
  on_track: { variant: 'default', label: (clock) => `Due ${formatWhen(clock.due_at, { time: false })}` },
  due_soon: { variant: 'warning', label: () => 'Due soon' },
  breached: { variant: 'danger', label: () => 'Overdue' },
  met: { variant: 'success', label: () => 'Met', icon: true },
  met_late: { variant: 'default', label: () => 'Late' },
  stopped: { variant: 'default', label: () => 'Not recorded' },
};

const SLA_EXPLAIN = {
  on_track: 'Open, due in more than 24 hours',
  due_soon: 'Open, due within 24 hours',
  breached: 'Open, and the deadline has passed',
  met: 'Done on time',
  met_late: 'Done after the deadline',
  stopped: 'Resolved or closed without this step being recorded',
};

/** One clock's state. Nothing when the type sets no deadline. */
export const SlaBadge = ({ clock, prefix, size = 'small' }) => {
  const state = SLA_STATES[clock?.state];
  if (!state) return null;
  const due = formatWhen(clock.due_at);
  return (
    <Badge
      variant={state.variant}
      size={size}
      title={`${SLA_EXPLAIN[clock.state]}${due ? ` · due ${due}` : ''}`}
    >
      {state.icon && <Check className="h-2.5 w-2.5" aria-hidden="true" />}
      {prefix && <span className="font-medium opacity-80">{prefix}</span>}
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
  const name = ownerName(report, nameFor);
  if (!name) return <span className="text-ink-subtle">Unassigned</span>;
  const waiting = !report?.assigned_to && report?.routed_to_role;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={waiting ? 'text-ink-muted' : ''} title={waiting ? 'Waiting for someone in this role' : undefined}>
        {name}
      </span>
      {isAutoAssigned(report) && (
        <span
          className="rounded bg-active px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-ink-muted"
          title="Assigned automatically from the report type's owner role"
        >
          auto
        </span>
      )}
    </span>
  );
};

// ─── Sensitive answers ───────────────────────────────────────────────────

export const MASKED_HINT = 'Hidden: you need the View sensitive answers permission.';

/** Answer keys the server hid from this viewer. */
export const maskedKeys = (report) => new Set(Array.isArray(report?.masked_fields) ? report.masked_fields : []);

/** A hidden answer: "••••" or "••••1234", with a lock and the reason on hover. */
export const MaskedValue = ({ value }) => (
  <span className="inline-flex items-center gap-1.5 font-mono text-sm text-ink-muted" title={MASKED_HINT}>
    <Lock className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
    {typeof value === 'string' && value ? value : '••••'}
    <span className="sr-only">{MASKED_HINT}</span>
  </span>
);
