// src/components/reports/CasePanels.jsx
//
// The case page's governance panels — what the case inherited from its report
// type when it was filed:
//
//   CaseNotices    the regulator reminder, voice eligibility warnings
//   DeadlinesCard  acknowledge / triage, and "Mark as acknowledged"
//   RecordsCard    when the content is deleted, the legal hold, and the
//                  jurisdiction pack the case was filed under
//   DisposedCase   the read-only page once retention has destroyed the content
//
// Nothing here works out a deadline or a deletion date; the server sends both
// and these display them.
import { useState } from 'react';
import { ArrowLeft, Archive, CalendarClock, CheckCircle2, Gavel, Info, Landmark, Mic } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { reportsAPI } from '../../api';
import { errorSummary } from '../../utils/errors';
import { SLA_CLOCKS, SlaBadge, TierBadge, formatWhen, slaClock } from './CaseGovernance';

// ─── Notices above the case ──────────────────────────────────────────────

export const CaseNotices = ({ report }) => {
  const { t } = useTranslation('cases');
  const warnings = Array.isArray(report?.eligibility_warnings) ? report.eligibility_warnings.filter(Boolean) : [];
  if (!report?.regulatory_trigger && !warnings.length) return null;
  return (
    <div className="space-y-3">
      {report.regulatory_trigger && (
        <div className="flex items-start gap-3 rounded-xl border border-info-line bg-info-soft px-4 py-3 text-sm text-info-fg">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">{t('notices.regulator')} </span>
            <span dir="auto">{report.regulatory_trigger}</span>
            <span className="mt-0.5 block text-xs">{t('notices.regulatorNote')}</span>
          </p>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-fg">
          <Mic className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t('notices.checkCall')}</p>
            <ul className="mt-1 list-disc space-y-0.5 ps-4">
              {warnings.map((warning, i) => (
                <li key={i} dir="auto">{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Deadlines ───────────────────────────────────────────────────────────

// Where each clock's length and basis sit on report.sla.
const SLA_FIELDS = {
  acknowledge: { days: 'ack_days', basis: 'ack_basis' },
  triage: { days: 'triage_days', basis: 'triage_basis' },
};

/**
 * "7 business days" / "7 calendar days". Cases filed without an active
 * jurisdiction pack carry no basis and count calendar days, as before.
 */
export const deadlineLength = (sla, days, basis) => {
  const n = sla?.[days];
  if (n === null || n === undefined) return null;
  const kind = sla?.[basis] === 'business' ? 'business' : 'calendar';
  return i18n.t(`deadlines.length.${kind}`, { ns: 'cases', count: n });
};

const ClockRow = ({ clock, label, note, length }) => {
  const { t } = useTranslation('cases');
  const set = clock && clock.state && clock.state !== 'not_set';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">
          {label}
          {length && <span className="ms-1.5 text-xs font-normal text-ink-muted">· {length}</span>}
        </p>
        {set ? <SlaBadge clock={clock} size="medium" /> : <span className="text-xs text-ink-subtle">{t('deadlines.noDeadline')}</span>}
      </div>
      {set && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-xs">
          {clock.due_at && (
            <>
              <dt className="text-ink-muted">{t('deadlines.due')}</dt>
              <dd className="text-ink-secondary">{formatWhen(clock.due_at)}</dd>
            </>
          )}
          {clock.done_at && (
            <>
              <dt className="text-ink-muted">{t('deadlines.done')}</dt>
              <dd className="text-ink-secondary">{formatWhen(clock.done_at)}</dd>
            </>
          )}
        </dl>
      )}
      <p className="text-xs text-ink-subtle">{note}</p>
    </div>
  );
};

/**
 * Props:
 *   report          – the case
 *   canAcknowledge  – report:manage
 *   onUpdated(case) – the case as the server returned it
 */
export const DeadlinesCard = ({ report, canAcknowledge, onUpdated }) => {
  const { t } = useTranslation('cases');
  const [busy, setBusy] = useState(false);
  const ack = slaClock(report, 'acknowledge');
  const sla = report?.sla || {};
  const calendar = sla.calendar || null;
  const businessDays = Object.values(SLA_FIELDS).some(({ basis }) => sla[basis] === 'business') || sla.feedback_basis === 'business';
  const feedbackLength = deadlineLength(sla, 'feedback_days', 'feedback_basis');
  const showAcknowledge = canAcknowledge && !ack?.done_at;

  const acknowledge = async () => {
    setBusy(true);
    try {
      const result = await reportsAPI.acknowledgeReport(report.id);
      toast.success(result?.acknowledgement_recorded === false ? t('deadlines.alreadyAcknowledged') : t('deadlines.acknowledged'));
      onUpdated?.(result);
    } catch (err) {
      toast.error(errorSummary(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent-fg" />
          {t('deadlines.title')}
        </Card.Title>
        <Card.Description>
          {calendar
            ? t('deadlines.descriptionPack', { pack: calendar.pack_code, version: calendar.pack_version })
            : t('deadlines.descriptionType')}
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        {SLA_CLOCKS.map(({ key, label }) => (
          <ClockRow
            key={key}
            clock={slaClock(report, key)}
            label={label}
            note={t(`deadlines.note.${key}`)}
            length={SLA_FIELDS[key] && deadlineLength(sla, SLA_FIELDS[key].days, SLA_FIELDS[key].basis)}
          />
        ))}
        {/* For information only: nothing reminds anyone about it yet. */}
        {(sla.feedback_due_at || feedbackLength) && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">
                {t('deadlines.feedback')}
                {feedbackLength && <span className="ms-1.5 text-xs font-normal text-ink-muted">· {feedbackLength}</span>}
              </p>
              {sla.feedback_due_at && <span className="text-xs text-ink-secondary">{t('deadlines.dueOn', { date: formatWhen(sla.feedback_due_at) })}</span>}
            </div>
            <p className="text-xs text-ink-subtle">{t('deadlines.feedbackNote')}</p>
          </div>
        )}
        {businessDays && (
          <p className="border-t border-line-subtle pt-3 text-xs text-ink-muted">
            {calendar ? t('deadlines.businessDaysPack', { pack: calendar.pack_code }) : t('deadlines.businessDays')}
          </p>
        )}
        {showAcknowledge && (
          <div className="space-y-1.5 border-t border-line-subtle pt-4">
            <Button variant="secondary" size="small" startIcon={CheckCircle2} onClick={acknowledge} isLoading={busy} fullWidth>
              {t('deadlines.markAcknowledged')}
            </Button>
            <p className="text-xs text-ink-muted">{t('deadlines.markAcknowledgedNote')}</p>
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

// ─── Records: retention and legal hold ───────────────────────────────────

const formatDay = (value) => formatWhen(value, { time: false });

/**
 * Props:
 *   report          – the case
 *   canHold         – report:manage with report:read_all (assigned-only gets 403)
 *   onUpdated(case) – after the hold changes
 */
export const RecordsCard = ({ report, canHold, onUpdated }) => {
  const { t } = useTranslation('cases');
  const [busy, setBusy] = useState(false);
  const closed = report?.status === 'closed';
  const onHold = Boolean(report?.legal_hold);
  const jurisdiction = report?.jurisdiction || null;
  if (!closed && !onHold && !canHold && !jurisdiction) return null;

  const setHold = async (hold) => {
    setBusy(true);
    try {
      const updated = await reportsAPI.updateReport(report.id, { legal_hold: hold }, { quiet: true });
      toast.success(hold ? t('records.holdPlaced') : t('records.holdLifted'));
      onUpdated?.(updated);
    } catch (err) {
      toast.error(errorSummary(err));
    } finally {
      setBusy(false);
    }
  };

  // Retention 0 anywhere in the chain (type, entity or tenant) means "keep
  // forever": the case is never redacted (ENTITIES.md §3).
  const forever = report.retention_forever === true;
  let line;
  if (onHold) line = t('records.onHold');
  else if (forever) line = t('records.forever');
  else if (closed && report.retain_until) line = t('records.deletedOn', { date: formatDay(report.retain_until) });
  else if (closed) line = t('records.noRetention');
  else if (report.retain_until) line = t('records.deletedOn', { date: formatDay(report.retain_until) });
  // The pack decides whether retention counts from submission or from closure,
  // and the case doesn't say which, so don't claim either.
  else line = t('records.noDate');

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-accent-fg" />
          {t('records.title')}
        </Card.Title>
      </Card.Header>
      <Card.Content className="space-y-3">
        <p className={`flex items-start gap-2 text-sm ${onHold ? 'font-medium text-ink' : 'text-ink-secondary'}`}>
          {onHold ? (
            <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-warning-fg" aria-hidden="true" />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
          )}
          {line}
        </p>
        {closed && report.retention_years && !onHold && !forever && (
          <p className="text-xs text-ink-muted">
            {t('records.closedKept', { date: formatDay(report.closed_at), count: report.retention_years })}
          </p>
        )}
        {/* The jurisdiction pack the case was filed under, when one applied. */}
        {jurisdiction && (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-line-subtle pt-3 text-xs">
            <dt className="text-ink-muted">{t('records.jurisdiction')}</dt>
            <dd className="text-ink-secondary">
              <span className="font-mono">{jurisdiction.pack_code}</span>
              {jurisdiction.pack_version != null && ` · ${t('records.version', { version: jurisdiction.pack_version })}`}
            </dd>
            {jurisdiction.regulators?.length > 0 && (
              <>
                <dt className="text-ink-muted">{t('records.regulators')}</dt>
                <dd className="text-ink-secondary" dir="auto">{jurisdiction.regulators.join(t('records.listSeparator'))}</dd>
              </>
            )}
            {jurisdiction.retention_min_years != null && (
              <>
                <dt className="text-ink-muted">{t('records.keptAtLeast')}</dt>
                <dd className="text-ink-secondary">
                  {t('records.years', { count: jurisdiction.retention_min_years })}
                  {report.retention_years != null && report.retention_years > jurisdiction.retention_min_years
                    ? ` ${t('records.thisCase', { count: report.retention_years })}`
                    : ''}
                </dd>
              </>
            )}
          </dl>
        )}
        {canHold && (
          <Button variant="secondary" size="small" startIcon={Gavel} onClick={() => setHold(!onHold)} isLoading={busy} fullWidth>
            {onHold ? t('records.liftHold') : t('records.placeHold')}
          </Button>
        )}
      </Card.Content>
    </Card>
  );
};

// ─── A case disposed of under retention ──────────────────────────────────

export const isDisposed = (report) => Boolean(report?.redacted_at);

/** Read-only: the content is gone, and every update is refused (409). */
export const DisposedCase = ({ report, typeName, onBack }) => {
  const { t } = useTranslation('cases');
  const years = report.disposal?.retention_years ?? report.retention_years;
  const rows = [
    [t('disposed.reportType'), typeName],
    [t('disposed.submitted'), formatDay(report.created_at)],
    [t('disposed.closed'), formatDay(report.disposal?.closed_at || report.closed_at)],
    [t('disposed.disposed'), formatDay(report.redacted_at)],
  ].filter(([, value]) => value);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="small" onClick={onBack}>
        <ArrowLeft className="me-1 h-4 w-4" aria-hidden="true" /> {t('common:actions.back')}
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-ink">{t('disposed.caseNumber', { number: report.report_number })}</h2>
        <StatusBadge status={report.status} />
        <TierBadge tier={report.confidentiality_tier} size="medium" />
      </div>
      <Card className="max-w-2xl">
        <Card.Content className="space-y-4 py-6">
          <p className="flex items-start gap-3 text-sm text-ink-secondary">
            <Archive className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            <span>
              <span className="block font-semibold text-ink" dir="auto">{report.title || t('disposed.fallbackTitle', { type: typeName })}</span>
              {years
                ? t('disposed.bodyYears', { date: formatDay(report.redacted_at), count: years })
                : t('disposed.body', { date: formatDay(report.redacted_at) })}
            </span>
          </p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2 border-t border-line-subtle pt-4 text-sm">
            {rows.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="text-ink-muted">{term}</dt>
                <dd className="text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Card.Content>
      </Card>
    </div>
  );
};
