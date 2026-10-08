// src/components/agents/RunDrawer.jsx
//
// One agent run, in a panel that slides in from the right: what each agent
// did and when, the policy passages it relied on, and the outcome.
//
// Citations are rendered according to their verification flags. Those flags
// are the whole point of the feature: an unverified citation reads exactly
// like a real quote, so rendering them unstyled would defeat it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bot,
  ChevronDown,
  FileText,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  UserCog,
  X,
} from 'lucide-react';
import Badge, { PriorityBadge, StatusBadge } from '../ui/Badge';
import Skeleton from '../ui/Skeleton';
import { AGENT_LABELS, DECISION_LABELS, agentErrorMessage, citationVerdict, isManualAction } from '../../utils/agents';
import { agentRunsAPI } from '../../api';
import { parseServerDate } from '../../utils/formatters';

const VERDICT_ICONS = { success: ShieldCheck, warning: ShieldAlert, danger: ShieldX };

const agentLabel = (type) => AGENT_LABELS[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Agent');

export const AgentMark = ({ type, manual = false, size = 'md' }) => {
  const Icon = manual ? UserCog : type === 'summarizer' ? ScrollText : Bot;
  const tone = manual
    ? 'bg-warning-soft text-warning-fg'
    : type === 'summarizer'
      ? 'bg-info-soft text-info-fg'
      : 'bg-accent text-on-accent';
  const box = size === 'sm' ? 'h-6 w-6 rounded-full text-[10px]' : 'h-8 w-8 rounded-lg';
  return (
    <span className={`flex shrink-0 items-center justify-center ${box} ${tone}`}>
      {size === 'sm' ? agentLabel(type).charAt(0) : <Icon className="h-4 w-4" />}
    </span>
  );
};

/** "+12s" / "+1m 05s" since the report was submitted. */
const since = (start, value) => {
  const a = parseServerDate(start);
  const b = parseServerDate(value);
  if (!a || !b) return null;
  const seconds = Math.max(0, Math.round((b - a) / 1000));
  if (seconds < 60) return `+${seconds}s`;
  return `+${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
};

const formatWhen = (value) => {
  const date = parseServerDate(value);
  return date
    ? date.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
};

const Citation = ({ citation }) => {
  const [open, setOpen] = useState(false);
  const verdict = citationVerdict(citation);
  const Icon = VERDICT_ICONS[verdict.variant] || ShieldCheck;
  const box = {
    success: 'border-line-subtle bg-subtle',
    warning: 'border-warning-line bg-warning-soft',
    danger: 'border-danger-line bg-danger-soft',
  }[verdict.variant];

  return (
    <div className={`rounded-xl border p-3 ${box}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={verdict.variant} size="small">
          <Icon className="h-3 w-3" />
          {verdict.label}
        </Badge>
        {citation.source && <span className="min-w-0 truncate text-[11px] text-ink-muted">{citation.source}</span>}
      </div>
      {citation.quote && <p className="mt-2 text-sm italic leading-relaxed text-ink">“{citation.quote}”</p>}
      {verdict.variant !== 'success' && <p className="mt-2 text-[11px] font-medium text-ink-muted">{verdict.note}</p>}
      {(citation.application || citation.requirement || citation.assessment) && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline"
          >
            Why it applies
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink-secondary">
              {citation.requirement && (
                <p>
                  <span className="font-semibold text-ink">What the policy says: </span>
                  {citation.requirement}
                </p>
              )}
              {(citation.application || citation.assessment) && (
                <p>
                  <span className="font-semibold text-ink">How it applies here: </span>
                  {citation.application || citation.assessment}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

const Step = ({ action, start, last }) => {
  const manual = isManualAction(action.action);
  const decision = action.decision ? DECISION_LABELS[action.decision] : null;
  const consulted = action.kb_documents?.length
    ? action.kb_documents
    : (action.kb_sources || []).map((filename) => ({ filename }));
  const at = since(start, action.timestamp);

  return (
    <li className="flex gap-3.5">
      <div className="flex w-8 shrink-0 flex-col items-center">
        <AgentMark type={action.agent_type} manual={manual} />
        {!last && <span className="min-h-3 w-0.5 flex-1 bg-line-subtle" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1 space-y-2 pb-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{agentLabel(action.agent_type)}</span>
          {at && <span className="font-mono text-xs text-ink-subtle">{at}</span>}
        </div>
        {manual ? (
          <Badge variant="warning" size="small">
            Handed to a person
          </Badge>
        ) : (
          action.action && <p className="text-sm leading-relaxed text-ink-secondary">{action.action}</p>
        )}
        {(decision || action.decision || action.priority) && (
          <div className="flex flex-wrap gap-1.5">
            {action.decision &&
              (decision ? (
                <Badge variant={decision.variant} size="small">
                  {decision.label}
                </Badge>
              ) : (
                <Badge size="small">{action.decision}</Badge>
              ))}
            {action.priority && <PriorityBadge priority={action.priority} />}
          </div>
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
        {consulted.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-ink-muted">
            <BookOpen className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              Consulted {consulted.map((doc) => doc.filename).join(', ')}
              {consulted[0]?.passages_used ? ` · ${consulted.reduce((n, d) => n + (d.passages_used || 0), 0)} passages` : ''}
            </span>
          </p>
        )}
        {action.policy_citations?.length > 0 && (
          <div className="space-y-2">
            {action.policy_citations.map((citation, index) => (
              <Citation key={`${citation.source}-${index}`} citation={citation} />
            ))}
          </div>
        )}
      </div>
    </li>
  );
};

/**
 * Passages come straight from the parsed document, so they can carry HTML
 * table markup and Markdown syntax. Shown as plain reading text instead.
 */
const cleanPassage = (text = '') =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/^\s*#+\s*/gm, '')
    .replace(/^\s*[*-]\s+/gm, '• ')
    .replace(/<\/?u>|\*\*/g, '')
    .replace(/-{3,}/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

const Passages = ({ excerpts }) => {
  const [open, setOpen] = useState(false);
  if (!excerpts.length) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-xs font-semibold text-link hover:underline"
      >
        {open ? 'Hide' : 'Show'} the {excerpts.length} passage{excerpts.length === 1 ? '' : 's'} retrieved
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="mt-2 space-y-2">
          {excerpts.map((excerpt) => (
            <li key={`${excerpt.chunk_index}-${excerpt.ref}`} className="rounded-lg border border-line-subtle bg-subtle p-2.5">
              <p className="flex justify-between gap-2 text-[11px] text-ink-subtle">
                <span>Passage {excerpt.ref}</span>
                {typeof excerpt.score === 'number' && <span>match {excerpt.score.toFixed(2)}</span>}
              </p>
              <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs leading-relaxed text-ink-secondary">
                {cleanPassage(excerpt.text) || 'Formatting only — no readable text in this passage.'}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

const TABS = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'policies', label: 'Policies' },
  { value: 'outcome', label: 'Outcome' },
];

/**
 * Props:
 *   run      – the row from the list (header shows at once from it)
 *   casePath – link to the report, or null when the viewer can't open reports
 *   onClose
 */
const RunDrawer = ({ run, casePath, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('timeline');
  const panelRef = useRef(null);
  const reportId = run.report_id;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    setTab('timeline');
    agentRunsAPI
      .getRun(reportId, { quiet: true })
      .then((data) => !cancelled && setDetail(data))
      .catch((err) => !cancelled && setError(agentErrorMessage(err, 'This run could not be loaded.')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const actions = useMemo(() => detail?.actions || [], [detail]);
  const start = run.submitted_at || run.timestamp || detail?.timestamp;
  const kb = detail?.knowledge_base;
  const documents = kb?.documents || [];
  const excerptsByDoc = useMemo(() => {
    const map = new Map();
    actions.forEach((action) =>
      (action.kb_excerpts || []).forEach((excerpt) => {
        const key = excerpt.document_id || excerpt.filename;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(excerpt);
      }),
    );
    return map;
  }, [actions]);
  const lastAt = actions.length ? actions[actions.length - 1].timestamp : null;
  const took = since(start, lastAt)?.slice(1);
  const decision = run.decision ? DECISION_LABELS[run.decision] : null;
  const citations = kb?.citation_count ?? actions.reduce((n, a) => n + (a.policy_citations?.length || 0), 0);
  const unverified = kb?.unverified_citation_count ?? 0;

  return (
    <div className="fixed inset-0 z-120" role="dialog" aria-modal="true" aria-label={`Agent run for report ${run.report_number}`}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-ink/30 animate-fade-in" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-surface shadow-2xl outline-none animate-slide-in-right"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line-subtle px-5 py-5 sm:px-6">
          <div className="min-w-0 space-y-1.5">
            <p className="font-mono text-xs text-ink-subtle">#{run.report_number}</p>
            <h2 className="text-lg font-bold leading-snug text-ink">{run.title || 'Untitled report'}</h2>
            <div className="flex flex-wrap items-center gap-2">
              {run.report_status && <StatusBadge status={run.report_status} />}
              {(run.report_priority || run.priority) && <PriorityBadge priority={run.report_priority || run.priority} />}
              <span className="text-xs text-ink-subtle">Submitted {formatWhen(start)}</span>
            </div>
            {casePath && (
              <Link to={casePath} className="inline-flex items-center gap-1 text-sm font-semibold text-link hover:underline">
                Open case
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex gap-1 border-b border-line-subtle px-5 sm:px-6" role="tablist">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`whitespace-nowrap border-b-2 px-2.5 py-3 text-sm transition-colors ${
                tab === value ? 'border-accent font-semibold text-accent-fg' : 'border-transparent font-medium text-ink-muted hover:text-ink'
              }`}
            >
              {label}
              {value === 'policies' && documents.length > 0 && ` (${documents.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loading && (
            <ol aria-busy="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex gap-3.5">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <Skeleton.Icon size="h-8 w-8" />
                    {i < 2 && <span className="min-h-3 w-0.5 flex-1 bg-line-subtle" aria-hidden="true" />}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2 pb-5">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton.Text className="w-24" />
                      <Skeleton.Text size="xs" className="w-12" />
                    </div>
                    <Skeleton.Lines lines={2} />
                    <div className="flex gap-1.5">
                      <Skeleton.Badge className="w-16" />
                      <Skeleton.Badge className="w-20" />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {!loading && error && (
            <p className="rounded-xl border border-danger-line bg-danger-soft p-3 text-sm text-danger-fg">{error}</p>
          )}

          {!loading && !error && tab === 'timeline' && (
            <>
              {actions.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">No agent steps were recorded for this report.</p>
              ) : (
                <ol>
                  {actions.map((action, index) => (
                    <Step key={`${action.agent_type}-${index}`} action={action} start={start} last={index === actions.length - 1} />
                  ))}
                </ol>
              )}
              {detail?.final_output && (
                <div className="mt-1 rounded-xl bg-subtle p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Outcome</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink">{detail.final_output}</p>
                </div>
              )}
            </>
          )}

          {!loading && !error && tab === 'policies' && (
            <div className="space-y-4">
              <div
                className={`flex items-center gap-3 rounded-xl px-4 py-3 ${
                  unverified > 0 ? 'bg-danger-soft text-danger-fg' : 'bg-success-soft text-success-fg'
                }`}
              >
                {unverified > 0 ? <ShieldX className="h-5 w-5 shrink-0" /> : <ShieldCheck className="h-5 w-5 shrink-0" />}
                <p className="text-sm font-semibold">
                  {citations} citation{citations === 1 ? '' : 's'}
                  {unverified > 0
                    ? ` · ${unverified} not found in the cited document`
                    : citations > 0
                      ? ', all verified'
                      : ''}
                </p>
              </div>
              {documents.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-muted">No policy documents were consulted on this run.</p>
              ) : (
                <ul className="space-y-3">
                  {documents.map((doc) => (
                    <li key={doc.document_id || doc.filename} className="space-y-2 rounded-xl border border-line-subtle p-3.5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink-muted">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-ink">{doc.filename}</p>
                          <p className="text-xs text-ink-subtle">
                            Read by {(doc.read_by || []).map(agentLabel).join(', ') || '—'}
                            {doc.passages_used ? ` · ${doc.passages_used} passages` : ''}
                          </p>
                        </div>
                      </div>
                      <Passages excerpts={excerptsByDoc.get(doc.document_id || doc.filename) || []} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!loading && !error && tab === 'outcome' && (
            <div className="space-y-4">
              <div className="rounded-xl bg-ink p-4 text-canvas">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-60">Outcome</p>
                <p className="mt-1.5 text-sm leading-relaxed">{detail?.final_output || 'No outcome was recorded.'}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ['Decision', decision ? decision.label : run.decision || '—'],
                  ['Priority', run.priority || '—'],
                  ['Agents', actions.length || '—'],
                  ['Took', took || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-subtle px-3.5 py-3">
                    <dt className="text-xs text-ink-subtle">{label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold capitalize text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default RunDrawer;
