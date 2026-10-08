// src/components/reports/CasePanels.jsx
//
// The case page's governance panels — what the case inherited from its report
// type when it was filed:
//
//   CaseNotices    the regulator reminder, voice eligibility warnings
//   DeadlinesCard  acknowledge / triage, and "Mark as acknowledged"
//   RecordsCard    when the content is deleted, and the legal hold
//   DisposedCase   the read-only page once retention has destroyed the content
//
// Nothing here works out a deadline or a deletion date; the server sends both
// and these display them.
import { useState } from 'react';
import { ArrowLeft, Archive, CalendarClock, CheckCircle2, Gavel, Info, Landmark, Mic } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { reportsAPI } from '../../api';
import { errorSummary } from '../../utils/errors';
import { SLA_CLOCKS, SlaBadge, TierBadge, formatWhen, slaClock } from './CaseGovernance';

// ─── Notices above the case ──────────────────────────────────────────────

export const CaseNotices = ({ report }) => {
  const warnings = Array.isArray(report?.eligibility_warnings) ? report.eligibility_warnings.filter(Boolean) : [];
  if (!report?.regulatory_trigger && !warnings.length) return null;
  return (
    <div className="space-y-3">
      {report.regulatory_trigger && (
        <div className="flex items-start gap-3 rounded-xl border border-info-line bg-info-soft px-4 py-3 text-sm text-info-fg">
          <Landmark className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Regulator: </span>
            {report.regulatory_trigger}
            <span className="mt-0.5 block text-xs opacity-80">A reminder for whoever handles this case. Nobody has been notified.</span>
          </p>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-fg">
          <Mic className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Check how this call was filed</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Deadlines ───────────────────────────────────────────────────────────

const CLOCK_NOTES = {
  acknowledge: 'Met by the first message to the reporter, or by marking it below.',
  triage: 'Met the first time someone moves the case out of Pending, including assigning it by hand.',
};

const ClockRow = ({ clock, label, note }) => {
  const set = clock && clock.state && clock.state !== 'not_set';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{label}</p>
        {set ? <SlaBadge clock={clock} size="medium" /> : <span className="text-xs text-ink-subtle">No deadline</span>}
      </div>
      {set && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-xs">
          {clock.due_at && (
            <>
              <dt className="text-ink-muted">Due</dt>
              <dd className="text-ink-secondary">{formatWhen(clock.due_at)}</dd>
            </>
          )}
          {clock.done_at && (
            <>
              <dt className="text-ink-muted">Done</dt>
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
  const [busy, setBusy] = useState(false);
  const ack = slaClock(report, 'acknowledge');
  const showAcknowledge = canAcknowledge && !ack?.done_at;

  const acknowledge = async () => {
    setBusy(true);
    try {
      const result = await reportsAPI.acknowledgeReport(report.id);
      toast.success(result?.acknowledgement_recorded === false ? 'It was already recorded as acknowledged.' : 'Recorded as acknowledged.');
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
          Deadlines
        </Card.Title>
        <Card.Description>Set by the report type when this case was filed. Times are in your time zone.</Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        {SLA_CLOCKS.map(({ key, label }) => (
          <ClockRow key={key} clock={slaClock(report, key)} label={label} note={CLOCK_NOTES[key]} />
        ))}
        {showAcknowledge && (
          <div className="space-y-1.5 border-t border-line-subtle pt-4">
            <Button variant="secondary" size="small" startIcon={CheckCircle2} onClick={acknowledge} isLoading={busy} fullWidth>
              Mark as acknowledged
            </Button>
            <p className="text-xs text-ink-muted">
              For an acknowledgement sent by letter or made by phone. Your first message to the reporter counts on its own.
            </p>
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
  const [busy, setBusy] = useState(false);
  const closed = report?.status === 'closed';
  const onHold = Boolean(report?.legal_hold);
  if (!closed && !onHold && !canHold) return null;

  const setHold = async (hold) => {
    setBusy(true);
    try {
      const updated = await reportsAPI.updateReport(report.id, { legal_hold: hold }, { quiet: true });
      toast.success(hold ? 'Legal hold placed.' : 'Legal hold lifted.');
      onUpdated?.(updated);
    } catch (err) {
      toast.error(errorSummary(err));
    } finally {
      setBusy(false);
    }
  };

  let line;
  if (onHold) line = 'Legal hold: content will not be deleted.';
  else if (closed && report.retain_until) line = `Content will be deleted on ${formatDay(report.retain_until)}.`;
  else if (closed) line = 'This report type sets no retention period, so the content is kept.';
  else line = 'Nothing is scheduled. The retention period starts when the case is closed.';

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-accent-fg" />
          Records
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
        {closed && report.retention_years && !onHold && (
          <p className="text-xs text-ink-muted">
            Closed {formatDay(report.closed_at)} · kept {report.retention_years} years. Reopening the case cancels the date.
          </p>
        )}
        {canHold && (
          <Button variant="secondary" size="small" startIcon={Gavel} onClick={() => setHold(!onHold)} isLoading={busy} fullWidth>
            {onHold ? 'Lift legal hold' : 'Place legal hold'}
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
  const years = report.disposal?.retention_years ?? report.retention_years;
  const rows = [
    ['Report type', typeName],
    ['Submitted', formatDay(report.created_at)],
    ['Closed', formatDay(report.disposal?.closed_at || report.closed_at)],
    ['Disposed', formatDay(report.redacted_at)],
  ].filter(([, value]) => value);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="small" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back
      </Button>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold text-ink">Case #{report.report_number}</h2>
        <StatusBadge status={report.status} />
        <TierBadge tier={report.confidentiality_tier} size="medium" />
      </div>
      <Card className="max-w-2xl">
        <Card.Content className="space-y-4 py-6">
          <p className="flex items-start gap-3 text-sm text-ink-secondary">
            <Archive className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            <span>
              <span className="block font-semibold text-ink">{report.title || `${typeName} — disposed under retention policy`}</span>
              Disposed on {formatDay(report.redacted_at)}
              {years ? ` under a ${years}-year retention policy` : ' under the retention policy'}. The answers, description,
              messages and attachments have been permanently deleted; this record that the case existed is kept.
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
