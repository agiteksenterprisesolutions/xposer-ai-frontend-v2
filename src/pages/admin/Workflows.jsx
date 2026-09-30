// src/pages/admin/Workflows.jsx
//
// The organization's workflows. Exactly one is active — the one a report
// submitted now runs through — and activating another stands it down.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, Eye, GitBranch, Pencil, Plus, Power, RefreshCw, Trash2, UserRound } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Modal, { ConfirmationModal } from '../../components/ui/Modal';
import { orgWorkflowsAPI } from '../../api/orgWorkflows';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { PERM } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import { EXECUTOR_HUMAN } from '../../utils/workflows';
import useSEO from '../../hooks/useSEO';

const FlowLine = ({ stages = [] }) => (
  <div className="flex flex-wrap items-center gap-1.5 text-xs">
    {stages.map((stage) => (
      <span key={stage.key} className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-ink-secondary">
          {stage.executor_type === EXECUTOR_HUMAN ? <UserRound className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          {stage.name || stage.key}
          {stage.transitions?.length > 0 && <GitBranch className="h-3 w-3 text-ink-subtle" aria-label="Has branches" />}
        </span>
        <ArrowRight className="h-3 w-3 text-ink-subtle" />
      </span>
    ))}
    <span className="rounded-full bg-active px-2.5 py-1 text-ink-muted">End</span>
  </div>
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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-ink">Workflows</h1>
          <p className="mt-1 text-sm text-ink-muted">
            The stages a new report runs through — each handled by an AI agent or by a person, in order.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" startIcon={RefreshCw} onClick={load} disabled={loading}>
            Refresh
          </Button>
          {canManage && (
            <Button startIcon={Plus} onClick={() => navigate(`${base}/new`)}>
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
        <Alert variant="warning" title="No workflow is active">
          New reports have nothing to run through. Activate one below.
        </Alert>
      )}

      {loading && workflows.length === 0 && <div className="h-40 animate-pulse rounded-xl border border-line bg-surface" />}

      {!loading && !error && workflows.length === 0 && (
        <Card className="py-12 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-ink-subtle" />
          <p className="mt-3 text-sm font-semibold text-ink">No workflows yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            A workflow decides what happens to a new report — which agents look at it, in what order, and when a person
            takes over.
          </p>
          {canManage && (
            <Button className="mt-4" startIcon={Plus} onClick={() => navigate(`${base}/new`)}>
              Build your first workflow
            </Button>
          )}
        </Card>
      )}

      <div className="space-y-4">
        {sorted.map((workflow) => (
          <Card key={workflow.id} className={workflow.is_active ? 'border-line-accent' : ''}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">{workflow.name}</h3>
                  {workflow.is_active ? (
                    <Badge variant="success" size="small" dot>
                      Running
                    </Badge>
                  ) : (
                    <Badge size="small">Standby</Badge>
                  )}
                  {workflow.version != null && <span className="text-xs text-ink-subtle">v{workflow.version}</span>}
                  <span className="text-xs text-ink-subtle">
                    · {workflow.stages?.length || 0} stage{workflow.stages?.length === 1 ? '' : 's'} · up to{' '}
                    {workflow.max_stage_visits ?? 3} visits each
                  </span>
                </div>
                {workflow.description && <p className="text-xs text-ink-muted">{workflow.description}</p>}
                <FlowLine stages={workflow.stages} />
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {canManage ? (
                  <>
                    {!workflow.is_active && (
                      <Button variant="outline" size="small" startIcon={Power} onClick={() => setActivating(workflow)}>
                        Activate
                      </Button>
                    )}
                    <Button variant="outline" size="small" startIcon={Pencil} onClick={() => navigate(`${base}/${workflow.id}`)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(workflow);
                      }}
                      aria-label={`Delete ${workflow.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-danger-fg" />
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="small" startIcon={Eye} onClick={() => navigate(`${base}/${workflow.id}`)}>
                    View
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

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
