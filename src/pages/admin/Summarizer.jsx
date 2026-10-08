// src/pages/admin/Summarizer.jsx
//
// The organization's one summarizer. It runs automatically before the first
// stage of every workflow and its digest is given to every agent stage, so
// there is nothing to choose, position or assign a role to — only whether it
// runs, how long a digest is, whether it reads the evidence, and its three
// allowed capabilities.
//
// The one subtlety: the switch is bound to `enabled` (what the organization
// asked for), but the status beside it reads `active` (what will actually
// happen). When they disagree, `problems` says why, and each gets its own fix.
//
// It digests attachments only. A report filed without any gets no digest at
// all, and neither does any report while "Read the evidence files" is off.
//
// Who may read the digests is not managed here. It is the agent:summary_read
// permission on roles, so the access panel is a read-only mirror with a link
// to the roles editor — one place to change it, not two.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, GitBranch, Lock, RefreshCw, ScrollText } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Skeleton from '../../components/ui/Skeleton';
import { orgAgentsAPI } from '../../api/orgAgents';
import { orgWorkflowsAPI } from '../../api/orgWorkflows';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { ACCESS, PERM, permissionLabel } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import { CAPABILITY_INFO, SUMMARIZER_CAPABILITIES, SUMMARIZER_PERMISSIONS, capabilityLabel } from '../../utils/agents';
import useSEO from '../../hooks/useSEO';

const MIN_WORDS = 50;
const MAX_WORDS = 4000;
const REPORTER = 'reporter';

// Shortcuts for max_words, which is all the backend stores. Any other number
// shows as Custom.
const LENGTHS = [
  { key: 'brief', label: 'Brief', words: 150, hint: 'A quick orientation — the key facts only.' },
  { key: 'standard', label: 'Standard', words: 400, hint: 'About a page — enough to start working the case.' },
  { key: 'detailed', label: 'Detailed', words: 1000, hint: 'Keeps more of the evidence, and takes longer to read.' },
];
const CUSTOM = 'custom';

const lengthFor = (words) => LENGTHS.find((l) => l.words === Number(words))?.key || CUSTOM;
const formatWords = (words) => Number(words).toLocaleString();

const Switch = ({ checked, disabled, onChange, label, busy, size = 'md', tone = 'success' }) => {
  const big = size === 'lg';
  const on = tone === 'success' ? 'bg-success-solid' : 'bg-accent';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onChange}
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 ${
        big ? 'h-7.5 w-13' : 'h-6 w-10.5'
      } ${checked ? on : 'bg-active'}`}
    >
      <span
        className={`inline-block rounded-full bg-surface shadow-sm transition-transform ${
          big ? 'h-5.5 w-5.5' : 'h-4.5 w-4.5'
        } ${checked ? (big ? 'translate-x-6.5' : 'translate-x-5.25') : 'translate-x-0.75'} ${busy ? 'animate-pulse' : ''}`}
      />
    </button>
  );
};

/** The fix for each reason the switch can be on while nothing happens. */
const ProblemAction = ({ code, agentsPath, canManage, onAllowAttachments }) => {
  if (!canManage) return null;
  switch (code) {
    // One ships with every organization, so this means it was deleted.
    case 'no_summarizer_agent':
      return (
        <Link to={`${agentsPath}?new=summarizer`}>
          <Button variant="outline" size="small">
            Recreate the summarizer
          </Button>
        </Link>
      );
    case 'summarizer_inactive':
      return (
        <Link to={`${agentsPath}?agent=summarizer`}>
          <Button variant="outline" size="small">
            Open the agent
          </Button>
        </Link>
      );
    case 'cannot_read_attachments':
      return (
        <Button variant="outline" size="small" onClick={onAllowAttachments}>
          Allow it
        </Button>
      );
    default:
      return null;
  }
};

const Panel = ({ title, aside, description, children, className = '' }) => (
  <section className={`rounded-2xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {aside}
    </div>
    {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const PageHeader = ({ onRefresh, loading }) => (
  <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <h1 className="text-xl font-bold text-ink">Summarizer</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">
        Writes a short, factual digest of each report's evidence files before the first workflow step, so every agent
        and person that follows starts from the facts. It never decides anything and never contacts the reporter.
      </p>
    </div>
    <Button variant="outline" onClick={onRefresh} disabled={loading} aria-label="Refresh" title="Refresh">
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
    </Button>
  </div>
);

/** A row with a label, a line of help and a switch at the end. */
const SwitchRowSkeleton = ({ wide = false }) => (
  <div className="flex items-start gap-4">
    <div className="min-w-0 flex-1">
      <Skeleton.Text className={wide ? 'w-44' : 'w-36'} />
      <Skeleton.Text className="mt-0.5 w-4/5" />
    </div>
    <Skeleton className="h-6 w-10.5 rounded-full" />
  </div>
);

/** The page while its settings load — same header, panels and titles. */
const SummarizerSkeleton = () => (
  <div className="space-y-5 pb-24" aria-busy="true">
    <PageHeader loading />
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-4 p-5 sm:gap-5 sm:p-6">
        <span className="hidden h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-info-soft text-info-fg sm:flex">
          <ScrollText className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Skeleton.Text size="lg" className="w-44" />
            <Skeleton.Badge className="w-16" />
          </div>
          <Skeleton.Text className="mt-1 w-3/4" />
        </div>
        <Skeleton className="h-7.5 w-13 rounded-full" />
      </div>
      <dl className="grid grid-cols-2 border-t border-line-subtle bg-subtle lg:grid-cols-4">
        {['Runs before', 'Length', 'Evidence files', 'Readers'].map((label, index) => (
          <div
            key={label}
            className={`px-5 py-3.5 sm:px-6 ${index % 2 ? 'border-l border-line-subtle' : ''} ${
              index >= 2 ? 'border-t border-line-subtle lg:border-t-0' : ''
            } ${index === 2 ? 'lg:border-l' : ''}`}
          >
            <dt className="text-xs text-ink-subtle">{label}</dt>
            <Skeleton.Text className="mt-0.5 w-24" />
          </div>
        ))}
      </dl>
    </section>

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <Panel title="What it writes" description="Shorter digests are quicker to read; longer ones keep more detail from the evidence.">
          <p className="text-sm font-medium text-ink-secondary">Length</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-line px-3.5 py-3">
                <Skeleton.Text className="w-16" />
                <Skeleton.Text size="xs" className="mt-0.5 w-20" />
              </div>
            ))}
          </div>
          <Skeleton.Lines size="xs" lines={2} className="mt-2" />
          <div className="my-5 h-px bg-line-subtle" />
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <Skeleton.Text className="w-36" />
              <Skeleton.Lines lines={2} className="mt-0.5" />
              <Skeleton.Text size="xs" className="mt-2 w-56" />
            </div>
            <Skeleton className="h-6 w-10.5 rounded-full" />
          </div>
        </Panel>
        <Panel
          title="What it can do"
          description="A summarizer can only do these three. It never messages the reporter, changes a report or routes it."
        >
          <div className="divide-y divide-line-subtle">
            {[0, 1, 2].map((i) => (
              <div key={i} className="py-3 first:pt-0 last:pb-0">
                <SwitchRowSkeleton wide />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="space-y-5">
        <Panel title="Where it runs">
          <Skeleton.Lines lines={2} />
          <Skeleton.Text size="xs" className="mt-4 w-36" />
          <div className="mt-2 space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-13 w-full rounded-xl" />
            ))}
          </div>
        </Panel>
        <Panel title="Who can read summaries">
          <Skeleton.Text size="xs" className="w-16" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['w-16', 'w-24', 'w-20', 'w-18'].map((w) => (
              <Skeleton key={w} className={`h-6.5 rounded-full ${w}`} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  </div>
);

const sameSet = (a = [], b = []) => a.length === b.length && a.every((item) => b.includes(item));

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
  const workflowsPath = staffPath(orgSlug, 'workflows');
  const rolesPath = can(ACCESS.roles) ? staffPath(orgSlug, 'roles') : null;

  const [settings, setSettings] = useState(null);
  // The summarizer agent itself, for its stored capabilities — the settings
  // only carry the effective ones.
  const [agent, setAgent] = useState(null);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [toggling, setToggling] = useState(false);

  // The settings, saved together from the bar at the bottom; the switch saves at once.
  const [capabilities, setCapabilities] = useState([]);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [maxWords, setMaxWords] = useState('');
  const [length, setLength] = useState('standard');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const applySettings = useCallback((data, agentRecord) => {
    setSettings(data);
    setAgent(agentRecord);
    setCapabilities(agentRecord?.capabilities || []);
    setIncludeAttachments(Boolean(data?.include_attachments));
    setMaxWords(data?.max_words != null ? String(data.max_words) : '');
    setLength(lengthFor(data?.max_words));
  }, []);

  // The agent record comes from the agent list, matched on the code the
  // settings resolve to — not GET /org-agents/{code}, because the code is
  // "summarizer" and that path is these settings. A deleted summarizer leaves
  // it null, which the problems already explain.
  const readAll = useCallback(async () => {
    const [data, agents] = await Promise.all([
      orgAgentsAPI.getSummarizer(),
      orgAgentsAPI.list().catch(() => []),
    ]);
    const code = data?.resolved_agent?.code;
    const agentRecord = (Array.isArray(agents) ? agents : []).find((a) => a.code === code) || null;
    return [data, agentRecord];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [[data, agentRecord]] = await Promise.all([
        readAll(),
        // Only to name the steps in runs_before_stages.
        orgWorkflowsAPI
          .active()
          .then(setActiveWorkflow)
          .catch(() => setActiveWorkflow(null)),
      ]);
      applySettings(data, agentRecord);
      setLoadError(null);
    } catch (error) {
      setLoadError(errorSummary(error));
    } finally {
      setLoading(false);
    }
  }, [applySettings, readAll]);

  useEffect(() => {
    load();
  }, [load]);

  // A PUT's response shape isn't promised to include the derived fields
  // (active, problems, resolved_agent), so re-read after every write.
  const writeAndReload = async (changes, nextCapabilities) => {
    if (Object.keys(changes).length) await orgAgentsAPI.updateSummarizer(changes);
    if (nextCapabilities) await orgAgentsAPI.update(agent.id, { capabilities: nextCapabilities });
    const [data, agentRecord] = await readAll();
    applySettings(data, agentRecord);
  };

  const toggleEnabled = async () => {
    const next = !settings.enabled;
    setToggling(true);
    try {
      await writeAndReload({ enabled: next });
      toast.success(next ? 'Summaries switched on.' : 'Summaries switched off.');
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setToggling(false);
    }
  };

  const chooseLength = (key) => {
    setLength(key);
    const preset = LENGTHS.find((l) => l.key === key);
    if (preset) setMaxWords(String(preset.words));
  };

  const wordsNumber = Number(maxWords);
  const wordsError =
    maxWords === '' || !Number.isInteger(wordsNumber) || wordsNumber < MIN_WORDS || wordsNumber > MAX_WORDS
      ? `Between ${MIN_WORDS} and ${formatWords(MAX_WORDS)} words.`
      : null;

  const changes = useMemo(() => {
    if (!settings) return {};
    const diff = {};
    if (includeAttachments !== Boolean(settings.include_attachments)) diff.include_attachments = includeAttachments;
    if (!wordsError && wordsNumber !== settings.max_words) diff.max_words = wordsNumber;
    return diff;
  }, [settings, includeAttachments, wordsNumber, wordsError]);

  const capabilitiesChanged = Boolean(agent) && !sameSet(capabilities, agent.capabilities || []);

  const isDirty =
    Object.keys(changes).length > 0 ||
    capabilitiesChanged ||
    (Boolean(wordsError) && settings && maxWords !== String(settings.max_words));

  const toggleCapability = (capability) =>
    setCapabilities((current) =>
      current.includes(capability) ? current.filter((c) => c !== capability) : [...current, capability],
    );

  const discard = () => {
    applySettings(settings, agent);
    setSaveError(null);
  };

  const saveSettings = async () => {
    if (!isDirty || wordsError) return;
    setSaving(true);
    setSaveError(null);
    try {
      await writeAndReload(changes, capabilitiesChanged ? capabilities : null);
      toast.success('Summarizer settings saved.');
    } catch (error) {
      setSaveError(describeError(error));
    } finally {
      setSaving(false);
    }
  };

  // runs_before_stages holds stage keys; name them from the running workflow.
  const runsBefore = useMemo(() => {
    const stages = activeWorkflow?.stages || [];
    return (settings?.runs_before_stages || []).map((key) => ({
      key,
      name: stages.find((stage) => stage.key === key)?.name || key,
    }));
  }, [settings, activeWorkflow]);

  if (loading && !settings) return <SummarizerSkeleton />;

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
  // "triage, investigate and review" — what the switch actually turns off.
  const stageList = (() => {
    const names = runsBefore.map((stage) => stage.name);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] || '';
  })();
  const resolved = settings.resolved_agent;
  const access = settings.access;
  const readers = (access?.granted_to || []).filter((r) => r.code !== REPORTER);
  const nonReaders = (access?.not_granted_to || []).filter((r) => r.code !== REPORTER);
  const status = settings.active ? 'running' : settings.enabled ? 'stalled' : 'off';
  const attachmentsWork = capabilities.includes('read_attachments');
  // Orgs created before summarizers wrote to the case still lack this, so
  // digests reach the agents but never show in the case history.
  const missingInternalNote = Boolean(agent) && !(agent.capabilities || []).includes('internal_note');
  const preset = LENGTHS.find((l) => l.key === length);

  const changeList = [
    changes.max_words !== undefined &&
      `Length: ${LENGTHS.find((l) => l.words === changes.max_words)?.label || 'Custom'} (${formatWords(changes.max_words)} words)`,
    changes.include_attachments !== undefined &&
      `Evidence files: ${changes.include_attachments ? 'read' : 'not read'}`,
    capabilitiesChanged && 'What it can do',
  ].filter(Boolean);

  const facts = [
    { label: 'Runs before', value: runsBefore.length ? `${runsBefore.length} step${runsBefore.length === 1 ? '' : 's'}` : 'No agent steps' },
    { label: 'Length', value: `About ${formatWords(settings.max_words)} words` },
    { label: 'Evidence files', value: settings.include_attachments ? 'Read' : 'Not read' },
    { label: 'Readers', value: `${readers.length} role${readers.length === 1 ? '' : 's'}` },
  ];

  return (
    <div className="space-y-5 pb-24">
      <PageHeader onRefresh={load} loading={loading} />

      {!canManage && (
        <Alert variant="info" title="View only">
          Your role can see these settings but not change them. Changing them needs permission to configure AI agents.
        </Alert>
      )}

      {/* Status */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center gap-4 p-5 sm:gap-5 sm:p-6">
          <span className="hidden h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-info-soft text-info-fg sm:flex">
            <ScrollText className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-ink">{settings.enabled ? 'Summaries are on' : 'Summaries are off'}</h2>
              {status === 'running' && (
                <Badge variant="success" size="small" dot>
                  Running
                </Badge>
              )}
              {status === 'stalled' && (
                <Badge variant="warning" size="small" dot>
                  Not running
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {status === 'running' &&
                (settings.include_attachments
                  ? 'Each new report with evidence files is summarized automatically, before the first step. Reports without attachments get no summary.'
                  : 'Switched on, but evidence files aren’t read — and they are all it summarizes, so no report will get a summary.')}
              {status === 'stalled' && 'Switched on, but no report will get a summary until the problems below are fixed.'}
              {status === 'off' && 'No report is summarized. Switching back on needs nothing else changed.'}
            </p>
            {stageList && (
              <p className="mt-1 text-xs text-ink-subtle">
                {settings.enabled
                  ? `Switching off means ${stageList} will see no evidence digest. Those agents still run, on the report text alone.`
                  : `${stageList.charAt(0).toUpperCase()}${stageList.slice(1)} get no evidence digest while this is off. Those agents still run, on the report text alone.`}
              </p>
            )}
          </div>
          <Switch
            checked={Boolean(settings.enabled)}
            onChange={toggleEnabled}
            disabled={!canManage}
            busy={toggling}
            label="Summaries"
            size="lg"
          />
        </div>

        {problems.length > 0 && (
          <div className="border-t border-warning-line bg-warning-soft px-5 py-4 sm:px-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-warning-fg">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {status === 'stalled' ? 'Why nothing will run' : 'Worth knowing'}
            </p>
            <ul className="mt-2 space-y-2 pl-6">
              {problems.map((problem, index) => (
                <li
                  key={`${problem.code}-${index}`}
                  className="flex flex-col gap-2 text-sm text-warning-fg sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{problem.message}</span>
                  <ProblemAction
                    code={problem.code}
                    agentsPath={agentsPath}
                    canManage={canManage && Boolean(agent)}
                    onAllowAttachments={() => {
                      if (!capabilities.includes('read_attachments')) toggleCapability('read_attachments');
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        <dl className="grid grid-cols-2 border-t border-line-subtle bg-subtle lg:grid-cols-4">
          {facts.map((fact, index) => (
            <div
              key={fact.label}
              className={`px-5 py-3.5 sm:px-6 ${index % 2 ? 'border-l border-line-subtle' : ''} ${
                index >= 2 ? 'border-t border-line-subtle lg:border-t-0' : ''
              } ${index === 2 ? 'lg:border-l' : ''}`}
            >
              <dt className="text-xs text-ink-subtle">{fact.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* Settings */}
        <div className="space-y-5">
          <Panel
            title="What it writes"
            description="Shorter digests are quicker to read; longer ones keep more detail from the evidence."
          >
            <p className="text-sm font-medium text-ink-secondary">Length</p>
            <div role="radiogroup" aria-label="Digest length" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...LENGTHS, { key: CUSTOM, label: 'Custom', words: null }].map((option) => {
                const on = length === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!canManage}
                    onClick={() => chooseLength(option.key)}
                    className={`flex flex-col items-start gap-0.5 rounded-xl px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed ${
                      on ? 'border-[1.5px] border-accent bg-accent-soft' : 'border border-line hover:border-line-strong'
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink">{option.label}</span>
                    <span className="text-xs text-ink-subtle">
                      {option.words ? `~${formatWords(option.words)} words` : `${MIN_WORDS}–${formatWords(MAX_WORDS)}`}
                    </span>
                  </button>
                );
              })}
            </div>
            {length === CUSTOM ? (
              <label className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-secondary">
                Up to
                <input
                  type="number"
                  min={MIN_WORDS}
                  max={MAX_WORDS}
                  step="10"
                  value={maxWords}
                  readOnly={!canManage}
                  onChange={(event) => setMaxWords(event.target.value)}
                  aria-label="Maximum words"
                  aria-invalid={wordsError ? 'true' : undefined}
                  className={`w-28 rounded-lg border bg-subtle px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent-ring ${
                    wordsError ? 'border-danger-line' : 'border-line focus:border-line-accent'
                  }`}
                />
                words
                {wordsError && <span className="text-xs text-danger-fg">{wordsError}</span>}
              </label>
            ) : (
              <p className="mt-2 text-xs text-ink-subtle">
                {preset?.hint} Custom lengths can be anything from {MIN_WORDS} to {formatWords(MAX_WORDS)} words.
              </p>
            )}

            <div className="my-5 h-px bg-line-subtle" />

            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Read the evidence files</p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  The digest is written from the report's attachments. Off, no report gets a summary.
                </p>
                {agent && includeAttachments && (
                  <p
                    className={`mt-2 flex items-start gap-1.5 text-xs ${attachmentsWork ? 'text-success-fg' : 'text-warning-fg'}`}
                  >
                    {attachmentsWork ? (
                      <Check className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.6} />
                    ) : (
                      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>
                      {attachmentsWork
                        ? `“${capabilityLabel('read_attachments')}” is on below, so this works.`
                        : `Also needs “${capabilityLabel('read_attachments')}” below — without it nothing is summarized.`}
                    </span>
                  </p>
                )}
              </div>
              <Switch
                checked={includeAttachments}
                disabled={!canManage}
                onChange={() => setIncludeAttachments((value) => !value)}
                label="Read the evidence files"
                tone="accent"
              />
            </div>
          </Panel>

          <Panel
            title="What it can do"
            description="A summarizer can only do these three. It never messages the reporter, changes a report or routes it."
            aside={
              agent && (
                <Link
                  to={`${agentsPath}?agent=${encodeURIComponent(agent.code)}`}
                  className="shrink-0 text-xs font-semibold text-link hover:underline"
                >
                  Open in AI Agents →
                </Link>
              )
            }
          >
            {!agent ? (
              <p className="text-sm text-ink-muted">
                There is no summarizer agent, so there is nothing to configure. The problem above explains how to fix it.
              </p>
            ) : (
              <>
                {missingInternalNote && (
                  <div className="mb-3 flex flex-col gap-3 rounded-xl border border-warning-line bg-warning-soft p-3.5 sm:flex-row sm:items-center">
                    <AlertTriangle className="hidden h-4 w-4 shrink-0 text-warning-fg sm:block" />
                    <p className="min-w-0 flex-1 text-sm text-warning-fg">
                      Digests reach your agents but don't appear in the case history. Turn on “
                      {capabilityLabel('internal_note')}” so staff can read them on the case.
                    </p>
                    {canManage && !capabilities.includes('internal_note') && (
                      <Button variant="outline" size="small" onClick={() => toggleCapability('internal_note')}>
                        Turn on
                      </Button>
                    )}
                  </div>
                )}
                <ul className="divide-y divide-line-subtle">
                  {SUMMARIZER_CAPABILITIES.map((capability) => {
                    const on = capabilities.includes(capability);
                    const blocked = (settings.resolved_agent?.disabled_capabilities || []).find(
                      (item) => item.capability === capability,
                    );
                    return (
                      <li key={capability} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-ink">{capabilityLabel(capability)}</p>
                          <p className="mt-0.5 text-sm text-ink-muted">{CAPABILITY_INFO[capability]?.description}</p>
                          {on && blocked && (
                            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning-fg">
                              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                              Inert — needs “{permissionLabel(blocked.requires)}”.
                            </p>
                          )}
                        </div>
                        <Switch
                          checked={on}
                          disabled={!canManage}
                          onChange={() => toggleCapability(capability)}
                          label={capabilityLabel(capability)}
                          tone="accent"
                        />
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-subtle">
                  <Lock className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>
                    Fixed permissions, not borrowed from a role:{' '}
                    {SUMMARIZER_PERMISSIONS.map((permission) => permissionLabel(permission)).join(' · ')}.
                  </span>
                </p>
              </>
            )}
          </Panel>
        </div>

        {/* Context */}
        <div className="space-y-5">
          <Panel title="Where it runs">
            <p className="text-sm text-ink-muted">
              Automatically, before the first step of every workflow. You don't add it as a step.
            </p>
            {runsBefore.length > 0 ? (
              <>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
                  Its digest is given to
                </p>
                <ul className="mt-2 space-y-2">
                  {runsBefore.map((stage) => (
                    <li key={stage.key} className="flex items-center gap-3 rounded-xl bg-subtle px-3 py-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-accent-fg">
                        <GitBranch className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-ink">{stage.name}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">
                The running workflow has no agent steps, so no agent reads the digest yet.{' '}
                <Link to={workflowsPath} className="font-medium text-link hover:underline">
                  Open Workflows
                </Link>
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-ink-subtle">
              Turning summaries off means these steps start without a digest. It doesn't change the workflow, the agent or
              any role.
            </p>
          </Panel>

          {access && (
            <Panel
              title="Who can read summaries"
              aside={
                rolesPath && (
                  <Link to={rolesPath} className="shrink-0 text-xs font-semibold text-link hover:underline">
                    Change in Roles →
                  </Link>
                )
              }
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Can read</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {readers.length === 0 && <span className="text-sm text-ink-muted">No role yet.</span>}
                {readers.map((role) => (
                  <span
                    key={role.code}
                    className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-fg"
                  >
                    {role.is_fixed ? <Lock className="h-3 w-3" /> : <Check className="h-3 w-3" strokeWidth={3} />}
                    {role.name}
                  </span>
                ))}
              </div>
              {nonReaders.length > 0 && (
                <>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Can't read</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {nonReaders.map((role) => (
                      <span
                        key={role.code}
                        className="inline-flex items-center rounded-full bg-active px-2.5 py-1 text-xs font-semibold text-ink-muted"
                      >
                        {role.name}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <p className="mt-4 text-xs text-ink-subtle">
                {access.how_to_change || `Set by “${permissionLabel(access.permission)}” on each role.`} Reporters never see
                summaries.
              </p>
            </Panel>
          )}

          <Panel
            title="On a case, it looks like this"
            aside={<span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Preview</span>}
          >
            <div className="space-y-2.5 rounded-xl border border-line-subtle bg-subtle p-3.5" aria-hidden="true">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-info-soft text-info-fg">
                  <ScrollText className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-semibold text-ink">AI summary</span>
                <span className="ml-auto text-[11px] text-ink-subtle">When it was written</span>
              </div>
              {[92, 100, 74, 86].map((width) => (
                <span key={width} className="block h-2 rounded bg-active" style={{ width: `${width}%` }} />
              ))}
              <p className="text-[11px] text-ink-subtle">
                {includeAttachments && attachmentsWork
                  ? 'Based on the evidence files · only when a report has some'
                  : 'Not written — evidence files aren’t read'}
                {' · '}up to {formatWords(wordsError ? settings.max_words : wordsNumber)} words
              </p>
            </div>
          </Panel>
        </div>
      </div>

      {/* Save bar */}
      {canManage && isDirty && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl bg-ink px-4 py-3 text-canvas shadow-xl sm:flex-row sm:items-center sm:pl-5">
          <p className="min-w-0 flex-1 text-sm">
            {wordsError ? (
              <>Fix the length before saving — {wordsError.toLowerCase()}</>
            ) : (
              <>
                Unsaved change{changeList.length === 1 ? '' : 's'} · <span className="font-semibold">{changeList.join(' · ')}</span>
              </>
            )}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={saving}
              className="h-9 rounded-lg border border-canvas/25 px-3.5 text-sm font-medium transition-colors hover:bg-canvas/10 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving || Boolean(wordsError)}
              className="h-9 rounded-lg bg-canvas px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Summarizer;
