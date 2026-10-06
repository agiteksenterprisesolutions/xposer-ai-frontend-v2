// src/pages/admin/AgentActivity.jsx
//
// Every report the AI agents have worked on, as a table. Selecting a row opens
// the run in a side panel — its timeline, the policies it relied on and the
// outcome — without leaving the list (?run=<report id> keeps it open on
// reload and makes it linkable).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Bot, RefreshCw, Search } from 'lucide-react';
import Button from '../../components/ui/Button';
import Badge, { PriorityBadge, StatusBadge } from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import Alert from '../../components/ui/Alert';
import RunDrawer, { AgentMark } from '../../components/agents/RunDrawer';
import { agentRunsAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useCan } from '../../hooks/useCan';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';
import { parseServerDate } from '../../utils/formatters';
import { ACCESS } from '../../utils/permissions';
import { casePath } from '../../utils/navigation';
import {
  AGENT_LABELS,
  AGENT_TYPES,
  AGENT_ORG_REQUIRED_MESSAGE,
  DECISION_LABELS,
  agentErrorMessage,
  isServiceUnavailable,
} from '../../utils/agents';

const AGENT_ACTIVITY_TOUR_KEY = 'xposer_agent_activity_tour_seen';

// The endpoint caps `limit` at 200.
const LIMIT_OPTIONS = [25, 50, 100, 200];
const ALL = '';

const formatRunTime = (value) => {
  const date = parseServerDate(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** The agents that acted, known ones in run order first. */
const agentsOf = (run) => {
  const keys = Object.keys(run.agents || {});
  return [...AGENT_TYPES.filter((k) => keys.includes(k)), ...keys.filter((k) => !AGENT_TYPES.includes(k))];
};

const DecisionBadge = ({ decision }) => {
  if (!decision) return <span className="text-xs text-ink-subtle">—</span>;
  const known = DECISION_LABELS[decision];
  return known ? (
    <Badge variant={known.variant} size="small">
      {known.label}
    </Badge>
  ) : (
    <Badge size="small">{decision}</Badge>
  );
};

const AgentActivity = () => {
  useSEO({
    title: 'AI Activity',
    description: 'Review what the AI agents decided on each report, and the policy they cited.',
    noIndex: true,
  });

  const { user } = useAuthStore();
  const canOpenReports = useCan()(ACCESS.caseReports);
  const isDesktop = useIsDesktop();
  const tourRef = useRef(null);

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [serviceError, setServiceError] = useState(null);
  const [query, setQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState(ALL);
  const [searchParams, setSearchParams] = useSearchParams();

  // Org-scoped endpoint: a super admin has no organization and would get a 400
  // that looks exactly like a bug.
  const missingOrganization = !user?.organization_id;

  const fetchRuns = useCallback(async () => {
    if (missingOrganization) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await agentRunsAPI.listRuns(limit);
      setRuns(Array.isArray(data) ? data : []);
      setServiceError(null);
    } catch (error) {
      console.error('Error fetching agent runs:', error);
      if (isServiceUnavailable(error)) {
        setServiceError(agentErrorMessage(error, 'The AI agent service is not available right now.'));
      }
    } finally {
      setLoading(false);
    }
  }, [limit, missingOrganization]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const decisions = useMemo(() => [...new Set(runs.map((r) => r.decision).filter(Boolean))], [runs]);

  const visible = runs.filter((run) => {
    const term = query.trim().toLowerCase();
    if (term && ![run.report_number, run.title].some((v) => String(v || '').toLowerCase().includes(term))) return false;
    if (decisionFilter && run.decision !== decisionFilter) return false;
    return true;
  });

  const openId = searchParams.get('run');
  const openRun = runs.find((r) => r.report_id === openId) || null;
  const setOpen = useCallback(
    (reportId) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (reportId) next.set('run', reportId);
          else next.delete('run');
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const close = useCallback(() => setOpen(null), [setOpen]);

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-ai-activity"]',
        title: 'AI Activity',
        content: 'See what each AI agent decided, and which policy it based that on.',
        placement: 'right',
        skipBeacon: true,
      });
    }
    steps.push(
      {
        target: '[data-tour="runs-filters"]',
        title: 'Find a run',
        content: 'Search by report number or title, filter by decision, or load more of the history.',
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="runs-table"]',
        title: 'Every AI run',
        content: 'Select a row to see what each agent did, the policy passages it relied on, and the outcome.',
        placement: 'top',
      },
    );
    return steps;
  }, [isDesktop]);

  if (missingOrganization) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-ink">AI Activity</h1>
          <p className="text-sm text-ink-muted">What the AI agents did on each report.</p>
        </div>
        <Alert variant="warning" title="No organization on this account">
          {AGENT_ORG_REQUIRED_MESSAGE}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <DashboardTour ref={tourRef} storageKey={AGENT_ACTIVITY_TOUR_KEY} steps={tourSteps} />

      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-xl font-bold text-ink">AI Activity</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Every report your agents have worked on — what each one did, what it decided, and which policies it relied
            on.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto" data-tour="runs-filters">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 focus-within:border-line-accent lg:w-64 lg:flex-none">
            <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Report number or title"
              aria-label="Search runs"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
          </label>
          <select
            value={decisionFilter}
            onChange={(event) => setDecisionFilter(event.target.value)}
            aria-label="Decision"
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          >
            <option value={ALL}>All decisions</option>
            {decisions.map((d) => (
              <option key={d} value={d}>
                {DECISION_LABELS[d]?.label || d}
              </option>
            ))}
          </select>
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            aria-label="How many runs"
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                Latest {n}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={fetchRuns} disabled={loading} aria-label="Refresh" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {serviceError && (
        <Alert variant="warning" title="AI activity unavailable">
          {serviceError} Reports are still processed normally.
        </Alert>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface" data-tour="runs-table">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-176 text-left">
            <thead>
              <tr className="border-b border-line-subtle bg-subtle text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
                <th scope="col" className="px-5 py-3">Report</th>
                <th scope="col" className="px-3 py-3">Decision</th>
                <th scope="col" className="px-3 py-3">Priority</th>
                <th scope="col" className="px-3 py-3">Agents</th>
                <th scope="col" className="px-3 py-3">Report status</th>
                <th scope="col" className="px-5 py-3 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                runs.length === 0 &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-line-subtle last:border-b-0" aria-hidden="true">
                    <td className="px-5 py-3.5">
                      <Skeleton.Text className="w-56" />
                      <Skeleton.Text size="xs" className="w-16" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton.Badge className="w-16" />
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton.Badge className="w-14" />
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="flex">
                        {[0, 1, 2].map((j) => (
                          <Skeleton.Circle key={j} size="h-6 w-6" className={`ring-2 ring-surface ${j ? '-ml-1.5' : ''}`} />
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <Skeleton.Badge className="w-20" />
                    </td>
                    <td className="px-5 py-3.5">
                      <Skeleton.Text size="xs" className="ml-auto w-24" />
                    </td>
                  </tr>
                ))}

              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Bot className="mx-auto h-8 w-8 text-ink-subtle" />
                    <p className="mt-3 text-sm font-semibold text-ink">
                      {runs.length === 0 ? 'No agent runs yet' : 'No runs match'}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
                      {runs.length === 0
                        ? 'Once a report is processed by the AI agents, what they did and the policies they cited appear here.'
                        : 'Try a different search or decision.'}
                    </p>
                  </td>
                </tr>
              )}

              {visible.map((run) => {
                const selected = openRun?.report_id === run.report_id;
                const agents = agentsOf(run);
                return (
                  <tr
                    key={`${run.report_id}-${run.created_at}`}
                    onClick={() => setOpen(run.report_id)}
                    className={`cursor-pointer border-b border-line-subtle transition-colors last:border-b-0 ${
                      selected ? 'bg-accent-soft shadow-[inset_3px_0_0_var(--color-accent)]' : 'hover:bg-hover'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpen(run.report_id);
                        }}
                        className="block max-w-sm text-left focus:outline-none focus-visible:underline"
                      >
                        <span className="block truncate text-sm font-semibold text-ink">{run.title || 'Untitled report'}</span>
                        <span className="block font-mono text-xs text-ink-subtle">#{run.report_number}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3.5">
                      <DecisionBadge decision={run.decision} />
                    </td>
                    <td className="px-3 py-3.5">
                      {run.priority ? <PriorityBadge priority={run.priority} /> : <span className="text-xs text-ink-subtle">—</span>}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="flex" title={agents.map((a) => AGENT_LABELS[a] || a).join(' → ')}>
                        {agents.map((agent, index) => (
                          <span key={agent} className={`rounded-full ring-2 ring-surface ${index ? '-ml-1.5' : ''}`}>
                            <AgentMark type={agent} size="sm" />
                          </span>
                        ))}
                        {agents.length === 0 && <span className="text-xs text-ink-subtle">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {run.report_status ? <StatusBadge status={run.report_status} /> : <span className="text-xs text-ink-subtle">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs text-ink-muted">
                      {formatRunTime(run.timestamp || run.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-subtle">
        <Activity className="h-3 w-3" />
        Runs whose report is outside your organization are never listed.
      </p>

      {openRun && (
        <RunDrawer
          key={openRun.report_id}
          run={openRun}
          casePath={canOpenReports && user?.organization_slug ? casePath(user.organization_slug, openRun.report_id) : null}
          onClose={close}
        />
      )}
    </div>
  );
};

export default AgentActivity;
