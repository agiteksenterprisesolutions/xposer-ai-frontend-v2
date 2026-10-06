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
 */
const DigestPanel = ({ reportId, attachmentCount = null }) => {
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { message, fault }

  const load = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      setDigest(await agentRunsAPI.getSummary(reportId));
      setError(null);
    } catch (err) {
      setDigest(null);
      const status = err?.response?.status;
      if (status === 503) {
        setError({ message: "The AI service can't be reached right now, so the summary can't be loaded. Try again shortly.", fault: true });
      } else if (status === 404) {
        setError({ message: 'There is no summary for this report.', fault: false });
      } else {
        setError({ message: errorSummary(err), fault: true });
      }
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    load();
  }, [load]);

  const available = digest?.available;

  return (
    <Card>
      <Card.Header className="flex items-start justify-between gap-3">
        <div>
          <Card.Title className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-fg" />
            AI summary
            {available && (
              <Badge variant="primary" size="small">
                AI-generated
              </Badge>
            )}
          </Card.Title>
          <Card.Description>A factual digest of the evidence files on this report.</Card.Description>
        </div>
        <Button
          variant="ghost"
          size="small"
          onClick={load}
          isLoading={loading}
          aria-label="Refresh the summary"
          title="Refresh — a summary can arrive a little after the report does"
        >
          {!loading && <RefreshCw className="h-4 w-4" />}
        </Button>
      </Card.Header>

      <Card.Content>
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
              {attachmentCount === 0
                ? 'No evidence files were attached, so there is nothing to summarize. Summaries are written from attachments only.'
                : digest.reason || 'No summary for this report yet. One can arrive a little after the evidence does.'}
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
      </Card.Content>
    </Card>
  );
};

export default DigestPanel;
