// src/components/agents/AgentRunDetailModal.jsx
//
// The per-agent timeline for one run, with the policy citations rendered
// according to their verification flags. Those flags are the whole point of
// the feature: an unverified citation reads exactly like a real quote, so
// rendering them unstyled would defeat it.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  BookOpen,
  ExternalLink,
  Quote,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  UserCog,
  AlertCircle,
} from 'lucide-react';
import Modal from '../ui/Modal';
import Badge, { PriorityBadge } from '../ui/Badge';
import {
  AGENT_LABELS,
  DECISION_LABELS,
  citationVerdict,
  isManualAction,
  agentErrorMessage,
} from '../../utils/agents';
import { agentRunsAPI } from '../../api';
import { parseServerDate } from '../../utils/formatters';
import { useCan } from '../../hooks/useCan';
import { ACCESS } from '../../utils/permissions';
import { casePath } from '../../utils/navigation';

const VERDICT_ICONS = {
  success: ShieldCheck,
  warning: ShieldAlert,
  danger: ShieldX,
};

const formatTimestamp = (value) => {
  const date = parseServerDate(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const PolicyCitation = ({ citation }) => {
  const verdict = citationVerdict(citation);
  const Icon = VERDICT_ICONS[verdict.variant] || ShieldCheck;

  const boxClass = {
    success: 'border-line-subtle bg-subtle',
    warning: 'border-warning-line bg-warning-soft',
    danger: 'border-danger-line bg-danger-soft',
  }[verdict.variant];

  return (
    <div className={`rounded-lg border p-3 ${boxClass}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={verdict.variant} size="small">
          <Icon className="h-3 w-3" />
          {verdict.label}
        </Badge>
        {citation.source && (
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
            <BookOpen className="h-3 w-3" />
            {citation.source}
          </span>
        )}
      </div>

      {citation.quote && (
        <blockquote className="border-l-2 border-line-strong pl-3 text-sm italic leading-relaxed text-ink">
          <Quote className="mr-1 inline h-3 w-3 text-ink-subtle" />
          {citation.quote}
        </blockquote>
      )}

      {citation.assessment && (
        <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{citation.assessment}</p>
      )}

      {verdict.variant !== 'success' && (
        <p className="mt-2 text-[11px] font-medium text-ink-muted">{verdict.note}</p>
      )}
    </div>
  );
};

const AgentStep = ({ action }) => {
  const manual = isManualAction(action.action);
  const label = AGENT_LABELS[action.agent_type] || action.agent_type;
  const decision = action.decision ? DECISION_LABELS[action.decision] : null;

  return (
    <li className="relative pl-8">
      {/* Timeline rail */}
      <span className="absolute left-0 top-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-ink-muted">
        {manual ? <UserCog className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </span>

      <div className="space-y-2 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{label}</span>
          {manual && (
            <Badge variant="warning" size="small">
              Manual action required
            </Badge>
          )}
          {decision && (
            <Badge variant={decision.variant} size="small">
              {decision.label}
            </Badge>
          )}
          {action.priority && <PriorityBadge priority={action.priority} />}
          <span className="text-[11px] text-ink-subtle">{formatTimestamp(action.timestamp)}</span>
        </div>

        {action.action && (
          <p className="text-sm leading-relaxed text-ink-secondary">{action.action}</p>
        )}

        {action.note && (
          <p className="rounded-lg border border-line-subtle bg-subtle p-2.5 text-sm leading-relaxed text-ink-secondary">
            {action.note}
          </p>
        )}

        {action.error && (
          <p className="flex items-start gap-1.5 text-sm text-danger-fg">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {action.error}
          </p>
        )}

        {/* Documents retrieved for this agent, whether or not it quoted them. */}
        {action.kb_sources?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-subtle">
              Policies consulted
            </span>
            {action.kb_sources.map((source) => (
              <Badge key={source} variant="secondary" size="small">
                {source}
              </Badge>
            ))}
          </div>
        )}

        {action.policy_citations?.length > 0 && (
          <div className="space-y-2">
            {action.policy_citations.map((citation, index) => (
              <PolicyCitation key={`${citation.source}-${index}`} citation={citation} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
};

const AgentRunDetailModal = ({ run, isOpen, onClose, orgSlug }) => {
  const canOpenReports = useCan()(ACCESS.caseReports);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Keyed by report_id, not report_number.
  const reportId = run?.report_id;

  useEffect(() => {
    if (!isOpen || !reportId) return undefined;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setDetail(null);

    agentRunsAPI
      .getRun(reportId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        console.error('Error fetching agent run detail:', err);
        if (!cancelled) setError(agentErrorMessage(err, 'This run could not be loaded.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, reportId]);

  // The list row already carries the report joins, so the header is complete
  // before the detail request comes back.
  const decision = run?.decision ? DECISION_LABELS[run.decision] : null;
  const actions = detail?.actions || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={run?.report_number ? `Agent run · ${run.report_number}` : 'Agent run'}
      size="xl"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          {run?.title && <p className="text-base font-semibold text-ink">{run.title}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {decision && (
              <Badge variant={decision.variant} size="small">
                {decision.label}
              </Badge>
            )}
            {run?.priority && <PriorityBadge priority={run.priority} />}
            <span className="text-xs text-ink-subtle">{formatTimestamp(run?.timestamp)}</span>
            {/* agent:read shows this run; opening the report itself needs
                report access, which an agent administrator may not have. */}
            {reportId && orgSlug && canOpenReports && (
              <Link
                to={casePath(orgSlug, reportId)}
                className="inline-flex items-center gap-1 text-xs text-link hover:underline"
              >
                Open the report
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        <hr className="border-line-subtle" />

        {loading && (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-active" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger-fg">
            {error}
          </p>
        )}

        {!loading && !error && actions.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-muted">
            No agent steps were recorded for this report.
          </p>
        )}

        {!loading && !error && actions.length > 0 && (
          <ol className="relative before:absolute before:bottom-6 before:left-3 before:top-6 before:w-px before:bg-line-subtle">
            {actions.map((action, index) => (
              <AgentStep key={`${action.agent_type}-${index}`} action={action} />
            ))}
          </ol>
        )}

        {!loading && detail?.final_output && (
          <div className="rounded-xl border border-line-accent bg-accent-soft p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-accent-fg">
              Final outcome
            </p>
            <p className="text-sm leading-relaxed text-ink">{detail.final_output}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default AgentRunDetailModal;
