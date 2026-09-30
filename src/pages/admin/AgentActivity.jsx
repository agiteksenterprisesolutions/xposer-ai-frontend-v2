// src/pages/admin/AgentActivity.jsx
//
// A reduced view of what the AI did on each report. The API deliberately
// leaves out raw backend call logs and the officer's confidential internal
// note, so this page never shows them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, RefreshCw, Bot } from 'lucide-react';
import Card from '../../components/ui/Card';
import Table, { TableLoading } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Select from '../../components/ui/Select';
import AgentPills from '../../components/agents/AgentPills';
import AgentRunDetailModal from '../../components/agents/AgentRunDetailModal';
import { agentRunsAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';
import { parseServerDate } from '../../utils/formatters';
import {
  DECISION_LABELS,
  agentErrorMessage,
  isServiceUnavailable,
  AGENT_ORG_REQUIRED_MESSAGE,
} from '../../utils/agents';

const AGENT_ACTIVITY_TOUR_KEY = 'xposer_agent_activity_tour_seen';

// The endpoint caps `limit` at 200.
const LIMIT_OPTIONS = [
  { value: '25', label: 'Latest 25 runs' },
  { value: '50', label: 'Latest 50 runs' },
  { value: '100', label: 'Latest 100 runs' },
  { value: '200', label: 'Latest 200 runs' },
];

const formatRunTime = (value) => {
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

const AgentActivity = () => {
  useSEO({
    title: 'AI Agent Activity',
    description: 'Review what the AI agents decided on each report, and the policy they cited.',
    noIndex: true,
  });

  const { user } = useAuthStore();
  const isDesktop = useIsDesktop();
  const tourRef = useRef(null);

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState('50');
  const [serviceError, setServiceError] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);

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
      const data = await agentRunsAPI.listRuns(Number(limit));
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
        target: '[data-tour="runs-limit"]',
        title: 'How far back',
        content: 'Choose how many of the most recent runs to load.',
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="runs-table"]',
        title: 'Every AI run',
        content: 'The four pills show which agents acted. Click a row to see the full timeline and the policy quotes behind each decision.',
        placement: 'top',
      }
    );

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: 'Your account',
      content: 'Manage your profile or log out from here.',
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop]);

  if (missingOrganization) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">AI Agent Activity</h1>
          <p className="text-sm text-ink-muted">What the AI agents did on each report.</p>
        </div>
        <Alert variant="warning" title="No organization on this account">
          {AGENT_ORG_REQUIRED_MESSAGE}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <DashboardTour ref={tourRef} storageKey={AGENT_ACTIVITY_TOUR_KEY} steps={tourSteps} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">AI Agent Activity</h1>
          <p className="text-sm text-ink-muted">
            What each agent decided on a report, and the policy it cited for that decision.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48" data-tour="runs-limit">
            <Select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              options={LIMIT_OPTIONS}
            />
          </div>
          <Button variant="outline" startIcon={RefreshCw} onClick={fetchRuns} isLoading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {serviceError && (
        <Alert variant="warning" title="AI activity unavailable">
          {serviceError} Reports are still processed normally.
        </Alert>
      )}

      <Card padding="none" data-tour="runs-table">
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              <Table.Head>Report</Table.Head>
              <Table.Head>Decision</Table.Head>
              <Table.Head>Priority</Table.Head>
              <Table.Head>Agents</Table.Head>
              <Table.Head>Report status</Table.Head>
              <Table.Head>Run at</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading colSpan={6} rows={5} />
            ) : runs.length === 0 ? (
              <Table.Empty
                message="No agent runs yet"
                description="Once a report is processed by the AI agents, its decisions and policy citations appear here."
                icon={Bot}
              />
            ) : (
              runs.map((run) => {
                // `decision` may be null on older runs.
                const decision = run.decision ? DECISION_LABELS[run.decision] : null;
                return (
                  <Table.Row
                    key={`${run.report_id}-${run.created_at}`}
                    className="cursor-pointer"
                    onClick={() => setSelectedRun(run)}
                  >
                    <Table.Cell>
                      <p className="font-mono text-xs text-ink-muted">{run.report_number}</p>
                      <p className="mt-0.5 max-w-xs truncate text-sm font-semibold text-ink">
                        {run.title || 'Untitled report'}
                      </p>
                    </Table.Cell>
                    <Table.Cell>
                      {decision ? (
                        <Badge variant={decision.variant} size="small">
                          {decision.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-ink-subtle">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {run.priority ? (
                        <PriorityBadge priority={run.priority} />
                      ) : (
                        <span className="text-xs text-ink-subtle">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <AgentPills agents={run.agents || {}} />
                    </Table.Cell>
                    <Table.Cell>
                      {run.report_status ? (
                        <StatusBadge status={run.report_status} />
                      ) : (
                        <span className="text-xs text-ink-subtle">—</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="whitespace-nowrap text-xs text-ink-muted">
                        {formatRunTime(run.timestamp || run.created_at)}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })
            )}
          </Table.Body>
        </Table>
      </Card>

      <AgentRunDetailModal
        run={selectedRun}
        isOpen={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        orgSlug={user?.organization_slug}
      />

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-subtle">
        <Activity className="h-3 w-3" />
        Runs whose report is outside your organization are never listed.
      </p>
    </div>
  );
};

export default AgentActivity;
