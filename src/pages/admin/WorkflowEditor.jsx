// src/pages/admin/WorkflowEditor.jsx
//
// Build or edit a workflow: an ordered list of stages, each run by one of the
// organization's agents or by a person holding one of its roles.
//
// /validate is called as the stages change and again right before every save
// (the handbook's rule: always validate before create), and its problems —
// a goto to a stage that doesn't exist, an unknown agent or role, a branch on
// a verdict the agent never returns, a branch on a summarizer, duplicate keys
// — are pinned to the stage card that caused them. Cycles are allowed on
// purpose (review → investigate); max_stage_visits bounds them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import { Checkbox } from '../../components/roles/PermissionPicker';
import StageCard from '../../components/workflows/StageCard';
import { orgWorkflowsAPI } from '../../api/orgWorkflows';
import { orgAgentsAPI } from '../../api/orgAgents';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { PERM } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import { EXECUTOR_AGENT, localProblems, normalizeStage, renameKeyReferences, toApiStages } from '../../utils/workflows';
import useSEO from '../../hooks/useSEO';

const VALIDATE_DEBOUNCE_MS = 500;
const MIN_VISITS = 1;
const MAX_VISITS = 20;

let nextStageId = 1;
const withId = (stage, extra = {}) => ({ ...normalizeStage(stage), _id: `s${nextStageId++}`, _autoKey: false, ...extra });

const WorkflowEditor = () => {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();
  const canManage = useCan()(PERM.agentManage);
  const readOnly = !canManage;
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const listPath = staffPath(orgSlug, 'workflows');
  const { roles } = useOrgRoles();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [agents, setAgents] = useState([]);
  const [activeOther, setActiveOther] = useState(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxVisits, setMaxVisits] = useState('3');
  const [isActive, setIsActive] = useState(false);
  const [stages, setStages] = useState([]);

  const [validation, setValidation] = useState({ key: null, problems: [] });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useSEO({ title: isCreate ? 'New workflow' : name || 'Workflow', noIndex: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [agentList, workflows, current] = await Promise.all([
          orgAgentsAPI.list(),
          orgWorkflowsAPI.list(),
          isCreate ? Promise.resolve(null) : orgWorkflowsAPI.get(id),
        ]);
        if (cancelled) return;
        setAgents(Array.isArray(agentList) ? agentList : []);
        const others = (Array.isArray(workflows) ? workflows : []).filter((w) => w.id !== id);
        setActiveOther(others.find((w) => w.is_active) || null);
        if (current) {
          setWorkflow(current);
          setName(current.name || '');
          setDescription(current.description || '');
          setMaxVisits(String(current.max_stage_visits ?? 3));
          setIsActive(Boolean(current.is_active));
          setStages((current.stages || []).map((stage) => withId(stage)));
        } else {
          setName(others.length === 0 ? 'Default workflow' : '');
          // The first workflow has nothing to stand down; later ones are
          // activated on purpose.
          setIsActive(others.length === 0);
        }
      } catch (error) {
        if (!cancelled) setLoadError(errorSummary(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isCreate]);

  const agentsByCode = useMemo(() => new Map(agents.map((a) => [a.code, a])), [agents]);
  const apiStages = useMemo(() => toApiStages(stages), [stages]);
  const stagesKey = JSON.stringify(apiStages);
  const local = useMemo(() => localProblems(stages), [stages]);

  // The server's verdict once editing settles; a stale reply is dropped.
  const latestKey = useRef(stagesKey);
  latestKey.current = stagesKey;
  useEffect(() => {
    if (loading || readOnly || stages.length === 0 || local.length > 0) return undefined;
    const requestKey = stagesKey;
    const timer = setTimeout(async () => {
      try {
        const result = await orgWorkflowsAPI.validate(JSON.parse(requestKey));
        if (latestKey.current === requestKey) setValidation({ key: requestKey, problems: result?.problems || [] });
      } catch {
        // The pre-save check still runs.
      }
    }, VALIDATE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [stagesKey, loading, readOnly, stages.length, local.length]);

  const serverProblems = validation.key === stagesKey ? validation.problems : [];
  const problems = local.length > 0 ? local : serverProblems;
  const stageKeys = new Set(stages.map((s) => s.key.trim()));
  const problemsFor = (key) => problems.filter((p) => p.stage && p.stage === key.trim());
  const unplaced = problems.filter((p) => !p.stage || !stageKeys.has(p.stage));

  const visits = Number(maxVisits);
  const visitsError =
    !Number.isInteger(visits) || visits < MIN_VISITS || visits > MAX_VISITS ? `Between ${MIN_VISITS} and ${MAX_VISITS}.` : null;

  // ─── Stage edits ─────────────────────────────────────────────────────
  const updateStage = useCallback((index, patch) => {
    setSaveError(null);
    setStages((prev) => {
      const old = prev[index];
      let next = prev.map((s, i) => (i === index ? { ...s, ...patch } : s));
      if (patch.key !== undefined) next = renameKeyReferences(next, old.key, patch.key);
      return next;
    });
  }, []);

  const moveStage = (index, delta) =>
    setStages((prev) => {
      const next = [...prev];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });

  const removeStage = (index) => setStages((prev) => prev.filter((_, i) => i !== index));

  const addStage = () =>
    setStages((prev) => [...prev, withId({ executor_type: EXECUTOR_AGENT }, { _autoKey: true })]);

  // ─── Save ────────────────────────────────────────────────────────────
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Always validate first, so every problem shows on its card at once.
      const result = await orgWorkflowsAPI.validate(apiStages);
      const found = result?.problems || [];
      setValidation({ key: stagesKey, problems: found });
      if (found.length > 0) {
        toast.error(`${found.length} problem${found.length === 1 ? '' : 's'} to fix before saving.`);
        return;
      }

      const body = {
        name: name.trim() || 'Workflow',
        description: description.trim() || null,
        stages: apiStages,
        max_stage_visits: visits,
        is_active: isActive,
      };
      if (isCreate) await orgWorkflowsAPI.create(body);
      else await orgWorkflowsAPI.update(id, body);
      toast.success(isCreate ? 'Workflow created.' : 'Workflow saved.');
      navigate(listPath);
    } catch (error) {
      const described = describeError(error);
      setSaveError(described);
      // A 400 on save carries the same {stage, message} problems; pin them too.
      if (described.problems.length) setValidation({ key: stagesKey, problems: described.problems });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl border border-line bg-surface" />;
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert variant="error" title="Couldn't load the workflow">
          {loadError}
        </Alert>
        <Button variant="secondary" startIcon={ArrowLeft} onClick={() => navigate(listPath)}>
          Back to workflows
        </Button>
      </div>
    );
  }

  const blocked = local.length > 0 || Boolean(visitsError) || stages.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="small" onClick={() => navigate(listPath)} aria-label="Back to workflows">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-ink">{isCreate ? 'New workflow' : name || 'Workflow'}</h1>
            {workflow?.version != null && <p className="text-xs text-ink-subtle">Version {workflow.version}</p>}
          </div>
        </div>
        {!readOnly && (
          <Button startIcon={Save} onClick={save} isLoading={saving} disabled={blocked}>
            {isCreate ? 'Create workflow' : 'Save workflow'}
          </Button>
        )}
      </div>

      {readOnly && (
        <Alert variant="info" title="View only">
          Changing workflows needs the agent:manage permission.
        </Alert>
      )}

      {saveError && !saveError.problems.length && <Alert variant="error" title={saveError.summary} />}

      {unplaced.length > 0 && (
        <Alert variant="error" title="This workflow can't run yet">
          <ul className="list-disc space-y-1 pl-4">
            {unplaced.map((problem, i) => (
              <li key={i}>
                {problem.stage ? `${problem.stage}: ` : ''}
                {problem.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <Card>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} readOnly={readOnly} required />
          <Input
            label="Max visits per stage"
            type="number"
            min={MIN_VISITS}
            max={MAX_VISITS}
            value={maxVisits}
            onChange={(e) => setMaxVisits(e.target.value)}
            readOnly={readOnly}
            error={visitsError}
            helperText="Bounds send-back loops."
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              readOnly={readOnly}
              rows={2}
            />
          </div>
        </div>
        <label className="mt-4 flex items-start gap-3">
          <Checkbox
            checked={isActive}
            disabled={readOnly}
            onChange={() => setIsActive((v) => !v)}
            labelledBy="workflow-active"
          />
          <span>
            <span id="workflow-active" className="block text-sm font-medium text-ink">
              Use for new reports
            </span>
            <span className="block text-xs text-ink-muted">
              Only one workflow runs at a time.
              {isActive && activeOther && !workflow?.is_active && ` Saving stands down "${activeOther.name}".`}
            </span>
          </span>
        </label>
      </Card>

      {/* The flow at a glance */}
      {stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {stages.map((stage, i) => (
            <span key={stage._id} className="flex items-center gap-1.5">
              <span
                className={`rounded-full border px-2.5 py-1 ${
                  problemsFor(stage.key).length ? 'border-danger-line text-danger-fg' : 'border-line text-ink-secondary'
                }`}
              >
                {stage.name || stage.key || `Stage ${i + 1}`}
              </span>
              <ArrowRight className="h-3 w-3 text-ink-subtle" />
            </span>
          ))}
          <span className="rounded-full bg-active px-2.5 py-1 text-ink-muted">End</span>
        </div>
      )}

      <div className="space-y-4">
        {stages.map((stage, index) => (
          <StageCard
            key={stage._id}
            stage={stage}
            index={index}
            total={stages.length}
            stages={stages}
            agents={agents}
            agentsByCode={agentsByCode}
            roles={roles}
            problems={problemsFor(stage.key)}
            readOnly={readOnly}
            onChange={(patch) => updateStage(index, patch)}
            onMove={(delta) => moveStage(index, delta)}
            onRemove={() => removeStage(index)}
          />
        ))}

        {stages.length === 0 && (
          <Card className="py-10 text-center">
            <p className="text-sm font-semibold text-ink">No stages yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
              A report runs through the stages in order. Start with the first thing that should happen to a new report —
              usually a triage agent.
            </p>
          </Card>
        )}

        {!readOnly && (
          <Button variant="outline" startIcon={Plus} onClick={addStage}>
            Add stage
          </Button>
        )}
      </div>
    </div>
  );
};

export default WorkflowEditor;
