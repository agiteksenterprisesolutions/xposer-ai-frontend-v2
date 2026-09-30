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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Bot, Eye, KeyRound, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import AgentEditorModal from '../../components/agents/AgentEditorModal';
import AgentTokenModal from '../../components/agents/AgentTokenModal';
import { orgAgentsAPI } from '../../api/orgAgents';
import { orgRolesAPI } from '../../api/orgRoles';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { ACCESS, PERM } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import { AGENT_KIND_INFO, capabilityLabel } from '../../utils/agents';
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

const AgentCard = ({ agent, canManage, roleLink, nameFor, onEdit, onToken, onDelete }) => {
  const kind = AGENT_KIND_INFO[agent.kind];
  const effective = agent.effective_capabilities || [];
  const disabled = agent.disabled_capabilities || [];
  const fromRole = agent.role_source === 'org_role';

  return (
    <Card padding="none" className={`overflow-hidden ${agent.is_active === false ? 'opacity-75' : ''}`}>
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-active">
            <Bot className="h-5 w-5 text-ink-muted" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-ink">{agent.name}</h3>
              <Badge variant={agent.kind === 'summarizer' ? 'info' : 'primary'} size="small">
                {kind?.label || agent.kind}
              </Badge>
              {agent.is_active === false && <Badge variant="warning" size="small">Inactive</Badge>}
              <Badge variant={agent.has_token ? 'success' : 'default'} size="small">
                {agent.has_token ? 'Token set' : 'No token'}
              </Badge>
            </div>
            <p className="mt-0.5 font-mono text-xs text-ink-subtle">{agent.code}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {fromRole ? (
                <>
                  Acts as the <span className="font-medium text-ink">{nameFor(agent.role_code)}</span> role
                </>
              ) : (
                <>Custom permissions ({agent.permissions?.length || 0})</>
              )}
              {agent.description ? ` · ${agent.description}` : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canManage ? (
            <>
              <Button variant="outline" size="small" startIcon={Pencil} onClick={() => onEdit(agent)}>
                Edit
              </Button>
              <Button
                variant="outline"
                size="small"
                startIcon={KeyRound}
                onClick={() => onToken(agent, agent.has_token ? 'rotate' : 'mint')}
              >
                {agent.has_token ? 'Rotate token' : 'Create token'}
              </Button>
              {agent.has_token && (
                <Button variant="ghost" size="small" onClick={() => onToken(agent, 'revoke')}>
                  Revoke
                </Button>
              )}
              <Button
                variant="ghost"
                size="small"
                onClick={() => onDelete(agent)}
                aria-label={`Delete ${agent.name}`}
                title="Delete agent"
              >
                <Trash2 className="h-4 w-4 text-danger-fg" />
              </Button>
            </>
          ) : (
            <Button variant="outline" size="small" startIcon={Eye} onClick={() => onEdit(agent)}>
              View
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-line-subtle bg-subtle px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Will do</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {effective.length === 0 ? (
              <span className="text-xs text-ink-muted">Nothing — no ticked capability can work with these permissions.</span>
            ) : (
              effective.map((capability) => (
                <Badge key={capability} variant="success" size="small">
                  {capabilityLabel(capability)}
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Ticked but inert — without this an admin cannot tell why the agent is silent. */}
        {disabled.length > 0 && (
          <ul className="space-y-1.5">
            {disabled.map(({ capability, requires }) => (
              <li key={capability} className="flex items-start gap-2 text-xs text-warning-fg">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-medium">{capabilityLabel(capability)}</span> is off: it needs{' '}
                  <span className="font-mono">{requires}</span>{' '}
                  {fromRole ? (
                    <>
                      on the{' '}
                      {roleLink ? (
                        <Link to={roleLink} className="font-medium underline">
                          {nameFor(agent.role_code)}
                        </Link>
                      ) : (
                        <span className="font-medium">{nameFor(agent.role_code)}</span>
                      )}{' '}
                      role.
                    </>
                  ) : (
                    "in this agent's custom permissions."
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {agent.kind !== 'summarizer' && agent.decisions?.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Decisions</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {agent.decisions.map((decision) => (
                <span key={decision} className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink-secondary">
                  {decision}
                </span>
              ))}
            </div>
          </div>
        )}

        {agent.instructions && (
          <p className="line-clamp-2 text-xs text-ink-muted" title={agent.instructions}>
            {agent.instructions}
          </p>
        )}
      </div>
    </Card>
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
  const { nameFor } = useOrgRoles();

  const [agents, setAgents] = useState([]);
  const [capabilityCatalog, setCapabilityCatalog] = useState(null);
  const [permissionCatalog, setPermissionCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // { agent } — agent null means create
  const [tokenAction, setTokenAction] = useState(null); // { agent, mode }
  const [deleting, setDeleting] = useState(null);

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
    ]);
    setLoading(false);
  }, [fetchAgents]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ?new=summarizer (from the Summarizer page's "Create a summarizer") opens
  // the editor with that kind chosen, once the catalog it needs has loaded.
  const [searchParams, setSearchParams] = useSearchParams();
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
    () => [...agents].sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || a.name.localeCompare(b.name)),
    [agents],
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-ink">AI Agents</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Each agent acts with a set of permissions, like a member of staff, and does only what they allow.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" startIcon={RefreshCw} onClick={loadAll} disabled={loading}>
            Refresh
          </Button>
          {canManage && (
            <Button startIcon={Plus} onClick={() => setEditing({ agent: null })} disabled={!capabilityCatalog}>
              New agent
            </Button>
          )}
        </div>
      </div>

      {!canManage && (
        <Alert variant="info" title="View only">
          Your role can see the agents but not change them. Changing them needs the agent:manage permission.
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

      {loading && agents.length === 0 && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl border border-line bg-surface" />
          ))}
        </div>
      )}

      {!loading && !error && agents.length === 0 && (
        <Card className="py-12 text-center">
          <Bot className="mx-auto h-8 w-8 text-ink-subtle" />
          <p className="mt-3 text-sm font-semibold text-ink">No agents yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Define an analyst to triage and decide, or a summarizer to digest the evidence on each report.
          </p>
          {canManage && capabilityCatalog && (
            <Button className="mt-4" startIcon={Plus} onClick={() => setEditing({ agent: null })}>
              Create your first agent
            </Button>
          )}
        </Card>
      )}

      {sorted.length > 0 && (
        <div className="space-y-4">
          {sorted.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              canManage={canManage}
              roleLink={roleLink}
              nameFor={nameFor}
              onEdit={(a) => capabilityCatalog && setEditing({ agent: a })}
              onToken={(a, mode) => setTokenAction({ agent: a, mode })}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {editing && capabilityCatalog && (
        <AgentEditorModal
          agent={editing.agent}
          initialKind={editing.initialKind}
          capabilityCatalog={capabilityCatalog}
          permissionCatalog={permissionCatalog}
          readOnly={!canManage}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            fetchAgents();
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
