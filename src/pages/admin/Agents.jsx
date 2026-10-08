// src/pages/admin/Agents.jsx
//
// The organization's AI agents. There are no fixed agents any more: each is
// defined here, acts with the permissions of one of the organization's roles
// (or its own custom set), and does only what those permissions allow.
//
// The key idea on this page: show what an agent will actually do
// (`effective_capabilities`), and explain anything ticked that it can't
// (`disabled_capabilities`) — with a link to the role to fix. Both are
// resolved live on the server, so a role edit elsewhere shows up here on the
// next load with no change to the agent.
//
// Layout: a searchable list of agents on the left, the selected one's detail
// on the right (?agent=<code> keeps the selection in the URL).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  GitBranch,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Trash2,
  EyeOff,
  Lock,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import Dropdown from '../../components/ui/Dropdown';
import AgentEditorModal from '../../components/agents/AgentEditorModal';
import AgentTokenModal from '../../components/agents/AgentTokenModal';
import { orgAgentsAPI } from '../../api/orgAgents';
import { orgRolesAPI } from '../../api/orgRoles';
import { orgWorkflowsAPI } from '../../api/orgWorkflows';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { ACCESS, PERM, permissionLabel } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import { parseServerDate } from '../../utils/formatters';
import { AGENT_KIND_INFO, CAPABILITY_INFO, SUMMARIZER_CAPABILITIES, capabilityLabel, isSummarizer as isSummarizerAgent } from '../../utils/agents';
import { EXECUTOR_AGENT } from '../../utils/workflows';
import useSEO from '../../hooks/useSEO';

const DeleteAgentModal = ({ agent, onClose, onDeleted }) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await orgAgentsAPI.remove(agent.id);
      toast.success(`Agent "${agent.name}" deleted.`);
      onDeleted?.();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={deleting ? () => {} : onClose}
      title={`Delete ${agent.name}?`}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            {error ? 'Close' : 'Cancel'}
          </Button>
          {!error && (
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete agent
            </Button>
          )}
        </div>
      }
    >
      {!error ? (
        <p className="text-sm leading-relaxed text-ink-secondary">
          The <span className="font-mono text-ink">{agent.code}</span> agent and its token will be removed. This cannot be
          undone. To stop it for now instead, edit it and turn off Active.
        </p>
      ) : (
        <Alert variant={error.status === 409 ? 'warning' : 'error'} title="This agent can't be deleted yet">
          <p>{error.summary}</p>
          {error.status === 409 && (
            <p className="mt-2">Remove it from every workflow stage that runs it first, then delete it.</p>
          )}
        </Alert>
      )}
    </Modal>
  );
};


const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'analyst', label: 'Analysts' },
  { value: 'summarizer', label: 'Summarizers' },
  { value: 'attention', label: 'Needs attention' },
];

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'instructions', label: 'Instructions' },
  { value: 'token', label: 'Access token' },
];

/** Inactive, or something ticked that its permissions won't allow. */
const needsAttention = (agent) => agent.is_active === false || (agent.disabled_capabilities || []).length > 0;

const formatDate = (value) => {
  const date = parseServerDate(value);
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
};

const AgentIcon = ({ agent, size = 'md' }) => {
  const isSummarizer = agent.kind === 'summarizer';
  const Icon = isSummarizer ? ScrollText : Bot;
  const box = size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-9 w-9 rounded-lg';
  const glyph = size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]';
  const tone =
    agent.is_active === false
      ? 'bg-active text-ink-muted'
      : isSummarizer
        ? 'bg-info-soft text-info-fg'
        : 'bg-accent text-on-accent';
  return (
    <span className={`flex shrink-0 items-center justify-center ${box} ${tone}`}>
      <Icon className={glyph} />
    </span>
  );
};

const StatTile = ({ label, value, hint, tone }) => (
  <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
    <p className="text-xs font-medium text-ink-subtle">{label}</p>
    <p className={`mt-1 text-2xl font-bold tracking-tight ${tone || 'text-ink'}`}>{value}</p>
    <p className="mt-0.5 truncate text-xs text-ink-muted">{hint}</p>
  </div>
);

const Section = ({ title, aside, children, className = '' }) => (
  <section className={`space-y-3 rounded-xl border border-line-subtle p-4 ${className}`}>
    <div className="flex items-baseline justify-between gap-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

/** Every capability there is, marked as what this agent will do, can't do, or hasn't been given. */
const CapabilityList = ({ agent, capabilityCatalog, roleLink, nameFor }) => {
  const effective = new Set(agent.effective_capabilities || []);
  const blocked = new Map((agent.disabled_capabilities || []).map((d) => [d.capability, d.requires]));
  const forbidden = new Map();
  // A summarizer is only ever offered its three; the refused rest aren't listed.
  const all = isSummarizerAgent(agent)
    ? [...SUMMARIZER_CAPABILITIES]
    : (capabilityCatalog?.capabilities || []).map((c) => c.capability);
  // Anything the agent holds that the catalog doesn't list still shows.
  [...effective, ...blocked.keys()].forEach((c) => !all.includes(c) && all.push(c));
  const fromRole = agent.role_source === 'org_role';

  const order = (c) => (effective.has(c) ? 0 : blocked.has(c) ? 1 : forbidden.has(c) ? 3 : 2);
  const sorted = [...all].sort((a, b) => order(a) - order(b));

  return (
    <ul className="overflow-hidden rounded-xl border border-line-subtle">
      {sorted.map((capability, index) => {
        const on = effective.has(capability);
        const requires = blocked.get(capability);
        const isBlocked = requires !== undefined;
        const reason = forbidden.get(capability);
        return (
          <li
            key={capability}
            className={`flex items-center gap-3 px-3.5 py-3 ${index ? 'border-t border-line-subtle' : ''} ${
              isBlocked ? 'bg-warning-soft' : ''
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                on
                  ? 'bg-accent text-on-accent'
                  : isBlocked
                    ? 'bg-warning-solid text-ink-inverse'
                    : 'border-[1.5px] border-line-strong'
              }`}
            >
              {on && <Check className="h-3 w-3" strokeWidth={3} />}
              {isBlocked && <span className="text-[11px] font-bold leading-none">!</span>}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${on || isBlocked ? 'font-semibold text-ink' : 'font-medium text-ink-muted'}`}>
                {capabilityLabel(capability)}
              </p>
              <p className={`text-xs ${isBlocked ? 'text-warning-fg' : 'text-ink-subtle'}`}>
                {isBlocked ? (
                  <>
                    Turned on, but {fromRole ? `the ${nameFor(agent.role_code)} role doesn't` : "its custom permissions don't"}{' '}
                    include “{permissionLabel(requires)}”.
                  </>
                ) : reason ? (
                  `Not for summarizers: ${reason}.`
                ) : on ? (
                  CAPABILITY_INFO[capability]?.description || ''
                ) : (
                  'Not turned on for this agent.'
                )}
              </p>
            </div>
            {isBlocked && fromRole && roleLink && (
              <Link to={roleLink} className="shrink-0 text-xs font-semibold text-link hover:underline">
                Fix in Roles →
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
};

/** Stats, list and detail while the agents load — same frames, data stubbed. */
const AgentsSkeleton = () => (
  <div className="space-y-5" aria-busy="true">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {['Agents', 'Active', 'Needs attention', 'In the running workflow'].map((label) => (
        <div key={label} className="rounded-xl border border-line bg-surface px-4 py-3.5">
          <p className="text-xs font-medium text-ink-subtle">{label}</p>
          <Skeleton.Text size="2xl" className="mt-1 w-8" />
          <Skeleton.Text size="xs" className="mt-0.5 w-28" />
        </div>
      ))}
    </div>

    <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="space-y-2.5 border-b border-line-subtle p-3">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
            <span className="text-sm text-ink-subtle">Search agents</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['w-12', 'w-20', 'w-24'].map((w) => (
              <Skeleton key={w} className={`h-6.5 rounded-full ${w}`} />
            ))}
          </div>
        </div>
        <ul className="space-y-0.5 p-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5">
              <Skeleton.Icon />
              <span className="min-w-0 flex-1">
                <Skeleton.Text className="w-28" />
                <Skeleton.Text size="xs" className="w-36" />
              </span>
              <Skeleton.Circle size="h-2 w-2" />
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Skeleton.Icon size="h-12 w-12" className="rounded-xl" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton.Text size="lg" className="w-32" />
                <Skeleton.Badge className="w-14" />
              </div>
              <Skeleton.Text size="xs" className="mt-1 w-64" />
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Skeleton.Button small className="w-24" />
            <Skeleton.Button small className="w-8" />
          </div>
        </div>
        <Skeleton.Text className="mx-5 mt-3 w-2/3 sm:mx-6" />
        <div className="mt-4 flex gap-1 border-b border-line-subtle px-5 sm:px-6">
          {['w-16', 'w-20', 'w-24'].map((w) => (
            <span key={w} className="px-3 py-2.5">
              <Skeleton.Text className={w} />
            </span>
          ))}
        </div>
        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <Skeleton.Text className="w-28" />
            <ul className="overflow-hidden rounded-xl border border-line-subtle">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <li key={i} className={`flex items-center gap-3 px-3.5 py-3 ${i ? 'border-t border-line-subtle' : ''}`}>
                  <Skeleton.Circle size="h-5 w-5" />
                  <div className="min-w-0 flex-1">
                    <Skeleton.Text className="w-36" />
                    <Skeleton.Text size="xs" className="w-52" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            {[2, 2].map((lines, i) => (
              <section key={i} className="space-y-3 rounded-xl border border-line-subtle p-4">
                <Skeleton.Text className="w-36" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton.Lines size="xs" lines={lines} />
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

/**
 * Which confidentiality levels an agent can read: its role's clearance (or its
 * custom set's). The summarizer is cleared for every level — its only output
 * is a note on the same case, which only cleared people can read. Null when
 * the permissions aren't known.
 */
const readableTiers = (agent, byCode) => {
  if (agent.kind === 'summarizer') return ['Standard', 'Confidential', 'Restricted'];
  const permissions =
    agent.effective_permissions ||
    (agent.role_source === 'org_role' ? byCode?.get(agent.role_code)?.permissions : agent.permissions);
  if (!Array.isArray(permissions)) return null;
  const tiers = ['Standard'];
  if (permissions.includes(PERM.reportReadConfidential)) {
    tiers.push('Confidential');
    if (permissions.includes(PERM.reportReadRestricted)) tiers.push('Restricted');
  }
  return tiers;
};

const AgentDetail = ({
  agent,
  tab,
  onTab,
  canManage,
  capabilityCatalog,
  usage,
  roleLink,
  nameFor,
  byCode,
  paths,
  onEdit,
  onToken,
  onDelete,
  onToggleSummarizer,
}) => {
  const [switching, setSwitching] = useState(false);
  const kind = AGENT_KIND_INFO[agent.kind];
  const fromRole = agent.role_source === 'org_role';
  const isSummarizer = agent.kind === 'summarizer';
  const updated = formatDate(agent.updated_at);
  const issued = formatDate(agent.token_issued_at);
  const effectiveCount = (agent.effective_capabilities || []).length;
  const totalCount = isSummarizer ? SUMMARIZER_CAPABILITIES.length : (capabilityCatalog?.capabilities || []).length;

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Header */}
      <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <AgentIcon agent={agent} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-bold text-ink">{agent.name}</h2>
              {agent.is_active === false ? (
                <Badge size="small">Inactive</Badge>
              ) : (
                <Badge variant="success" size="small" dot>
                  Active
                </Badge>
              )}
              <Badge variant={isSummarizer ? 'info' : 'default'} size="small">
                {kind?.label || agent.kind}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              <span className="font-mono">{agent.code}</span>
              {' · '}
              {isSummarizer ? (
                'Fixed permissions'
              ) : fromRole ? (
                <>
                  Acts as the{' '}
                  {roleLink ? (
                    <Link to={roleLink} className="font-medium text-link hover:underline">
                      {nameFor(agent.role_code)} role
                    </Link>
                  ) : (
                    <span className="font-medium text-ink">{nameFor(agent.role_code)} role</span>
                  )}
                </>
              ) : (
                `Custom permissions (${(agent.effective_permissions || agent.permissions || []).length})`
              )}
              {updated && ` · Updated ${updated}`}
            </p>
            {readableTiers(agent, byCode) && (
              <p
                className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted"
                title={
                  isSummarizer
                    ? 'The summarizer is cleared for every level. Its summary is a note on the same case, which only cleared staff can read.'
                    : "An agent can read only the case levels its role is cleared for. Change that on the role's confidentiality permissions."
                }
              >
                <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                Reads: {readableTiers(agent, byCode).join(', ')} cases{isSummarizer ? ' (fixed)' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* The summarizer is switched on and off through the organization's
              summarizer settings (PUT /org-agents/summarizer), never with
              is_active on the agent — that is refused. */}
          {isSummarizer && canManage && (
            <Button
              variant="outline"
              size="small"
              isLoading={switching}
              onClick={async () => {
                setSwitching(true);
                try {
                  await onToggleSummarizer(agent.is_active === false);
                } finally {
                  setSwitching(false);
                }
              }}
            >
              {agent.is_active === false ? 'Switch on' : 'Switch off'}
            </Button>
          )}
          <Button variant={canManage ? 'secondary' : 'outline'} size="small" startIcon={Pencil} onClick={onEdit}>
            {canManage ? 'Edit agent' : 'View settings'}
          </Button>
          {canManage && (
            <Dropdown
              align="right"
              trigger={
                <button
                  type="button"
                  aria-label={`More actions for ${agent.name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-hover hover:text-ink"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            >
              <Dropdown.Item onClick={() => onToken(agent.has_token ? 'rotate' : 'mint')}>
                <KeyRound className="h-4 w-4 shrink-0" />
                {agent.has_token ? 'Rotate access token' : 'Create access token'}
              </Dropdown.Item>
              {/* One summarizer per organization, recreated by the platform:
                  deleting it is refused, so it isn't offered. */}
              {!isSummarizer && (
                <>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={onDelete} className="text-danger-fg hover:text-danger-fg">
                    <Trash2 className="h-4 w-4 shrink-0" />
                    Delete agent
                  </Dropdown.Item>
                </>
              )}
            </Dropdown>
          )}
        </div>
      </div>

      {agent.description && <p className="px-5 pt-3 text-sm text-ink-muted sm:px-6">{agent.description}</p>}

      {/* Tabs */}
      <div
        className="mt-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line-subtle px-5 scrollbar-none sm:px-6"
        role="tablist"
      >
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => onTab(value)}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
              tab === value
                ? 'border-accent font-semibold text-accent-fg'
                : 'border-transparent font-medium text-ink-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">What it can do</h3>
              {totalCount > 0 && (
                <span className="text-xs text-ink-subtle">
                  {effectiveCount} of {totalCount} capabilities
                </span>
              )}
            </div>
            <CapabilityList agent={agent} capabilityCatalog={capabilityCatalog} roleLink={roleLink} nameFor={nameFor} />
          </div>

          <div className="space-y-4">
            {isSummarizer ? (
              <Section title="Summaries">
                <p className="text-sm leading-relaxed text-ink-muted">
                  Your organization's one summarizer. It runs automatically before the first step of every workflow and
                  its digest is given to every agent step — it is never a step itself.
                </p>
                <Link to={paths.summarizer} className="inline-block text-sm font-semibold text-link hover:underline">
                  Summarizer settings →
                </Link>
              </Section>
            ) : (
              <Section title="Decisions it can reach">
                {agent.decisions?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {agent.decisions.map((decision) => (
                      <span
                        key={decision}
                        className="rounded-md bg-accent-soft px-2 py-1 font-mono text-xs font-medium text-accent-fg"
                      >
                        {decision}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="flex items-start gap-1.5 text-sm text-warning-fg">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    None yet — workflows can't branch on this agent, so every run just moves on to the next step.
                  </p>
                )}
                <p className="text-xs leading-relaxed text-ink-subtle">
                  Workflows can send a report somewhere different for each decision. Anything not branched on continues
                  to the next step.
                </p>
              </Section>
            )}

            <Section
              title="Used in workflows"
              aside={usage.length > 0 && <span className="text-xs text-ink-subtle">{usage.length}</span>}
            >
              {isSummarizer && usage.length > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-warning-fg">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  The summarizer can't be a step — these are skipped when a report runs. Remove them from the workflow.
                </p>
              )}
              {usage.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  {isSummarizer ? 'Not a step in any workflow, as it should be.' : 'Not a step in any workflow yet.'}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {usage.map(({ workflow, index, stage }) => (
                    <li key={`${workflow.id}-${stage.key}`}>
                      <Link
                        to={`${paths.workflows}/${workflow.id}`}
                        className="group flex items-center gap-3 rounded-lg bg-subtle px-3 py-2.5 transition-colors hover:bg-hover"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface ${
                            workflow.is_active ? 'text-accent-fg' : 'text-ink-subtle'
                          }`}
                        >
                          <GitBranch className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{workflow.name}</span>
                          <span className="block truncate text-xs text-ink-subtle">
                            Step {index + 1} · {stage.name || stage.key} · {workflow.is_active ? 'Running' : 'Standby'}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {paths.activity && (
              <Link
                to={paths.activity}
                className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm transition-colors hover:border-line-accent hover:bg-hover"
              >
                <Activity className="h-4 w-4 shrink-0 text-ink-subtle" />
                <span className="flex-1 text-ink-muted">See what agents have done in AI Activity</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle" />
              </Link>
            )}
          </div>
        </div>
      )}

      {tab === 'instructions' && (
        <div className="space-y-3 p-5 sm:p-6">
          <p className="text-xs text-ink-subtle">
            Extra direction this agent follows on top of its built-in role. The Knowledge Base adds your policy documents.
          </p>
          {agent.instructions ? (
            <div className="whitespace-pre-wrap rounded-xl border border-line-subtle bg-subtle p-4 text-sm leading-relaxed text-ink-secondary">
              {agent.instructions}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center">
              <p className="text-sm font-medium text-ink">No instructions</p>
              <p className="mt-1 text-xs text-ink-muted">The agent works from its built-in behaviour and your policy documents.</p>
              {canManage && (
                <Button className="mt-3" variant="outline" size="small" startIcon={Pencil} onClick={onEdit}>
                  Write instructions
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'token' && (
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-4 rounded-xl border border-line-subtle p-4 sm:flex-row sm:items-center">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                agent.has_token ? 'bg-success-soft text-success-fg' : 'bg-active text-ink-muted'
              }`}
            >
              <KeyRound className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{agent.has_token ? 'Token issued' : 'No token'}</p>
              <p className="text-xs text-ink-muted">
                {agent.has_token
                  ? `Issued ${issued || 'earlier'}. It is shown once when created; rotate it if it may have leaked.`
                  : 'The agent runtime signs in with a token. Create one when you connect a runtime.'}
              </p>
            </div>
            {canManage && (
              <div className="flex shrink-0 gap-2">
                <Button variant="secondary" size="small" onClick={() => onToken(agent.has_token ? 'rotate' : 'mint')}>
                  {agent.has_token ? 'Rotate' : 'Create token'}
                </Button>
                {agent.has_token && (
                  <Button variant="ghost" size="small" className="text-danger-fg" onClick={() => onToken('revoke')}>
                    Revoke
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Agents = () => {
  useSEO({
    title: 'AI Agents',
    description: "Define the AI agents that work your organization's reports.",
    noIndex: true,
  });
  const can = useCan();
  const canManage = can(PERM.agentManage);
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const roleLink = can(ACCESS.roles) ? staffPath(orgSlug, 'roles') : null;
  const { nameFor, byCode } = useOrgRoles();
  const paths = {
    workflows: staffPath(orgSlug, 'workflows'),
    summarizer: staffPath(orgSlug, 'summarizer'),
    activity: staffPath(orgSlug, 'agent-runs'),
  };

  const [agents, setAgents] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [capabilityCatalog, setCapabilityCatalog] = useState(null);
  const [permissionCatalog, setPermissionCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // { agent } — agent null means create
  const [tokenAction, setTokenAction] = useState(null); // { agent, mode }
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('overview');

  const fetchAgents = useCallback(async () => {
    try {
      setAgents(await orgAgentsAPI.list());
      setError(null);
    } catch (err) {
      setError(errorSummary(err));
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchAgents(),
      orgAgentsAPI.capabilities().then(setCapabilityCatalog).catch((err) => setError(errorSummary(err))),
      // For agents given a custom permission set; also says what the signed-in
      // user may grant. Not fatal — "use a role" still works without it.
      orgRolesAPI.catalog().then(setPermissionCatalog).catch(() => setPermissionCatalog(null)),
      // Only to show where each agent is used; the page works without it.
      orgWorkflowsAPI
        .list()
        .then((data) => setWorkflows(Array.isArray(data) ? data : []))
        .catch(() => setWorkflows([])),
    ]);
    setLoading(false);
  }, [fetchAgents]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const [searchParams, setSearchParams] = useSearchParams();

  // ?new=summarizer (from the Summarizer page's "Create a summarizer") opens
  // the editor with that kind chosen, once the catalog it needs has loaded.
  const requestedKind = searchParams.get('new');
  useEffect(() => {
    if (!requestedKind || !capabilityCatalog || !canManage) return;
    setEditing({ agent: null, initialKind: requestedKind });
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('new');
        return next;
      },
      { replace: true },
    );
  }, [requestedKind, capabilityCatalog, canManage, setSearchParams]);

  const sorted = useMemo(
    () =>
      [...agents].sort(
        (a, b) =>
          Number(a.kind === 'summarizer') - Number(b.kind === 'summarizer') ||
          Number(b.is_active !== false) - Number(a.is_active !== false) ||
          a.name.localeCompare(b.name),
      ),
    [agents],
  );

  const usageByCode = useMemo(() => {
    const map = new Map();
    workflows.forEach((workflow) =>
      (workflow.stages || []).forEach((stage, index) => {
        if (stage.executor_type !== EXECUTOR_AGENT) return;
        if (!map.has(stage.executor_ref)) map.set(stage.executor_ref, []);
        map.get(stage.executor_ref).push({ workflow, index, stage });
      }),
    );
    map.forEach((list) => list.sort((a, b) => Number(b.workflow.is_active) - Number(a.workflow.is_active)));
    return map;
  }, [workflows]);

  const counts = {
    all: agents.length,
    analyst: agents.filter((a) => a.kind !== 'summarizer').length,
    summarizer: agents.filter((a) => a.kind === 'summarizer').length,
    attention: agents.filter(needsAttention).length,
  };
  const activeCount = agents.filter((a) => a.is_active !== false).length;
  const running = workflows.find((w) => w.is_active);
  const inRunning = running
    ? new Set((running.stages || []).filter((s) => s.executor_type === EXECUTOR_AGENT).map((s) => s.executor_ref)).size
    : 0;

  const visible = sorted.filter((agent) => {
    const term = query.trim().toLowerCase();
    if (term && ![agent.name, agent.code, agent.description].some((v) => (v || '').toLowerCase().includes(term))) return false;
    if (filter === 'analyst') return agent.kind !== 'summarizer';
    if (filter === 'summarizer') return agent.kind === 'summarizer';
    if (filter === 'attention') return needsAttention(agent);
    return true;
  });

  const selectedCode = searchParams.get('agent');
  const selected = sorted.find((a) => a.code === selectedCode) || visible[0] || sorted[0] || null;
  const select = (code) => {
    setTab('overview');
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('agent', code);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-xl font-bold text-ink">AI Agents</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            Each agent acts with the permissions of one of your roles and reaches the decisions your workflows branch on.
          </p>
          <p className="mt-1.5 flex max-w-2xl items-center gap-1.5 text-xs text-ink-muted">
            <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            AI agents never see answers marked sensitive; they see •••• instead.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={loadAll} disabled={loading} aria-label="Refresh" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link to={paths.workflows}>
            <Button variant="outline" startIcon={GitBranch}>
              Workflows
            </Button>
          </Link>
          {canManage && (
            <Button startIcon={Plus} onClick={() => setEditing({ agent: null })} disabled={!capabilityCatalog}>
              New agent
            </Button>
          )}
        </div>
      </div>

      {!canManage && (
        <Alert variant="info" title="View only">
          Your role can see the agents but not change them. Changing them needs permission to configure AI agents.
        </Alert>
      )}

      {error && (
        <Alert variant="error" title="Couldn't load the agents">
          {error}{' '}
          <button type="button" onClick={loadAll} className="font-medium text-link hover:underline">
            Try again
          </button>
        </Alert>
      )}

      {loading && agents.length === 0 && <AgentsSkeleton />}

      {!loading && !error && agents.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface py-14 text-center">
          <Bot className="mx-auto h-8 w-8 text-ink-subtle" />
          <p className="mt-3 text-sm font-semibold text-ink">No agents yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Define an analyst to triage a report and reach a decision your workflows can branch on.
          </p>
          {canManage && capabilityCatalog && (
            <Button className="mt-4" startIcon={Plus} onClick={() => setEditing({ agent: null })}>
              Create your first agent
            </Button>
          )}
        </div>
      )}

      {agents.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Agents"
              value={counts.all}
              hint={`${counts.analyst} analyst${counts.analyst === 1 ? '' : 's'}, ${counts.summarizer} summarizer${
                counts.summarizer === 1 ? '' : 's'
              }`}
            />
            <StatTile
              label="Active"
              value={activeCount}
              hint={activeCount === counts.all ? 'All switched on' : `${counts.all - activeCount} switched off`}
            />
            <StatTile
              label="Needs attention"
              value={counts.attention}
              tone={counts.attention ? 'text-warning-fg' : undefined}
              hint={counts.attention ? 'Switched off, or a capability is blocked' : 'Nothing to fix'}
            />
            <StatTile
              label="In the running workflow"
              value={running ? inRunning : '—'}
              hint={running ? running.name : 'No workflow is running'}
            />
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
            {/* List */}
            <div className="overflow-hidden rounded-2xl border border-line bg-surface lg:sticky lg:top-20">
              <div className="space-y-2.5 border-b border-line-subtle p-3">
                <label className="flex items-center gap-2 rounded-lg border border-line bg-subtle px-3 py-2 focus-within:border-line-accent">
                  <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search agents"
                    aria-label="Search agents"
                    className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.filter((f) => f.value === 'all' || counts[f.value] > 0).map(({ value, label }) => {
                    const on = filter === value;
                    const warn = value === 'attention';
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        aria-pressed={on}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          on
                            ? 'border-ink bg-ink text-canvas'
                            : warn
                              ? 'border-warning-line bg-warning-soft text-warning-fg hover:brightness-95'
                              : 'border-line text-ink-secondary hover:bg-hover'
                        }`}
                      >
                        {label} {counts[value]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <ul className="max-h-[32rem] space-y-0.5 overflow-y-auto p-1.5">
                {visible.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-muted">No agents match.</li>}
                {visible.map((agent) => {
                  const on = selected?.id === agent.id;
                  return (
                    <li key={agent.id}>
                      <button
                        type="button"
                        onClick={() => select(agent.code)}
                        aria-current={on ? 'true' : undefined}
                        className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2.5 text-left transition-colors ${
                          on ? 'border-line-accent bg-accent-soft' : 'border-transparent hover:bg-hover'
                        }`}
                      >
                        <AgentIcon agent={agent} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-ink">{agent.name}</span>
                            {needsAttention(agent) && (
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-fg" aria-label="Needs attention" />
                            )}
                          </span>
                          <span className="block truncate text-xs text-ink-subtle">
                            {AGENT_KIND_INFO[agent.kind]?.label || agent.kind} ·{' '}
                            {isSummarizerAgent(agent)
                              ? 'runs before every workflow'
                              : agent.role_source === 'org_role'
                                ? `acts as ${nameFor(agent.role_code)}`
                                : 'custom permissions'}
                          </span>
                        </span>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${agent.is_active === false ? 'bg-line-strong' : 'bg-success-solid'}`}
                          aria-label={agent.is_active === false ? 'Inactive' : 'Active'}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Detail */}
            {selected && (
              <AgentDetail
                agent={selected}
                tab={tab}
                onTab={setTab}
                canManage={canManage}
                capabilityCatalog={capabilityCatalog}
                usage={usageByCode.get(selected.code) || []}
                roleLink={roleLink}
                nameFor={nameFor}
                byCode={byCode}
                paths={paths}
                onEdit={() => capabilityCatalog && setEditing({ agent: selected })}
                onToken={(mode) => setTokenAction({ agent: selected, mode })}
                onDelete={() => setDeleting(selected)}
                onToggleSummarizer={async (on) => {
                  try {
                    await orgAgentsAPI.updateSummarizer({ enabled: on });
                    toast.success(
                      on
                        ? 'Summaries switched on.'
                        : 'Summaries switched off. The other agents still run, on the report text alone.',
                    );
                  } catch (err) {
                    toast.error(errorSummary(err));
                  }
                  // The switch changes the agent row's state; re-read so this list agrees.
                  await fetchAgents();
                }}
              />
            )}
          </div>
        </>
      )}

      {editing && capabilityCatalog && (
        <AgentEditorModal
          agent={editing.agent}
          initialKind={editing.initialKind}
          canCreateSummarizer={!agents.some(isSummarizerAgent)}
          capabilityCatalog={capabilityCatalog}
          permissionCatalog={permissionCatalog}
          readOnly={!canManage}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            fetchAgents();
            if (saved?.code) select(saved.code);
          }}
        />
      )}

      {tokenAction && (
        <AgentTokenModal
          agent={tokenAction.agent}
          mode={tokenAction.mode}
          onClose={() => setTokenAction(null)}
          onDone={(options) => {
            fetchAgents();
            if (!options?.keepOpen) setTokenAction(null);
          }}
        />
      )}

      {deleting && (
        <DeleteAgentModal
          agent={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            fetchAgents();
          }}
        />
      )}
    </div>
  );
};

export default Agents;
