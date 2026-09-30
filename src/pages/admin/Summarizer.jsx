// src/pages/admin/Summarizer.jsx
//
// Whether the summarizer runs is an organization-level switch, separate from
// the agent's own is_active flag, its role, and the workflow.
//
// The one subtlety: the switch is bound to `enabled` (what the organization
// asked for), but the status beside it reads `active` (what will actually
// happen). When they disagree, `problems` says why, and each gets its own fix.
//
// Who may read the digests is not managed here. It is the agent:summary_read
// permission on roles, so the access panel is a read-only mirror with a link
// to the roles editor — one place to change it, not two.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileText, Lock, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import { Checkbox } from '../../components/roles/PermissionPicker';
import { orgAgentsAPI } from '../../api/orgAgents';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { ACCESS, PERM } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import { capabilityLabel } from '../../utils/agents';
import useSEO from '../../hooks/useSEO';

const MIN_WORDS = 50;
const MAX_WORDS = 4000;
const AUTOMATIC = '';

const Switch = ({ checked, disabled, onChange, label, busy }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled || busy}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${
      checked ? 'bg-success-solid' : 'bg-active'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      } ${busy ? 'animate-pulse' : ''}`}
    />
  </button>
);

const StatusPill = ({ settings }) => {
  if (settings.active) {
    return (
      <Badge variant="success" size="medium" dot>
        Running
      </Badge>
    );
  }
  if (settings.enabled) {
    return (
      <Badge variant="warning" size="medium" dot>
        On, but not running
      </Badge>
    );
  }
  return (
    <Badge variant="default" size="medium" dot>
      Off
    </Badge>
  );
};

/** The fix for each reason the switch can be on while nothing happens. */
const ProblemAction = ({ code, agentsPath, canManage }) => {
  if (!canManage) return null;
  switch (code) {
    case 'no_summarizer_agent':
      return (
        <Link to={`${agentsPath}?new=summarizer`} className="font-medium text-link hover:underline">
          Create a summarizer →
        </Link>
      );
    case 'ambiguous_summarizer':
      return <span className="text-ink-secondary">Choose which agent to use under Settings below.</span>;
    case 'summarizer_inactive':
      return (
        <Link to={agentsPath} className="font-medium text-link hover:underline">
          Open the agent to reactivate it →
        </Link>
      );
    default:
      return null;
  }
};

const Summarizer = () => {
  useSEO({
    title: 'Summarizer',
    description: 'Turn the AI evidence digest on or off and choose how it summarizes.',
    noIndex: true,
  });
  const can = useCan();
  const canManage = can(PERM.agentManage);
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const agentsPath = staffPath(orgSlug, 'agents');
  const rolesPath = can(ACCESS.roles) ? staffPath(orgSlug, 'roles') : null;

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toggling, setToggling] = useState(false);

  // The Settings form, saved separately from the switch.
  const [agentCode, setAgentCode] = useState(AUTOMATIC);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [maxWords, setMaxWords] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const applySettings = useCallback((data) => {
    setSettings(data);
    setAgentCode(data?.agent_code ?? AUTOMATIC);
    setIncludeAttachments(Boolean(data?.include_attachments));
    setMaxWords(data?.max_words != null ? String(data.max_words) : '');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      applySettings(await orgAgentsAPI.getSummarizer());
      setLoadError(null);
    } catch (error) {
      setLoadError(errorSummary(error));
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    load();
  }, [load]);

  // A PUT's response shape isn't promised to include the derived fields
  // (active, problems, resolved_agent), so re-read after every write.
  const writeAndReload = async (changes) => {
    await orgAgentsAPI.updateSummarizer(changes);
    applySettings(await orgAgentsAPI.getSummarizer());
  };

  const toggleEnabled = async () => {
    const next = !settings.enabled;
    setToggling(true);
    try {
      await writeAndReload({ enabled: next });
      toast.success(next ? 'Summarizer switched on.' : 'Summarizer switched off.');
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setToggling(false);
    }
  };

  const wordsNumber = Number(maxWords);
  const wordsError =
    maxWords === '' || !Number.isInteger(wordsNumber) || wordsNumber < MIN_WORDS || wordsNumber > MAX_WORDS
      ? `Between ${MIN_WORDS} and ${MAX_WORDS} words.`
      : null;

  const changes = useMemo(() => {
    if (!settings) return {};
    const diff = {};
    if (agentCode !== (settings.agent_code ?? AUTOMATIC)) diff.agent_code = agentCode || null;
    if (includeAttachments !== Boolean(settings.include_attachments)) diff.include_attachments = includeAttachments;
    if (!wordsError && wordsNumber !== settings.max_words) diff.max_words = wordsNumber;
    return diff;
  }, [settings, agentCode, includeAttachments, wordsNumber, wordsError]);

  const isDirty = Object.keys(changes).length > 0;

  const saveSettings = async () => {
    if (!isDirty || wordsError) return;
    setSaving(true);
    setSaveError(null);
    try {
      await writeAndReload(changes);
      toast.success('Summarizer settings saved.');
    } catch (error) {
      setSaveError(describeError(error));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !settings) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-line bg-surface" />
        ))}
      </div>
    );
  }

  if (loadError && !settings) {
    return (
      <Alert variant="error" title="Couldn't load the summarizer settings">
        {loadError}{' '}
        <button type="button" onClick={load} className="font-medium text-link hover:underline">
          Try again
        </button>
      </Alert>
    );
  }

  const problems = settings.problems || [];
  const agents = settings.available_agents || [];
  const stages = settings.affected_stages || [];
  const resolved = settings.resolved_agent;
  const access = settings.access;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-ink">Summarizer</h1>
          <p className="mt-1 text-sm text-ink-muted">
            A factual digest of the evidence on each report, for whoever is working the case.
          </p>
        </div>
        <Button variant="outline" startIcon={RefreshCw} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {!canManage && (
        <Alert variant="info" title="View only">
          Your role can see these settings but not change them. Changing them needs the agent:manage permission.
        </Alert>
      )}

      {/* The switch */}
      <Card>
        <div className="flex items-start gap-4">
          <Switch
            checked={Boolean(settings.enabled)}
            onChange={toggleEnabled}
            disabled={!canManage}
            busy={toggling}
            label="Summarize new reports"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink">Summarize new reports</p>
              <StatusPill settings={settings} />
            </div>
            <p className="text-xs leading-relaxed text-ink-muted">
              {stages.length > 0 ? (
                <>
                  Controls the workflow stage{stages.length === 1 ? '' : 's'}{' '}
                  {stages.map((stage, index) => (
                    <span key={stage}>
                      {index > 0 && ', '}
                      <span className="font-mono text-ink">{stage}</span>
                    </span>
                  ))}
                  . Switched off, {stages.length === 1 ? 'it is' : 'they are'} skipped on the next run.{' '}
                </>
              ) : (
                'No workflow stage runs a summarizer yet, so this switch has nothing to control. '
              )}
              Switching off doesn't change the workflow, deactivate the agent or touch any role — so switching back on
              needs nothing else undone.
            </p>
          </div>
        </div>

        {problems.length > 0 && (
          <Alert
            className="mt-4"
            variant="warning"
            title={settings.enabled && !settings.active ? "It's switched on, but nothing will run" : 'Worth knowing'}
          >
            <ul className="space-y-2">
              {problems.map((problem, index) => (
                <li key={`${problem.code}-${index}`} className="space-y-0.5">
                  <p>{problem.message}</p>
                  <ProblemAction code={problem.code} agentsPath={agentsPath} canManage={canManage} />
                </li>
              ))}
            </ul>
          </Alert>
        )}
      </Card>

      {/* Settings */}
      <Card title="Settings" icon={FileText}>
        <div className="space-y-5">
          {saveError && (
            <Alert variant="error" title={saveError.summary}>
              {saveError.problems.length > 0 && (
                <ul className="list-disc space-y-1 pl-4">
                  {saveError.problems.map((problem, index) => (
                    <li key={index}>{problem.message}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}

          <div className="space-y-1.5">
            <label htmlFor="summarizer-agent" className="text-xs font-medium text-ink-secondary">
              Agent
            </label>
            <select
              id="summarizer-agent"
              value={agentCode}
              onChange={(event) => setAgentCode(event.target.value)}
              disabled={!canManage || agents.length === 0}
              className="w-full rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink hover:border-line-strong disabled:opacity-60"
            >
              {/* The backend infers the agent only when there is exactly one;
                  with several it refuses to guess. */}
              <option value={AUTOMATIC}>
                {agents.length === 1 ? `Automatic — ${agents[0].name}` : 'Automatic (only works with one summarizer)'}
              </option>
              {agents.map((agent) => (
                <option key={agent.code} value={agent.code}>
                  {agent.name} ({agent.code}){agent.is_active === false ? ' — inactive' : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-muted">
              {agents.length === 0 ? (
                <>
                  No summarizer-kind agent exists yet.{' '}
                  {canManage && (
                    <Link to={`${agentsPath}?new=summarizer`} className="text-link hover:underline">
                      Create one
                    </Link>
                  )}
                </>
              ) : (
                'Only summarizer-kind agents are listed.'
              )}
            </p>
          </div>

          <label className="flex items-start gap-3">
            <Checkbox
              checked={includeAttachments}
              disabled={!canManage}
              onChange={() => setIncludeAttachments((value) => !value)}
              labelledBy="summarizer-attachments"
            />
            <span>
              <span id="summarizer-attachments" className="block text-sm font-medium text-ink">
                Read the evidence files
              </span>
              <span className="block text-xs text-ink-muted">
                Digest the report's attachments as well as its text. The agent's role needs report:read_all for this;
                without it, only the report text is digested.
              </span>
            </span>
          </label>

          <div className="max-w-xs">
            <Input
              label="Maximum length (words)"
              type="number"
              min={MIN_WORDS}
              max={MAX_WORDS}
              step="10"
              value={maxWords}
              onChange={(event) => setMaxWords(event.target.value)}
              readOnly={!canManage}
              error={canManage ? wordsError : null}
              helperText={`${MIN_WORDS}–${MAX_WORDS}.`}
            />
          </div>

          {canManage && (
            <div className="flex justify-end">
              <Button startIcon={Save} onClick={saveSettings} isLoading={saving} disabled={!isDirty || Boolean(wordsError)}>
                Save settings
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* The agent that will run */}
      <Card title="Agent in use" icon={CheckCircle2}>
        {resolved ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink">{resolved.name}</p>
              <span className="font-mono text-xs text-ink-subtle">{resolved.code}</span>
              {resolved.is_active === false && <Badge variant="warning" size="small">Inactive</Badge>}
            </div>
            <p className="text-xs text-ink-muted">
              {resolved.role_source === 'org_role' ? (
                <>
                  Acts as the <span className="font-mono text-ink">{resolved.role_code}</span> role.
                </>
              ) : (
                'Uses custom permissions.'
              )}{' '}
              <Link to={agentsPath} className="text-link hover:underline">
                Open agents
              </Link>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(resolved.effective_capabilities || []).map((capability) => (
                <Badge key={capability} variant="success" size="small">
                  {capabilityLabel(capability)}
                </Badge>
              ))}
            </div>
            {(resolved.disabled_capabilities || []).map(({ capability, requires }) => (
              <p key={capability} className="flex items-start gap-1.5 text-xs text-warning-fg">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>
                  {capabilityLabel(capability)} is off: it needs <span className="font-mono">{requires}</span>.
                </span>
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No agent would run — see the problems above.</p>
        )}
      </Card>

      {/* Who can read the digests — a mirror, not an editor */}
      {access && (
        <Card title="Who can read summaries" icon={ShieldCheck}>
          <div className="space-y-4">
            <p className="text-xs text-ink-muted">
              Anyone whose role holds <span className="font-mono text-ink">{access.permission}</span> sees the summary on
              the reports they work. This is set on the roles themselves.
            </p>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Can read</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(access.granted_to || []).length === 0 && <span className="text-xs text-ink-muted">No role.</span>}
                {(access.granted_to || []).map((role) => (
                  <Badge key={role.code} variant="success" size="medium">
                    {role.is_fixed && <Lock className="h-3 w-3" />}
                    {role.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Cannot read</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(access.not_granted_to || []).length === 0 && <span className="text-xs text-ink-muted">Every role can.</span>}
                {(access.not_granted_to || []).map((role) => (
                  <Badge key={role.code} variant="default" size="medium">
                    {role.name}
                  </Badge>
                ))}
              </div>
            </div>

            {(access.how_to_change || rolesPath) && (
              <p className="text-xs text-ink-muted">
                {access.how_to_change}{' '}
                {rolesPath && (
                  <Link to={rolesPath} className="font-medium text-link hover:underline">
                    Open Roles &amp; Permissions →
                  </Link>
                )}
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default Summarizer;
