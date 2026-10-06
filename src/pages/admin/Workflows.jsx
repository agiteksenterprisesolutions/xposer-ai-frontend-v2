// src/pages/admin/Workflows.jsx
//
// The organization's workflows. Exactly one is active — the one a report
// submitted now runs through — and activating another stands it down.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Eye,
  Flag,
  GitBranch,
  Inbox,
  MoreHorizontal,
  Plus,
  Power,
  RefreshCw,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Dropdown from '../../components/ui/Dropdown';
import Modal, { ConfirmationModal } from '../../components/ui/Modal';
import { orgWorkflowsAPI } from '../../api/orgWorkflows';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { PERM } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import { parseServerDate } from '../../utils/formatters';
import { EXECUTOR_HUMAN } from '../../utils/workflows';
import useSEO from '../../hooks/useSEO';

// The builder's dotted canvas, echoed behind each preview.
const canvasDots = {
  backgroundImage: 'radial-gradient(var(--color-line-strong) 1px, transparent 1px)',
  backgroundSize: '14px 14px',
};

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

const formatUpdated = (value) => {
  const date = parseServerDate(value);
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
};

const Terminal = ({ icon: Icon, label, accent }) => (
  <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full border ${
        accent ? 'border-line-accent bg-accent-soft text-accent-fg' : 'border-line bg-surface text-ink-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
    <span className="text-[10px] font-medium text-ink-subtle">{label}</span>
  </div>
);

const Link = () => <span className="mt-4 h-px w-4 shrink-0 bg-line-strong" aria-hidden="true" />;

// Widths the preview is laid out on (px): its padding, the Report and End
// ends, and one step with the line leading into it.
const PREVIEW_PADDING = 24;
const TERMINAL_W = 56;
const LINK_W = 16;
const STEP_W = 72 + LINK_W;
const MORE_W = 48 + LINK_W;

const PreviewStep = ({ stage }) => {
  const isHuman = stage.executor_type === EXECUTOR_HUMAN;
  const Icon = isHuman ? UserRound : Bot;
  const branches = stage.transitions?.filter((t) => t.when_decision).length || 0;
  return (
    <div className="flex items-start">
      <Link />
      <div className="flex w-18 shrink-0 flex-col items-center gap-1.5" title={stage.name || stage.key}>
        <span
          className={`relative flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ${
            isHuman ? 'bg-warning-soft text-warning-fg' : 'bg-accent text-on-accent'
          }`}
        >
          <Icon className="h-4 w-4" />
          {branches > 0 && (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-surface bg-surface px-1 text-[9px] font-semibold text-accent-fg shadow-sm"
              title={plural(branches, 'branch rule')}
            >
              {branches}
            </span>
          )}
        </span>
        <span className="w-full truncate text-center text-[10px] font-medium text-ink-secondary">
          {stage.name || stage.key}
        </span>
      </div>
    </div>
  );
};

/**
 * The workflow at a glance: its steps in run order, as on the canvas. It
 * never scrolls. As many whole steps as fit are drawn; the rest collapse
 * into one "+N" marker before the End, and the builder shows them all.
 */
const FlowPreview = ({ stages = [] }) => {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const measure = () => setWidth(box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // Room for steps once both ends (and the line into End) are placed.
  const room = width - PREVIEW_PADDING - TERMINAL_W * 2 - LINK_W;
  const fitsAll = !width || stages.length * STEP_W <= room;
  // Otherwise leave space for the narrower "+N" marker.
  const shown = fitsAll ? stages : stages.slice(0, Math.max(0, Math.floor((room - MORE_W) / STEP_W)));
  const more = stages.length - shown.length;

  return (
    <div ref={boxRef} className="overflow-hidden rounded-lg border border-line-subtle bg-subtle" style={canvasDots}>
      <div className="flex items-start px-3 pb-2.5 pt-3">
        <Terminal icon={Inbox} label="Report" accent />
        {shown.map((stage) => (
          <PreviewStep key={stage.key} stage={stage} />
        ))}
        {more > 0 && (
          <div className="flex items-start" title={stages.slice(shown.length).map((s) => s.name || s.key).join(', ')}>
            <Link />
            <div className="flex w-12 shrink-0 flex-col items-center gap-1.5">
              <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface px-1.5 text-xs font-semibold text-ink-muted">
                +{more}
              </span>
              <span className="text-[10px] font-medium text-ink-subtle">more</span>
            </div>
          </div>
        )}
        <Link />
        <Terminal icon={Flag} label="End" />
      </div>
    </div>
  );
};

const WorkflowCard = ({ workflow, canManage, onOpen, onActivate, onDelete }) => {
  const stages = workflow.stages || [];
  const people = stages.filter((s) => s.executor_type === EXECUTOR_HUMAN).length;
  const branches = stages.reduce((n, s) => n + (s.transitions?.filter((t) => t.when_decision).length || 0), 0);
  const updated = formatUpdated(workflow.updated_at || workflow.created_at);

  return (
    <article
      className={`group relative flex min-w-0 flex-col gap-4 rounded-xl border bg-surface p-5 shadow-sm transition-[border-color,box-shadow] hover:shadow-md ${
        workflow.is_active ? 'border-line-accent ring-1 ring-accent-ring' : 'border-line hover:border-line-strong'
      }`}
    >
      <header className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            workflow.is_active ? 'bg-accent text-on-accent' : 'bg-active text-ink-muted'
          }`}
        >
          <GitBranch className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="truncate text-left text-[15px] font-semibold text-ink after:absolute after:inset-0 after:rounded-xl focus:outline-none focus-visible:underline"
            >
              {workflow.name}
            </button>
            {workflow.is_active ? (
              <Badge variant="success" size="small" dot>
                Running
              </Badge>
            ) : (
              <Badge size="small">Standby</Badge>
            )}
          </div>
          {workflow.version != null && <p className="mt-0.5 text-xs text-ink-subtle">Version {workflow.version}</p>}
        </div>

        {/* Above the card-wide link, so these stay clickable. */}
        {canManage && (
          <div className="relative z-10">
            <Dropdown
              align="right"
              trigger={
                <button
                  type="button"
                  aria-label={`More actions for ${workflow.name}`}
                  className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              }
            >
              {!workflow.is_active && (
                <Dropdown.Item onClick={onActivate}>
                  <Power className="h-4 w-4 shrink-0" />
                  Use for new reports
                </Dropdown.Item>
              )}
              <Dropdown.Item onClick={onDelete} className="text-danger-fg hover:text-danger-fg">
                <Trash2 className="h-4 w-4 shrink-0" />
                Delete workflow
              </Dropdown.Item>
            </Dropdown>
          </div>
        )}
      </header>

      {workflow.description ? (
        <p className="line-clamp-2 text-sm text-ink-muted">{workflow.description}</p>
      ) : (
        <p className="text-sm italic text-ink-subtle">No description</p>
      )}

      {stages.length > 0 ? (
        <FlowPreview stages={stages} />
      ) : (
        <div className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-xs text-ink-muted" style={canvasDots}>
          No steps yet — open the builder to add some.
        </div>
      )}

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Steps</dt>
          <Bot className="h-3.5 w-3.5 text-ink-subtle" />
          <dd>{plural(stages.length, 'step')}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Handled by people</dt>
          <UserRound className="h-3.5 w-3.5 text-ink-subtle" />
          <dd>{people} by people</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Branches</dt>
          <GitBranch className="h-3.5 w-3.5 text-ink-subtle" />
          <dd>{plural(branches, 'branch', 'branches')}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Visit limit</dt>
          <RefreshCw className="h-3.5 w-3.5 text-ink-subtle" />
          <dd>up to {workflow.max_stage_visits ?? 3} visits</dd>
        </div>
      </dl>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4">
        <span className="text-xs text-ink-subtle">{updated ? `Updated ${updated}` : ''}</span>
        <span className="relative z-10 flex gap-2">
          {canManage && !workflow.is_active && (
            <Button variant="ghost" size="small" startIcon={Power} onClick={onActivate}>
              Activate
            </Button>
          )}
          <Button
            variant={canManage ? 'secondary' : 'outline'}
            size="small"
            startIcon={canManage ? undefined : Eye}
            endIcon={canManage ? ArrowRight : undefined}
            onClick={onOpen}
          >
            {canManage ? 'Open builder' : 'View'}
          </Button>
        </span>
      </footer>
    </article>
  );
};

const NewWorkflowTile = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line p-6 text-center transition-colors hover:border-line-accent hover:bg-accent-soft/40"
    style={canvasDots}
  >
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent shadow-glow">
      <Plus className="h-5 w-5" />
    </span>
    <span>
      <span className="block text-sm font-semibold text-ink">New workflow</span>
      <span className="mt-1 block max-w-60 text-xs text-ink-muted">
        Connect agents and people into the route a report takes.
      </span>
    </span>
  </button>
);

const Workflows = () => {
  useSEO({ title: 'Workflows', description: 'The stages a new report runs through.', noIndex: true });
  const navigate = useNavigate();
  const canManage = useCan()(PERM.agentManage);
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const base = staffPath(orgSlug, 'workflows');

  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activating, setActivating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orgWorkflowsAPI.list();
      setWorkflows(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(errorSummary(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = workflows.find((w) => w.is_active);
  const sorted = [...workflows].sort((a, b) => Number(b.is_active) - Number(a.is_active) || (a.name || '').localeCompare(b.name || ''));

  const activate = async () => {
    setBusy(true);
    try {
      await orgWorkflowsAPI.update(activating.id, { is_active: true });
      toast.success(`"${activating.name}" now runs new reports.`);
      setActivating(null);
      load();
    } catch (err) {
      toast.error(errorSummary(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setDeleteError(null);
    try {
      await orgWorkflowsAPI.remove(deleting.id);
      toast.success(`"${deleting.name}" deleted.`);
      setDeleting(null);
      load();
    } catch (err) {
      setDeleteError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const create = () => navigate(`${base}/new`);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-xl font-bold text-ink">Workflows</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            The route a new report takes — which AI agents look at it, in what order, and when a person takes over.
          </p>
          {loading && workflows.length === 0 && <Skeleton.Text size="xs" className="mt-3 w-72" />}
          {!loading && workflows.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <span className="font-medium text-ink">{plural(workflows.length, 'workflow')}</span>
              <span aria-hidden="true">·</span>
              {active ? (
                <span>
                  New reports run through <span className="font-medium text-ink">{active.name}</span>
                </span>
              ) : (
                <span className="font-medium text-warning-fg">None running</span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading} aria-label="Refresh" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {canManage && (
            <Button startIcon={Plus} onClick={create}>
              New workflow
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Couldn't load workflows">
          {error}
        </Alert>
      )}

      {!loading && !error && workflows.length > 0 && !active && (
        <Alert variant="warning" title="No workflow is running">
          New reports have nothing to run through. Choose "Use for new reports" on one of the workflows below.
        </Alert>
      )}

      {loading && workflows.length === 0 && (
        <div className="grid gap-5 lg:grid-cols-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <Skeleton.Icon size="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <Skeleton.Text size="base" className="w-48" />
                  <Skeleton.Text size="xs" className="mt-0.5 w-16" />
                </div>
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
              <Skeleton.Text className="w-2/3" />
              <Skeleton className="h-[74px] w-full rounded-lg" />
              <Skeleton.Text size="xs" className="w-64" />
              <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
                <Skeleton.Text size="xs" className="w-28" />
                <Skeleton.Button small className="w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && workflows.length === 0 && (
        <div className="rounded-xl border border-line bg-surface px-6 py-14 text-center" style={canvasDots}>
          <div className="mx-auto flex w-max items-center gap-2 text-ink-subtle" aria-hidden="true">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line-accent bg-accent-soft text-accent-fg">
              <Inbox className="h-4 w-4" />
            </span>
            <span className="h-px w-6 bg-line-strong" />
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-on-accent">
              <Bot className="h-4 w-4" />
            </span>
            <span className="h-px w-6 bg-line-strong" />
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-soft text-warning-fg">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="h-px w-6 bg-line-strong" />
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface">
              <Flag className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-5 text-base font-semibold text-ink">No workflows yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            A workflow decides what happens to a new report — which agents look at it, in what order, and when a person
            takes over.
          </p>
          {canManage && (
            <Button className="mt-5" startIcon={Plus} onClick={create}>
              Build your first workflow
            </Button>
          )}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          {sorted.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              canManage={canManage}
              onOpen={() => navigate(`${base}/${workflow.id}`)}
              onActivate={() => setActivating(workflow)}
              onDelete={() => {
                setDeleteError(null);
                setDeleting(workflow);
              }}
            />
          ))}
          {canManage && <NewWorkflowTile onClick={create} />}
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(activating)}
        onClose={() => setActivating(null)}
        onConfirm={activate}
        title="Switch workflows?"
        message={
          activating
            ? `New reports will run through "${activating.name}"${active ? ` instead of "${active.name}"` : ''}. Reports already in progress keep the workflow they started with.`
            : ''
        }
        confirmText="Activate"
        variant="primary"
        isLoading={busy}
      />

      {deleting && (
        <Modal
          isOpen
          onClose={busy ? () => {} : () => setDeleting(null)}
          title={`Delete "${deleting.name}"?`}
          size="sm"
          footer={
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <Button variant="secondary" onClick={() => setDeleting(null)} disabled={busy}>
                {deleteError ? 'Close' : 'Cancel'}
              </Button>
              {!deleteError && (
                <Button variant="danger" onClick={remove} isLoading={busy}>
                  Delete workflow
                </Button>
              )}
            </div>
          }
        >
          {deleteError ? (
            <Alert variant={deleteError.status === 409 ? 'warning' : 'error'} title="This workflow can't be deleted">
              {deleteError.summary}
              {deleteError.status === 409 && (
                <p className="mt-2">An organization always needs one workflow. Create its replacement first.</p>
              )}
            </Alert>
          ) : (
            <p className="text-sm leading-relaxed text-ink-secondary">
              This cannot be undone.
              {deleting.is_active && ' It is the active workflow — activate another first, or new reports will have nothing to run through.'}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
};

export default Workflows;
