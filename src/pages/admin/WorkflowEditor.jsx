// src/pages/admin/WorkflowEditor.jsx
//
// The workflow builder: a canvas of steps, each run by one of the
// organization's agents or by a person holding one of its roles.
//
// What the canvas draws is exactly what the API stores — an ordered list of
// stages, each with optional branch rules:
//
//   · The solid line from step to step IS the order. Dragging a step's bottom
//     connector onto another step moves that step to run right after it.
//   · A dashed line from one of a step's outcomes is a branch rule
//     ({ when_decision, goto }). An outcome with no line has no rule, and the
//     report continues to the next step.
//
// Where the nodes sit is not part of a workflow; it is remembered per browser
// (utils/workflowLayout).
//
// /validate is called as the steps change and again right before every save
// (the handbook's rule: always validate before create), and its problems —
// a goto to a step that doesn't exist, an unknown agent or role, a branch on
// a verdict the agent never returns, a branch on a summarizer, duplicate keys
// — are pinned to the step that caused them. Cycles are allowed on purpose
// (review → investigate); max_stage_visits bounds them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  useUpdateNodeInternals,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  ArrowDownToLine,
  ArrowRightToLine,
  LayoutList,
  Loader2,
  Redo2,
  Save,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import { ConfirmationModal } from '../../components/ui/Modal';
import StageNode, { NEW_OUTCOME_PORT } from '../../components/workflows/StageNode';
import TerminalNode from '../../components/workflows/TerminalNode';
import { edgeTypes } from '../../components/workflows/edges';
import StepPalette, { PaletteToggle, STEP_DRAG_TYPE } from '../../components/workflows/StepPalette';
import { StageInspector, WorkflowInspector } from '../../components/workflows/Inspector';
import { WorkflowCanvasContext } from '../../components/workflows/canvasContext';
import CanvasControls, { CanvasDivider, canvasIconButton } from '../../components/canvas/CanvasControls';
import { orgWorkflowsAPI } from '../../api/orgWorkflows';
import { orgAgentsAPI } from '../../api/orgAgents';
import { humanizeRoleCode, useOrgRoles } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useUIStore } from '../../store/uiStore';
import { PERM } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import { suggestCode } from '../../utils/codes';
import { AGENT_KIND_INFO, isSummarizer as isSummarizerAgent } from '../../utils/agents';
import {
  END,
  EXECUTOR_AGENT,
  EXECUTOR_HUMAN,
  NEXT,
  localProblems,
  moveStage,
  normalizeStage,
  renameKeyReferences,
  setBranch,
  stagePorts,
  toApiStages,
  uniqueKey,
} from '../../utils/workflows';
import {
  END_ID,
  HORIZONTAL,
  LAYOUT_GAP,
  ROW_GAP,
  STAGE_HEADER_CENTER,
  STAGE_WIDTH,
  START_ID,
  TERMINAL_HEIGHT,
  TERMINAL_WIDTH,
  VERTICAL,
  estimateStageHeight,
  layoutFor,
  loadLayout,
  loadOrientation,
  saveLayout,
  saveOrientation,
} from '../../utils/workflowLayout';
import useSEO from '../../hooks/useSEO';

const VALIDATE_DEBOUNCE_MS = 500;
const VISIT_LIMITS = { min: 1, max: 20 };
const HISTORY_LIMIT = 100;
const COALESCE_MS = 1000;
const WIDE_SCREEN = 1024;

const nodeTypes = { stage: StageNode, terminal: TerminalNode };
const deleteKeys = ['Backspace', 'Delete'];

let nextStageId = 1;
const withId = (stage, extra = {}) => ({ ...normalizeStage(stage), _id: `s${nextStageId++}`, _autoKey: false, ...extra });

const isWide = () => typeof window === 'undefined' || window.innerWidth >= WIDE_SCREEN;

const nodeSize = (node) => ({
  width: node.measured?.width ?? (node.type === 'stage' ? STAGE_WIDTH : TERMINAL_WIDTH),
  height: node.measured?.height ?? (node.type === 'stage' ? estimateStageHeight(node.data?.ports?.length || 0) : TERMINAL_HEIGHT),
});

const iconButton = canvasIconButton;

const dots = {
  backgroundImage: 'radial-gradient(var(--color-line-strong) 1.5px, transparent 1.5px)',
  backgroundSize: '20px 20px',
};

/** The builder while the workflow loads: top bar, dotted canvas, side panels. */
const BuilderSkeleton = ({ onBack, panels }) => (
  <div className="flex h-[calc(100dvh-4rem)] flex-col bg-canvas" aria-busy="true">
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back to workflows" className={iconButton}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg sm:flex">
          <GitBranch className="h-4 w-4" />
        </span>
        <span className="hidden text-sm text-ink-muted md:block">Workflows</span>
        <span className="hidden text-ink-subtle md:block">/</span>
        <Skeleton.Text className="mx-2 w-44" />
        <Skeleton.Badge className="hidden w-16 sm:block" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="hidden h-6.5 w-28 rounded-full sm:block" />
        <Skeleton.Button className="w-28" />
        <Skeleton.Button className="w-20" />
      </div>
    </header>
    <div className="relative min-h-0 flex-1" style={dots}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-10">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="h-24 w-64 rounded-xl" />
        <Skeleton className="h-24 w-64 rounded-xl" />
      </div>
      {panels && (
        <>
          <div className="absolute bottom-3 left-3 top-3 z-10 flex w-64 flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg">
            <Skeleton.Text className="w-24" />
            <Skeleton className="h-9 w-full rounded-lg" />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg border border-line p-2">
                <Skeleton.Icon size="h-8 w-8" />
                <div className="flex-1">
                  <Skeleton.Text className="w-24" />
                  <Skeleton.Text size="xs" className="w-14" />
                </div>
              </div>
            ))}
          </div>
          <div className="absolute bottom-16 right-3 top-3 z-10 flex w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col gap-4 rounded-xl border border-line bg-surface p-4 shadow-lg lg:bottom-3">
            <Skeleton.Text size="xs" className="w-16" />
            <Skeleton.Text size="base" className="w-48" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton.Text size="xs" className="w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  </div>
);

const Builder = () => {
  const { id } = useParams();
  const isCreate = !id;
  const navigate = useNavigate();
  const flow = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const canManage = useCan()(PERM.agentManage);
  const readOnly = !canManage;
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const theme = useThemeStore((state) => state.theme);
  const listPath = staffPath(orgSlug, 'workflows');
  const { roles, byCode: rolesByCode, loading: rolesLoading } = useOrgRoles();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [agents, setAgents] = useState([]);
  const [activeOther, setActiveOther] = useState(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxVisits, setMaxVisits] = useState('3');
  const [isActive, setIsActive] = useState(false);

  // Top to bottom or left to right — a preference of this browser, not part
  // of the workflow.
  const [orientation, setOrientation] = useState(loadOrientation);
  const horizontal = orientation === HORIZONTAL;
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;

  // Connectors change sides with the direction; React Flow only re-reads
  // where they are when told to.
  const [loadedOnce, setLoadedOnce] = useState(false);
  useEffect(() => {
    if (!loadedOnce) return undefined;
    const frame = requestAnimationFrame(() => updateNodeInternals(nodesRef.current.map((node) => node.id)));
    return () => cancelAnimationFrame(frame);
  }, [horizontal, loadedOnce, updateNodeInternals]);

  // The drawing: the steps in run order, and where each node sits.
  const [doc, setDoc] = useState({ stages: [], positions: {} });
  const docRef = useRef(doc);
  const history = useRef({ past: [], future: [], tag: null, at: 0 });
  const [, setHistoryTick] = useState(0);

  const [nodes, setNodes] = useState([]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  // undefined: leave the selection alone · null: clear it · an id: select it
  const pendingSelect = useRef(undefined);

  const [paletteOpen, setPaletteOpen] = useState(isWide);
  const [inspectorOpen, setInspectorOpen] = useState(isWide);

  const [validation, setValidation] = useState({ key: null, problems: [] });
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useSEO({ title: isCreate ? 'New workflow' : name || 'Workflow', noIndex: true });

  // The builder takes the whole content area rather than a padded column.
  useEffect(() => {
    useUIStore.setState({ fullBleed: true });
    return () => useUIStore.setState({ fullBleed: false });
  }, []);

  const { stages, positions } = doc;
  const agentsByCode = useMemo(() => new Map(agents.map((a) => [a.code, a])), [agents]);
  // What a step can be run by. The summarizer runs on its own before the first
  // step, so it is never offered; agentsByCode still names it on old
  // workflows that have it as a step (stage.summarizer_stage).
  const stageAgents = useMemo(() => agents.filter((a) => !isSummarizerAgent(a)), [agents]);

  // ─── Load ────────────────────────────────────────────────────────────
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
        const loadedAgents = Array.isArray(agentList) ? agentList : [];
        setAgents(loadedAgents);
        const others = (Array.isArray(workflows) ? workflows : []).filter((w) => w.id !== id);
        setActiveOther(others.find((w) => w.is_active) || null);

        const loadedStages = (current?.stages || []).map((stage) => withId(stage));
        const initial = {
          name: current ? current.name || '' : others.length === 0 ? 'Default workflow' : 'Untitled workflow',
          description: current?.description || '',
          maxVisits: String(current?.max_stage_visits ?? 3),
          // The first workflow has nothing to stand down; later ones are
          // activated on purpose.
          isActive: current ? Boolean(current.is_active) : others.length === 0,
        };
        setWorkflow(current);
        setName(initial.name);
        setDescription(initial.description);
        setMaxVisits(initial.maxVisits);
        setIsActive(initial.isActive);

        // A remembered arrangement is used only when it covers every step;
        // half of one would drop the rest on top of each other.
        const agentMap = new Map(loadedAgents.map((a) => [a.code, a]));
        const orientationNow = loadOrientation();
        const column = layoutFor(orientationNow, [
          { id: START_ID, width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT },
          ...loadedStages.map((stage) => ({
            id: stage._id,
            width: STAGE_WIDTH,
            height: estimateStageHeight(stagePorts(stage, agentMap.get(stage.executor_ref)).length),
          })),
          { id: END_ID, width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT },
        ]);
        const saved = loadLayout(id);
        const complete =
          saved &&
          (saved.orientation || VERTICAL) === orientationNow &&
          saved[START_ID] && saved[END_ID] && loadedStages.every((stage) => saved.stages[stage.key]);
        const loadedPositions = complete
          ? {
              [START_ID]: saved[START_ID],
              [END_ID]: saved[END_ID],
              ...Object.fromEntries(loadedStages.map((stage) => [stage._id, saved.stages[stage.key]])),
            }
          : column;

        const loaded = { stages: loadedStages, positions: loadedPositions };
        docRef.current = loaded;
        setDoc(loaded);
        setBaseline(JSON.stringify({ ...initial, stages: toApiStages(loadedStages) }));
      } catch (error) {
        if (!cancelled) setLoadError(errorSummary(error));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadedOnce(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isCreate]);

  // ─── Editing, with undo ──────────────────────────────────────────────
  // `tag` groups a burst of the same edit (typing a name) into one undo step.
  const update = useCallback((updater, tag = null) => {
    const prev = docRef.current;
    const next = updater(prev);
    if (!next || next === prev) return;
    const h = history.current;
    const now = Date.now();
    if (!(tag && h.tag === tag && now - h.at < COALESCE_MS)) {
      h.past.push(prev);
      if (h.past.length > HISTORY_LIMIT) h.past.shift();
    }
    h.future = [];
    h.tag = tag;
    h.at = now;
    docRef.current = next;
    setDoc(next);
    setSaveError(null);
    setHistoryTick((n) => n + 1);
  }, []);

  const travel = useCallback((from, to) => {
    const h = history.current;
    if (!h[from].length) return;
    h[to].push(docRef.current);
    const target = h[from].pop();
    h.tag = null;
    docRef.current = target;
    setDoc(target);
    setHistoryTick((n) => n + 1);
  }, []);
  const undo = useCallback(() => travel('past', 'future'), [travel]);
  const redo = useCallback(() => travel('future', 'past'), [travel]);

  // ─── Validation ──────────────────────────────────────────────────────
  const apiStages = useMemo(() => toApiStages(stages), [stages]);
  const stagesKey = JSON.stringify(apiStages);
  const local = useMemo(() => localProblems(stages), [stages]);

  // The server's verdict once editing settles; a stale reply is dropped.
  const latestKey = useRef(stagesKey);
  latestKey.current = stagesKey;
  useEffect(() => {
    if (loading || readOnly || stages.length === 0 || local.length > 0) {
      setChecking(false);
      return undefined;
    }
    const requestKey = stagesKey;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await orgWorkflowsAPI.validate(JSON.parse(requestKey));
        if (latestKey.current === requestKey) setValidation({ key: requestKey, problems: result?.problems || [] });
      } catch {
        // The pre-save check still runs.
      } finally {
        if (latestKey.current === requestKey) setChecking(false);
      }
    }, VALIDATE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [stagesKey, loading, readOnly, stages.length, local.length]);

  const serverProblems = validation.key === stagesKey ? validation.problems : [];
  const problems = local.length > 0 ? local : serverProblems;
  const problemsKey = JSON.stringify(problems);

  const visits = Number(maxVisits);
  const visitsError =
    !Number.isInteger(visits) || visits < VISIT_LIMITS.min || visits > VISIT_LIMITS.max
      ? `Between ${VISIT_LIMITS.min} and ${VISIT_LIMITS.max}.`
      : null;

  const blockedReason = stages.length === 0 ? 'Add at least one step.' : visitsError ? 'Fix the visit limit.' : null;
  const blocked = local.length > 0 || Boolean(blockedReason);

  const current = JSON.stringify({ name, description, maxVisits, isActive, stages: apiStages });
  const dirty = baseline !== null && current !== baseline;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Remember the arrangement of a saved workflow as it changes.
  useEffect(() => {
    if (loading || isCreate) return undefined;
    const timer = setTimeout(() => saveLayout(id, stages, positions, orientation), 400);
    return () => clearTimeout(timer);
  }, [loading, isCreate, id, stages, positions, orientation]);

  // ─── Nodes ───────────────────────────────────────────────────────────
  const describeExecutor = useCallback(
    (stage) => {
      const ref = stage.executor_ref;
      if (stage.executor_type === EXECUTOR_HUMAN) {
        if (!ref) return { kindLabel: 'Person', label: '', detail: 'Choose a role', warning: true };
        const role = rolesByCode.get(ref);
        if (role) return { kindLabel: 'Person', label: role.name, detail: `Waits for: ${role.name}`, warning: false };
        return rolesLoading
          ? { kindLabel: 'Person', label: humanizeRoleCode(ref), detail: 'Waits for a person', warning: false }
          : { kindLabel: 'Person', label: humanizeRoleCode(ref), detail: `Role "${ref}" not found`, warning: true };
      }
      if (!ref) return { kindLabel: 'AI agent', label: '', detail: 'Choose an agent', warning: true };
      const agent = agentsByCode.get(ref);
      if (!agent) return { kindLabel: 'AI agent', label: ref, detail: `Agent "${ref}" not found`, warning: true };
      if (isSummarizerAgent(agent)) {
        return { kindLabel: 'Summarizer', label: agent.name, detail: 'Skipped — remove this step', warning: true };
      }
      const inactive = agent.is_active === false;
      return {
        kindLabel: AGENT_KIND_INFO[agent.kind]?.label || 'AI agent',
        label: agent.name,
        detail: inactive ? `${agent.name} · inactive` : `Run by ${agent.name}`,
        warning: inactive,
      };
    },
    [agentsByCode, rolesByCode, rolesLoading],
  );

  useEffect(() => {
    if (loading) return;
    const select = pendingSelect.current;
    pendingSelect.current = undefined;
    const found = JSON.parse(problemsKey);
    const byKey = new Map(stages.map((stage) => [stage.key, stage]));

    const targetLabel = (goto) => {
      if (!goto || goto === NEXT) return 'next step';
      if (goto === END) return 'End';
      const target = byKey.get(goto);
      return target ? target.name || target.key : `${goto} (missing)`;
    };

    setNodes((prev) => {
      const old = new Map(prev.map((node) => [node.id, node]));
      const make = (nodeId, type, data, extra) => {
        const before = old.get(nodeId);
        return {
          id: nodeId,
          type,
          data,
          // A node being dragged keeps following the pointer.
          position: before?.dragging ? before.position : positions[nodeId] ?? before?.position ?? { x: 0, y: 0 },
          measured: before?.measured,
          dragging: before?.dragging,
          selected: select !== undefined ? nodeId === select : Boolean(before?.selected),
          ...extra,
        };
      };
      return [
        make(START_ID, 'terminal', { kind: 'start', readOnly, horizontal }, { selectable: false, deletable: false, selected: false }),
        ...stages.map((stage, index) =>
          make(
            stage._id,
            'stage',
            {
              stage,
              index,
              readOnly,
              horizontal,
              executor: describeExecutor(stage),
              problems: found.filter((p) => p.stage && p.stage === stage.key.trim()),
              ports: stagePorts(stage, agentsByCode.get(stage.executor_ref)).map((port) => ({
                ...port,
                isEnd: port.goto === END,
                targetLabel: targetLabel(port.goto),
              })),
            },
            { deletable: !readOnly },
          ),
        ),
        make(END_ID, 'terminal', { kind: 'end', readOnly, horizontal }, { selectable: false, deletable: false, selected: false }),
      ];
    });
  }, [loading, stages, positions, problemsKey, readOnly, horizontal, agentsByCode, describeExecutor]);

  const selectNode = useCallback((nodeId) => {
    setSelectedEdgeId(null);
    setNodes((prev) =>
      prev.map((node) => (Boolean(node.selected) === (node.id === nodeId) ? node : { ...node, selected: node.id === nodeId })),
    );
  }, []);

  const selectedId = nodes.find((node) => node.selected && node.type === 'stage')?.id;
  const selectedIndex = stages.findIndex((stage) => stage._id === selectedId);
  const selectedStage = selectedIndex >= 0 ? stages[selectedIndex] : null;

  // ─── Edges ───────────────────────────────────────────────────────────
  const edges = useMemo(() => {
    const chain = [START_ID, ...stages.map((stage) => stage._id), END_ID];
    const byKey = new Map(stages.map((stage) => [stage.key, stage]));
    const spine = chain.slice(0, -1).map((source, index) => ({
      id: `spine:${source}:${chain[index + 1]}`,
      type: 'spine',
      source,
      sourceHandle: 'next',
      target: chain[index + 1],
      targetHandle: 'in',
      data: { index },
      selectable: false,
      deletable: false,
      focusable: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--color-line-strong)' },
    }));

    // Branches share a gutter outside every node — to the right of a column,
    // beneath a row — one lane each.
    const right = nodes.length ? Math.max(...nodes.map((node) => node.position.x + nodeSize(node).width)) : STAGE_WIDTH / 2;
    const bottom = nodes.length ? Math.max(...nodes.map((node) => node.position.y + nodeSize(node).height)) : 0;
    const branches = [];
    stages.forEach((stage, index) => {
      stagePorts(stage, agentsByCode.get(stage.executor_ref)).forEach((port) => {
        if (!port.goto) return;
        const target =
          port.goto === END ? END_ID : port.goto === NEXT ? chain[index + 2] : byKey.get(port.goto)?._id;
        if (!target || target === stage._id) return;
        const edgeId = `branch:${stage._id}:${port.id}`;
        branches.push({
          id: edgeId,
          type: 'branch',
          source: stage._id,
          sourceHandle: port.id,
          target,
          targetHandle: 'branch-in',
          data: { stageId: stage._id, decision: port.decision, index: port.index },
          span: Math.abs(chain.indexOf(target) - (index + 1)),
          selected: edgeId === selectedEdgeId,
          deletable: !readOnly,
          zIndex: 1,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--color-accent)' },
        });
      });
    });
    // Short jumps take the inner lanes, so nested branches don't cross.
    [...branches]
      .sort((a, b) => a.span - b.span)
      .forEach((edge, lane) => {
        if (horizontal) edge.data.laneY = bottom + 40 + lane * 14;
        else edge.data.laneX = right + 40 + lane * 14;
        delete edge.span;
      });
    return [...spine, ...branches];
  }, [stages, nodes, agentsByCode, selectedEdgeId, readOnly, horizontal]);

  // ─── Step edits ──────────────────────────────────────────────────────
  const updateStage = useCallback(
    (stageId, patch) =>
      update((d) => {
        const old = d.stages.find((stage) => stage._id === stageId);
        if (!old) return d;
        let next = d.stages.map((stage) => (stage._id === stageId ? { ...stage, ...patch } : stage));
        if (patch.key !== undefined) next = renameKeyReferences(next, old.key, patch.key);
        return { ...d, stages: next };
      }, `${stageId}:${Object.keys(patch).sort().join(',')}`),
    [update],
  );

  const newStage = (step, existing) =>
    withId(
      {
        executor_type: step?.executor_type || EXECUTOR_AGENT,
        executor_ref: step?.executor_ref || '',
        name: step?.label || '',
        key: uniqueKey(suggestCode(step?.label || '', 'step') || 'step', existing),
      },
      { _autoKey: true },
    );

  const heightFor = (stage) => estimateStageHeight(stagePorts(stage, agentsByCode.get(stage.executor_ref)).length);

  /** Add a step at `index`, opening a gap for it in the column (or row). */
  const insertAt = useCallback(
    (index, step) => {
      let created;
      update((d) => {
        created = newStage(step, d.stages);
        const next = [...d.stages];
        next.splice(index, 0, created);
        const anchorId = d.stages[index]?._id ?? END_ID;
        const anchor = d.positions[anchorId] ?? { x: -TERMINAL_WIDTH / 2, y: 0 };
        const anchorWidth = anchorId === END_ID ? TERMINAL_WIDTH : STAGE_WIDTH;
        const moved = { ...d.positions };
        if (orientationRef.current === HORIZONTAL) {
          const shift = STAGE_WIDTH + ROW_GAP;
          Object.entries(d.positions).forEach(([nodeId, position]) => {
            if (nodeId !== START_ID && position.x >= anchor.x) moved[nodeId] = { x: position.x + shift, y: position.y };
          });
          // Headers line up, so a step taking the End's place sits a little higher than it.
          const top = anchorId === END_ID ? anchor.y - (STAGE_HEADER_CENTER - TERMINAL_HEIGHT / 2) : anchor.y;
          moved[created._id] = { x: anchor.x, y: top };
        } else {
          const shift = heightFor(created) + LAYOUT_GAP;
          Object.entries(d.positions).forEach(([nodeId, position]) => {
            if (nodeId !== START_ID && position.y >= anchor.y) moved[nodeId] = { x: position.x, y: position.y + shift };
          });
          moved[created._id] = { x: anchor.x + anchorWidth / 2 - STAGE_WIDTH / 2, y: anchor.y };
        }
        return { stages: next, positions: moved };
      });
      if (created) {
        pendingSelect.current = created._id;
        setSelectedEdgeId(null);
        setInspectorOpen(true);
      }
      return created;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update, agentsByCode],
  );

  /** Run order of a node dropped at `point`: after every step above it (or to its left). */
  const indexForPoint = (point, list) =>
    list.filter((stage) => {
      const node = nodesRef.current.find((n) => n.id === stage._id);
      if (!node) return false;
      const size = nodeSize(node);
      return orientationRef.current === HORIZONTAL
        ? node.position.x + size.width / 2 < point.x
        : node.position.y + size.height / 2 < point.y;
    }).length;

  /** Add a step where the pointer is, without moving anything else. */
  const placeAt = (point, step, wire) => {
    let created;
    update((d) => {
      created = newStage(step, d.stages);
      const position = { x: point.x - STAGE_WIDTH / 2, y: point.y - 28 };
      let next = [...d.stages];
      const sourceIndex = wire ? next.findIndex((stage) => stage._id === wire.source) : -1;
      if (wire && (wire.source === START_ID || wire.handle === 'next')) {
        next.splice(sourceIndex + 1, 0, created);
      } else {
        next.splice(indexForPoint(point, next), 0, created);
        if (wire && sourceIndex >= 0) {
          next = next.map((stage) => (stage._id === wire.source ? branchTo(stage, wire.handle, created.key) : stage));
        }
      }
      return { stages: next, positions: { ...d.positions, [created._id]: position } };
    });
    if (created) {
      pendingSelect.current = created._id;
      setSelectedEdgeId(null);
      setInspectorOpen(true);
    }
  };

  const removeStages = useCallback(
    (ids) =>
      update((d) => {
        const gone = new Set(ids);
        const keys = new Set(d.stages.filter((stage) => gone.has(stage._id)).map((stage) => stage.key));
        if (!keys.size && !d.stages.some((stage) => gone.has(stage._id))) return d;
        const next = d.stages
          .filter((stage) => !gone.has(stage._id))
          .map((stage) =>
            stage.transitions.some((t) => keys.has(t.goto))
              ? { ...stage, transitions: stage.transitions.filter((t) => !keys.has(t.goto)) }
              : stage,
          );
        const kept = { ...d.positions };
        ids.forEach((nodeId) => delete kept[nodeId]);
        return { stages: next, positions: kept };
      }),
    [update],
  );

  // ─── Connecting ──────────────────────────────────────────────────────
  /** `stage` with the outcome behind `handle` pointed at `goto`. */
  const branchTo = (stage, handle, goto) => {
    if (handle === NEW_OUTCOME_PORT) {
      const taken = new Set(stage.transitions.map((t) => t.when_decision));
      let n = 1;
      while (taken.has(`outcome_${n}`)) n += 1;
      return { ...stage, transitions: [...stage.transitions, { when_decision: `outcome_${n}`, goto }] };
    }
    if (handle.startsWith('t:')) {
      const at = Number(handle.slice(2));
      return { ...stage, transitions: stage.transitions.map((t, i) => (i === at ? { ...t, goto } : t)) };
    }
    return setBranch(stage, handle.slice(2), goto);
  };

  const connect = useCallback(
    (source, handle, target) => {
      if (readOnly || !handle || source === target || target === START_ID) return;

      // The bottom connector sets the order: the target runs right after.
      if (source === START_ID || handle === 'next') {
        update((d) => {
          if (target === END_ID) {
            const from = d.stages.findIndex((stage) => stage._id === source);
            if (from < 0) return d;
            const next = moveStage(d.stages, from, d.stages.length - 1);
            return next === d.stages ? d : { ...d, stages: next };
          }
          const from = d.stages.findIndex((stage) => stage._id === target);
          const anchor = d.stages.findIndex((stage) => stage._id === source); // -1 for the start
          if (from < 0) return d;
          const next = moveStage(d.stages, from, from < anchor ? anchor : anchor + 1);
          return next === d.stages ? d : { ...d, stages: next };
        });
        return;
      }

      // An outcome's connector writes a branch rule.
      update((d) => {
        const goto = target === END_ID ? END : d.stages.find((stage) => stage._id === target)?.key;
        if (!goto) return d;
        return { ...d, stages: d.stages.map((stage) => (stage._id === source ? branchTo(stage, handle, goto) : stage)) };
      });
      if (handle === NEW_OUTCOME_PORT) {
        selectNode(source);
        setInspectorOpen(true);
      }
    },
    [readOnly, update, selectNode],
  );

  const onConnect = useCallback(
    (connection) => connect(connection.source, connection.sourceHandle, connection.target),
    [connect],
  );

  // Letting go over a step's body counts as connecting to it; letting go
  // over empty canvas adds a new step there, already wired up.
  const onConnectEnd = (event, state) => {
    if (readOnly || state.isValid || !state.fromNode || state.fromHandle?.type !== 'source') return;
    const pointer = 'changedTouches' in event ? event.changedTouches[0] : event;
    const element = document.elementFromPoint(pointer.clientX, pointer.clientY);
    const over = element?.closest('.react-flow__node')?.getAttribute('data-id');
    const wire = { source: state.fromNode.id, handle: state.fromHandle.id };
    if (over) {
      connect(wire.source, wire.handle, over);
    } else if (element?.closest('.react-flow')) {
      placeAt(flow.screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY }), null, wire);
    }
  };

  const onEdgesDelete = (deleted) => {
    const rules = deleted.filter((edge) => edge.type === 'branch').map((edge) => edge.data);
    if (!rules.length) return;
    setSelectedEdgeId(null);
    update((d) => {
      const next = d.stages.map((stage) => {
        const mine = rules.filter((rule) => rule.stageId === stage._id);
        if (!mine.length) return stage;
        const drop = new Set(mine.map((rule) => rule.index));
        return { ...stage, transitions: stage.transitions.filter((_, i) => !drop.has(i)) };
      });
      return { ...d, stages: next };
    });
  };

  // ─── Canvas events ───────────────────────────────────────────────────
  const onNodesChange = useCallback((changes) => setNodes((prev) => applyNodeChanges(changes, prev)), []);

  const onEdgesChange = (changes) =>
    changes.forEach((change) => {
      if (change.type === 'select') setSelectedEdgeId((prev) => (change.selected ? change.id : prev === change.id ? null : prev));
    });

  const onNodeDragStop = (_event, _node, dragged) =>
    update((d) => {
      const moved = dragged.filter((node) => {
        const before = d.positions[node.id];
        return !before || before.x !== node.position.x || before.y !== node.position.y;
      });
      if (!moved.length) return d;
      return { ...d, positions: { ...d.positions, ...Object.fromEntries(moved.map((node) => [node.id, node.position])) } };
    });

  const onDragOver = (event) => {
    if (!event.dataTransfer.types.includes(STEP_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (event) => {
    const raw = event.dataTransfer.getData(STEP_DRAG_TYPE);
    if (!raw || readOnly) return;
    event.preventDefault();
    placeAt(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }), JSON.parse(raw));
  };

  const fitPadding = () => ({
    top: '40px',
    bottom: '88px',
    left: paletteOpen && isWide() ? '300px' : '32px',
    right: inspectorOpen && isWide() ? '392px' : '32px',
  });
  const fit = () => flow.fitView({ padding: fitPadding(), maxZoom: 1, duration: 300 });

  const tidy = (direction = orientation) => {
    const current = nodesRef.current;
    const sized = (nodeId) => ({ id: nodeId, ...nodeSize(current.find((node) => node.id === nodeId) || { type: 'stage' }) });
    update((d) => ({
      ...d,
      positions: layoutFor(direction, [sized(START_ID), ...d.stages.map((stage) => sized(stage._id)), sized(END_ID)]),
    }));
    setTimeout(fit, 60);
  };

  /** Switch direction; the steps are laid out afresh, since a column arrangement means nothing as a row. */
  const orient = (direction) => {
    if (direction === orientation) return;
    orientationRef.current = direction;
    setOrientation(direction);
    saveOrientation(direction);
    tidy(direction);
  };

  // ─── Save ────────────────────────────────────────────────────────────
  const save = async () => {
    if (saving || blocked || readOnly) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Always validate first, so every problem shows on its step at once.
      const result = await orgWorkflowsAPI.validate(apiStages);
      const found = result?.problems || [];
      setValidation({ key: stagesKey, problems: found });
      if (found.length > 0) {
        toast.error(`${found.length} problem${found.length === 1 ? '' : 's'} to fix before saving.`);
        selectNode(null);
        setInspectorOpen(true);
        return;
      }

      const body = {
        name: name.trim() || 'Workflow',
        description: description.trim() || null,
        stages: apiStages,
        max_stage_visits: visits,
        is_active: isActive,
      };
      const saved = isCreate ? await orgWorkflowsAPI.create(body) : await orgWorkflowsAPI.update(id, body);
      setBaseline(current);
      if (isCreate) {
        toast.success('Workflow created.');
        if (saved?.id) {
          saveLayout(saved.id, stages, positions, orientation);
          navigate(`${listPath}/${saved.id}`, { replace: true });
        } else {
          navigate(listPath);
        }
        return;
      }
      toast.success('Workflow saved.');
      if (saved?.id) setWorkflow(saved);
      // Keys are now stable identifiers; a later rename shouldn't change them.
      const settled = { ...docRef.current, stages: docRef.current.stages.map((stage) => ({ ...stage, _autoKey: false })) };
      docRef.current = settled;
      setDoc(settled);
    } catch (error) {
      const described = describeError(error);
      setSaveError(described);
      // A 400 on save carries the same {stage, message} problems; pin them too.
      if (described.problems.length) setValidation({ key: stagesKey, problems: described.problems });
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/Cmd+Z, Shift+Z and S. Typing in a field keeps the browser's own undo.
  const shortcuts = useRef({});
  shortcuts.current = { undo, redo, save };
  useEffect(() => {
    const onKey = (event) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName);
      if (key === 's') {
        event.preventDefault();
        shortcuts.current.save();
      } else if (key === 'z' && !typing) {
        event.preventDefault();
        (event.shiftKey ? shortcuts.current.redo : shortcuts.current.undo)();
      } else if (key === 'y' && !typing) {
        event.preventDefault();
        shortcuts.current.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const canvasActions = useMemo(() => ({ readOnly, insertAt: (index) => insertAt(index) }), [readOnly, insertAt]);

  const leave = () => (dirty ? setConfirmLeave(true) : navigate(listPath));

  // ─── Render ──────────────────────────────────────────────────────────
  if (loading) return <BuilderSkeleton onBack={() => navigate(listPath)} panels={paletteOpen || inspectorOpen} />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <Alert variant="error" title="Couldn't load the workflow">
          {loadError}
        </Alert>
        <Button variant="secondary" startIcon={ArrowLeft} onClick={() => navigate(listPath)}>
          Back to workflows
        </Button>
      </div>
    );
  }

  const h = history.current;
  const status = isCreate
    ? { label: 'Draft', variant: 'default' }
    : workflow?.is_active
      ? { label: 'Running', variant: 'success' }
      : { label: 'Standby', variant: 'default' };

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col bg-canvas">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={leave} aria-label="Back to workflows" title="Back to workflows" className={iconButton}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg sm:flex">
            <GitBranch className="h-4 w-4" />
          </span>
          <button type="button" onClick={leave} className="hidden text-sm text-ink-muted hover:text-ink md:block">
            Workflows
          </button>
          <span className="hidden text-ink-subtle md:block">/</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            readOnly={readOnly}
            aria-label="Workflow name"
            placeholder="Untitled workflow"
            size={Math.min(Math.max(name.length + 1, 10), 32)}
            className="min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-ink outline-none transition-colors hover:border-line focus:border-line-accent focus:bg-subtle"
          />
          <Badge variant={status.variant} size="small" dot={status.variant === 'success'} className="hidden sm:inline-flex">
            {status.label}
          </Badge>
          {workflow?.version != null && <span className="hidden text-xs text-ink-subtle sm:inline">v{workflow.version}</span>}
          {dirty && <span className="hidden whitespace-nowrap text-xs text-warning-fg lg:inline">· Unsaved changes</span>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!readOnly && stages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                selectNode(null);
                setInspectorOpen(true);
              }}
              className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex ${
                problems.length
                  ? 'border-danger-line bg-danger-soft text-danger-fg'
                  : checking
                    ? 'border-line text-ink-muted'
                    : 'border-success-line bg-success-soft text-success-fg'
              }`}
            >
              {problems.length ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : checking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {problems.length
                ? `${problems.length} problem${problems.length === 1 ? '' : 's'}`
                : checking
                  ? 'Checking…'
                  : 'Ready to run'}
            </button>
          )}
          <Button
            variant="outline"
            startIcon={SlidersHorizontal}
            onClick={() => {
              selectNode(null);
              setInspectorOpen((open) => (selectedStage ? true : !open));
            }}
          >
            <span className="hidden sm:inline">Settings</span>
          </Button>
          {readOnly ? (
            <Badge size="small">View only</Badge>
          ) : (
            <Button startIcon={Save} onClick={save} isLoading={saving} disabled={blocked || (!dirty && !isCreate)}>
              {isCreate ? 'Create' : 'Save'}
            </Button>
          )}
        </div>
      </header>

      {/* Canvas */}
      <div className="relative min-h-0 flex-1" onDragOver={onDragOver} onDrop={onDrop}>
        <WorkflowCanvasContext.Provider value={canvasActions}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            colorMode={theme === 'dark' ? 'dark' : 'light'}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={() => setInspectorOpen(true)}
            onNodeDragStop={onNodeDragStop}
            onNodesDelete={(deleted) => removeStages(deleted.map((node) => node.id))}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            isValidConnection={(connection) => connection.source !== connection.target}
            nodesConnectable={!readOnly}
            deleteKeyCode={readOnly ? null : deleteKeys}
            connectionLineStyle={{ stroke: 'var(--color-accent)', strokeWidth: 1.5 }}
            connectionRadius={28}
            minZoom={0.25}
            maxZoom={1.5}
            fitView
            fitViewOptions={{ padding: fitPadding(), maxZoom: 1 }}
            style={{ '--xy-background-color': 'transparent', '--xy-edge-stroke': 'var(--color-line-strong)' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--color-line-strong)" />
          </ReactFlow>
        </WorkflowCanvasContext.Provider>

        {/* Steps to add */}
        {!readOnly && (
          <div className="pointer-events-none absolute bottom-3 left-3 top-3 z-10 flex flex-col items-start">
            <div className="pointer-events-auto flex max-h-full">
              {paletteOpen ? (
                <StepPalette
                  agents={stageAgents}
                  roles={roles}
                  onAdd={(step) => insertAt(docRef.current.stages.length, step)}
                  onClose={() => setPaletteOpen(false)}
                  agentsPath={staffPath(orgSlug, 'agents')}
                  rolesPath={staffPath(orgSlug, 'roles')}
                />
              ) : (
                <PaletteToggle onClick={() => setPaletteOpen(true)} />
              )}
            </div>
          </div>
        )}

        {/* Settings for the selection */}
        {inspectorOpen && (
          <div className="pointer-events-none absolute bottom-16 right-3 top-3 z-10 flex flex-col items-end lg:bottom-3">
            <div className="pointer-events-auto flex max-h-full">
              {selectedStage ? (
                <StageInspector
                  key={selectedStage._id}
                  stage={selectedStage}
                  index={selectedIndex}
                  stages={stages}
                  agents={stageAgents}
                  agentsByCode={agentsByCode}
                  roles={roles}
                  problems={problems.filter((p) => p.stage && p.stage === selectedStage.key.trim())}
                  readOnly={readOnly}
                  onChange={(patch) => updateStage(selectedStage._id, patch)}
                  onMove={(delta) =>
                    update((d) => ({ ...d, stages: moveStage(d.stages, selectedIndex, selectedIndex + delta) }))
                  }
                  onRemove={() => removeStages([selectedStage._id])}
                  onClose={() => setInspectorOpen(false)}
                />
              ) : (
                <WorkflowInspector
                  workflow={workflow}
                  isCreate={isCreate}
                  name={name}
                  description={description}
                  maxVisits={maxVisits}
                  isActive={isActive}
                  visitsError={visitsError}
                  visitLimits={VISIT_LIMITS}
                  activeOther={activeOther}
                  stages={stages}
                  problems={problems}
                  blockedReason={blockedReason}
                  readOnly={readOnly}
                  onName={setName}
                  onDescription={setDescription}
                  onMaxVisits={setMaxVisits}
                  onActive={setIsActive}
                  onSelectStage={selectNode}
                  onClose={() => setInspectorOpen(false)}
                />
              )}
            </div>
          </div>
        )}

        {saveError && !saveError.problems.length && (
          <div className="absolute left-1/2 top-3 z-10 w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2">
            <Alert variant="error" title={saveError.summary} />
          </div>
        )}

        {stages.length === 0 && !readOnly && (
          <p className="pointer-events-none absolute left-1/2 top-4 z-5 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full border border-line bg-surface px-4 py-2 text-center text-xs text-ink-muted shadow-sm">
            Pick an agent or a role from the list, or press <span className="font-semibold text-ink">+</span> to add the
            first step.
          </p>
        )}

        <CanvasControls
          onFit={fit}
          before={
            !readOnly && (
              <>
                <button type="button" onClick={undo} disabled={!h.past.length} aria-label="Undo" title="Undo (Ctrl+Z)" className={iconButton}>
                  <Undo2 className="h-4 w-4" />
                </button>
                <button type="button" onClick={redo} disabled={!h.future.length} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" className={iconButton}>
                  <Redo2 className="h-4 w-4" />
                </button>
              </>
            )
          }
          after={
            <>
              <button type="button" onClick={() => tidy()} aria-label="Tidy up the layout" title="Tidy up the layout" className={iconButton}>
                <LayoutList className="h-4 w-4" />
              </button>
              <CanvasDivider />
              <div className="flex rounded-md bg-subtle p-0.5" role="radiogroup" aria-label="Direction">
                {[
                  { value: VERTICAL, label: 'Top to bottom', icon: ArrowDownToLine },
                  { value: HORIZONTAL, label: 'Left to right', icon: ArrowRightToLine },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={orientation === value}
                    aria-label={label}
                    title={label}
                    onClick={() => orient(value)}
                    className={`inline-flex h-7 w-7 items-center justify-center rounded transition-colors ${
                      orientation === value ? 'bg-surface text-accent-fg shadow-sm' : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </>
          }
        />
      </div>

      <ConfirmationModal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => navigate(listPath)}
        title="Leave without saving?"
        message="Your changes to this workflow haven't been saved and will be lost."
        confirmText="Discard changes"
        cancelText="Keep editing"
        variant="danger"
      />
    </div>
  );
};

// Keyed by workflow, so creating one and landing on its own URL starts clean.
const WorkflowEditor = () => {
  const { id } = useParams();
  return (
    <ReactFlowProvider key={id || 'new'}>
      <Builder />
    </ReactFlowProvider>
  );
};

export default WorkflowEditor;
