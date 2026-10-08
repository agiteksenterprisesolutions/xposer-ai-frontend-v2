// src/components/reports/DigestPanel.jsx
//
// The summarizer's digest of one report's evidence, for whoever is working
// the case.
//
// Gated on agent:summary_read by the caller — never on agent:read, which
// would reintroduce the over-granting the permission split removed. The full
// run (every agent's prompts and verdicts) stays under agent administration.
//
// No digest is the normal case, not an error. The summarizer digests evidence
// files only, so a report filed without attachments never gets one — and
// neither does any report while summaries are off. Those come back as
// 200 `available: false` and are shown quietly. A 503 is a real fault (the
// agent service is unreachable); a 404 only means the report isn't found.
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import MarkdownMessage from '../ui/MarkDownMessage';
import { agentRunsAPI } from '../../api';
import { errorSummary } from '../../utils/errors';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

/**
 * Props:
 *   reportId
 *   attachmentCount – evidence files on the report, when known; with none,
 *                     the empty state can say exactly why there's no summary
 *   canReadRun      – agent:read; the run's stage_log then says which reason
 *                     applies (no files, attachments off, summarizer off)
 *   embedded        – drawn as a section inside the case's Evidence card
 *                     rather than as a card of its own: the summary covers
 *                     the evidence files only, never the whole report
 */

/** The summarizing pass in a run's stage_log: outcome ran | no_digest | skipped. */
const summarizerEntry = (run) =>
  (run?.stage_log || []).find(
    (entry) =>
      ['ran', 'no_digest', 'skipped'].includes(entry?.outcome) &&
      (entry.kind === 'summarizer' || entry.summarizer || /summar/i.test(`${entry.stage || ''} ${entry.agent_code || ''}`)),
  ) || null;

const DigestPanel = ({ reportId, attachmentCount = null, canReadRun = false, embedded = false }) => {
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { message, fault }
  const [why, setWhy] = useState(null); // the stage_log sentence, when there's no digest

  const load = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      const result = await agentRunsAPI.getSummary(reportId);
      setDigest(result);
      setError(null);
      // No digest: the run's log says why, as a sentence — show it rather
      // than guessing. Optional; the panel works without it.
      if (result && !result.available && canReadRun) {
        const run = await agentRunsAPI.getRun(reportId, { quiet: true }).catch(() => null);
        setWhy(summarizerEntry(run)?.detail || null);
      } else {
        setWhy(null);
      }
    } catch (err) {
      setDigest(null);
      const status = err?.response?.status;
      if (status === 503) {
        setError({ message: "The AI service can't be reached right now, so the summary can't be loaded. Try again shortly.", fault: true });
      } else if (status === 404) {
        // Only means the report isn't in this organization.
        setError({ message: 'No summary is available for this report.', fault: false });
      } else {
        setError({ message: errorSummary(err), fault: true });
      }
    } finally {
      setLoading(false);
    }
  }, [reportId, canReadRun]);

  useEffect(() => {
    load();
  }, [load]);

  const available = digest?.available;

  const refreshButton = (
    <Button
      variant="ghost"
      size="small"
      onClick={load}
      isLoading={loading}
      aria-label="Refresh the summary"
      title="Refresh — a summary can arrive a little after the evidence does"
    >
      {!loading && <RefreshCw className="h-4 w-4" />}
    </Button>
  );

  const content = (
    <>
        {loading && !digest && !error && (
        <div className="space-y-2" aria-busy="true">
          <div className="h-3 w-full animate-pulse rounded bg-active" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-active" />
          <div className="h-3 w-4/6 animate-pulse rounded bg-active" />
        </div>
      )}

      {error && <p className={`text-sm ${error.fault ? 'text-danger-fg' : 'text-ink-muted'}`}>{error.message}</p>}

      {digest && !available && (
        <div className="space-y-1">
          <p className="text-sm text-ink-muted">
            {/* The server's reason, verbatim: it separates "switched off" from
                "no attachments" from "not run yet", each needing a different
                response. Our own wording only when it sends none. */}
            {digest.reason ||
              why ||
              (attachmentCount === 0
                ? 'No evidence files were attached, so there is nothing to summarize. Summaries are written from attachments only.'
                : 'No summary for this report yet. One can arrive a little after the evidence does.')}
          </p>
          {(digest.problems || [])
            .filter((problem) => problem?.message && problem.message !== digest.reason)
            .map((problem, index) => (
              <p key={index} className="text-xs text-ink-subtle">
                {problem.message}
              </p>
            ))}
        </div>
      )}

      {available && (
        <div className="space-y-4">
          <div className="text-sm text-ink-secondary">
            <MarkdownMessage content={digest.summary || ''} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-subtle pt-3 text-xs text-ink-subtle">
            {digest.agent_code && (
              <span>
                By <span className="font-mono text-ink-muted">{digest.agent_code}</span>
                {digest.stage && (
                  <>
                    {' '}
                    at stage <span className="font-mono text-ink-muted">{digest.stage}</span>
                  </>
                )}
              </span>
            )}
            {digest.workflow?.name && (
              <span>
                · {digest.workflow.name}
                {digest.workflow.version != null && ` v${digest.workflow.version}`}
              </span>
            )}
            {digest.generated_at && (
              <span title={formatDateTime(digest.generated_at)}>· {formatRelativeTime(digest.generated_at)}</span>
            )}
          </div>
          <p className="text-xs text-ink-subtle">
            Written by an AI agent from the evidence files. Check it against the originals before relying on it.
          </p>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <section aria-label="AI summary of the evidence" className="rounded-xl border border-line-accent/40 bg-accent-soft/30 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-accent-fg" />
              AI summary of the evidence
              {available && (
                <Badge variant="primary" size="small">
                  AI-generated
                </Badge>
              )}
            </h4>
            <p className="mt-0.5 text-xs text-ink-muted">A factual digest of the files below — not of the report as a whole.</p>
          </div>
          {refreshButton}
        </div>
        {content}
      </section>
    );
  }

  return (
    <Card>
      <Card.Header className="flex items-start justify-between gap-3">
        <div>
          <Card.Title className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-fg" />
            AI summary of the evidence
            {available && (
              <Badge variant="primary" size="small">
                AI-generated
              </Badge>
            )}
          </Card.Title>
          <Card.Description>A factual digest of the evidence files on this report.</Card.Description>
        </div>
        {refreshButton}
      </Card.Header>
      <Card.Content>{content}</Card.Content>
    </Card>
  );
};

export default DigestPanel;
