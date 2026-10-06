// src/components/hierarchy/OrgChartPanel.jsx
//
// The directory drawn as an org chart: who manages whom, top to bottom.
//
// It reads the same members and levels as the other tabs. The only edit made
// here is the one a chart is good at — changing someone's manager, by
// dragging their card onto the new manager — and it is confirmed first and
// saved as a correction (so it survives HR syncs). Everything else opens the
// same editor the Directory tab uses.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Background, BackgroundVariant, ReactFlow, ReactFlowProvider, applyNodeChanges, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'react-toastify';
import { AlertTriangle, ChevronsDownUp, ChevronsUpDown, Pencil, Search, Users, X } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { ConfirmationModal } from '../ui/Modal';
import CanvasControls, { CanvasDivider, canvasIconButton } from '../canvas/CanvasControls';
import MemberEditorModal from './MemberEditorModal';
import PersonNode from './PersonNode';
import { OrgChartContext } from './orgChartContext';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useThemeStore } from '../../store/themeStore';
import { errorSummary } from '../../utils/errors';
import {
  FLAG_INFO,
  LOOSE_GROUP_ID,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  ancestorsOf,
  buildOrgTree,
  initialCollapsed,
  isUnder,
  layoutOrgTree,
} from '../../utils/orgChart';

const GroupLabel = ({ data }) => (
  <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.06em] text-ink-subtle">{data.label}</p>
);

const nodeTypes = { person: PersonNode, groupLabel: GroupLabel };
const edgeStyle = { stroke: 'var(--color-line-strong)', strokeWidth: 1.5 };

const Detail = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 text-[13px]">
    <span className="shrink-0 text-ink-muted">{label}</span>
    <span className="min-w-0 text-right font-medium text-ink">{children}</span>
  </div>
);

const PersonLink = ({ member, onSelect }) => (
  <button type="button" onClick={() => onSelect(member.external_id)} className="truncate text-link hover:underline">
    {member.name}
  </button>
);

/** The selected person, their place in the chart, and anything wrong with it. */
const PersonPanel = ({ member, tree, levelTitle, canManage, onSelect, onEdit, onClose }) => {
  const manager = tree.byId.get(tree.parent.get(member.external_id));
  const reports = (tree.children.get(member.external_id) || []).map((id) => tree.byId.get(id));
  const flags = tree.flags.get(member.external_id) || [];

  return (
    <aside className="flex max-h-full w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
      <header className="flex items-start justify-between gap-2 border-b border-line-subtle px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Person</p>
          <h3 className="truncate text-sm font-semibold text-ink">{member.name}</h3>
          <p className="truncate text-xs text-ink-muted">{member.email || member.external_id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {flags.length > 0 && (
          <ul className="space-y-1.5">
            {flags.map((flag) => (
              <li key={flag} className="flex items-start gap-1.5 rounded-lg bg-warning-soft px-2.5 py-2 text-xs text-warning-fg">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>
                  <span className="font-semibold">{FLAG_INFO[flag].label}.</span> {FLAG_INFO[flag].description}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <Detail label="Job title">{member.designation || '—'}</Detail>
          <Detail label="Department">{member.department || '—'}</Detail>
          <Detail label="Level">{levelTitle || member.level_code || '—'}</Detail>
          <Detail label="Manager">
            {manager ? (
              <PersonLink member={manager} onSelect={onSelect} />
            ) : member.manager_external_id ? (
              <span className="text-warning-fg">{member.manager_external_id} (not on file)</span>
            ) : (
              '—'
            )}
          </Detail>
          <Detail label="Source">
            <Badge size="small" variant={member.source === 'manual' ? 'secondary' : 'default'}>
              {member.source === 'manual' ? 'Added by hand' : 'From HR'}
            </Badge>
            {member.has_manual_override && (
              <Badge size="small" variant="info" className="ml-1">
                Corrected
              </Badge>
            )}
          </Detail>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-secondary">
            Direct reports <span className="text-ink-subtle">({reports.length})</span>
          </p>
          {reports.length === 0 ? (
            <p className="text-xs text-ink-muted">No one reports to {member.name.split(' ')[0]}.</p>
          ) : (
            <ul className="space-y-1">
              {reports.map((report) => (
                <li key={report.external_id} className="flex items-center justify-between gap-2 text-[13px]">
                  <PersonLink member={report} onSelect={onSelect} />
                  <span className="truncate text-xs text-ink-subtle">{report.designation}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {canManage && (
        <footer className="flex items-center justify-between gap-2 border-t border-line-subtle px-4 py-3">
          <p className="text-[11px] text-ink-subtle">Drag the card onto someone to change their manager.</p>
          <Button variant="secondary" size="small" startIcon={Pencil} onClick={onEdit}>
            Edit
          </Button>
        </footer>
      )}
    </aside>
  );
};

const Chart = ({ members, levels, canManage, onChanged, onGoTo }) => {
  const flow = useReactFlow();
  const theme = useThemeStore((state) => state.theme);

  const active = useMemo(() => members.filter((m) => m.is_active !== false), [members]);
  const levelByCode = useMemo(() => new Map(levels.map((l) => [l.code, l])), [levels]);
  const tree = useMemo(() => buildOrgTree(active, levels), [active, levels]);

  const [collapsed, setCollapsed] = useState(() => initialCollapsed(tree));
  const layout = useMemo(() => layoutOrgTree(tree, collapsed), [tree, collapsed]);

  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { id, valid }
  const [resetTick, setResetTick] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const [query, setQuery] = useState('');
  const [pendingMove, setPendingMove] = useState(null); // { member, manager }
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(null);

  const flagCounts = useMemo(() => {
    const counts = {};
    tree.flags.forEach((list) => list.forEach((flag) => (counts[flag] = (counts[flag] || 0) + 1)));
    return counts;
  }, [tree]);

  // ─── Nodes ───────────────────────────────────────────────────────────
  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((node) => [node.id, node]));
      const people = layout.visible.map((id) => {
        const member = tree.byId.get(id);
        const flags = tree.flags.get(id);
        const before = old.get(id);
        return {
          id,
          type: 'person',
          position: before?.dragging ? before.position : layout.positions.get(id),
          width: PERSON_WIDTH,
          height: PERSON_HEIGHT,
          measured: before?.measured,
          dragging: before?.dragging,
          selected: id === selectedId,
          draggable: canManage,
          data: {
            member,
            levelTitle: levelByCode.get(member.level_code)?.title || (member.level_code ? member.level_code : null),
            flags,
            reports: tree.children.get(id).length,
            descendants: tree.descendants.get(id),
            collapsed: collapsed.has(id),
            drop: dropTarget?.id === id ? (dropTarget.valid ? 'valid' : 'invalid') : null,
            dimmed: Boolean(highlight) && !flags.includes(highlight),
          },
        };
      });
      if (!layout.looseLabel) return people;
      return [
        ...people,
        {
          id: LOOSE_GROUP_ID,
          type: 'groupLabel',
          position: layout.looseLabel,
          draggable: false,
          selectable: false,
          data: { label: `No manager and no reports (${tree.loose.length})` },
        },
      ];
    });
  }, [layout, tree, levelByCode, collapsed, selectedId, dropTarget, highlight, canManage, resetTick]);

  const edges = useMemo(
    () =>
      layout.visible
        .filter((id) => tree.parent.has(id))
        .map((id) => ({
          id: `${tree.parent.get(id)}->${id}`,
          source: tree.parent.get(id),
          target: id,
          type: 'smoothstep',
          pathOptions: { borderRadius: 12 },
          style: edgeStyle,
          selectable: false,
          focusable: false,
        })),
    [layout, tree],
  );

  // ─── Navigation ──────────────────────────────────────────────────────
  const toggle = useCallback(
    (id) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );

  /** Open every fold above someone, select them and bring them into view. */
  const reveal = useCallback(
    (id) => {
      const above = ancestorsOf(tree, id);
      setCollapsed((prev) => (above.some((a) => prev.has(a)) ? new Set([...prev].filter((c) => !above.includes(c))) : prev));
      setSelectedId(id);
      setFocusId(id);
    },
    [tree],
  );

  useEffect(() => {
    if (!focusId) return;
    const position = layout.positions.get(focusId);
    if (!position) return;
    flow.setCenter(position.x + PERSON_WIDTH / 2, position.y + PERSON_HEIGHT / 2, {
      zoom: Math.max(flow.getZoom(), 0.9),
      duration: 400,
    });
    setFocusId(null);
  }, [focusId, layout, flow]);

  const fit = () => flow.fitView({ padding: 0.15, maxZoom: 1, duration: 300 });

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return active
      .filter((m) => [m.name, m.designation, m.email, m.department].some((v) => (v || '').toLowerCase().includes(term)))
      .slice(0, 8);
  }, [active, query]);

  // ─── Changing a manager by dragging ──────────────────────────────────
  const onNodesChange = useCallback((changes) => {
    // Selection is ours; everything else (position while dragging, sizes) is React Flow's.
    const kept = changes.filter((change) => change.type !== 'select');
    if (kept.length) setNodes((prev) => applyNodeChanges(kept, prev));
  }, []);

  const targetUnder = (node) =>
    flow.getIntersectingNodes(node).find((other) => other.type === 'person' && other.id !== node.id);

  const onNodeDrag = (_event, node) => {
    const target = targetUnder(node);
    const next = target
      ? { id: target.id, valid: !isUnder(tree, target.id, node.id) && tree.parent.get(node.id) !== target.id }
      : null;
    setDropTarget((prev) => (prev?.id === next?.id && prev?.valid === next?.valid ? prev : next));
  };

  const onNodeDragStop = (_event, node) => {
    const target = targetUnder(node);
    setDropTarget(null);
    setResetTick((n) => n + 1); // the card goes back to its place until the move is saved
    if (!target) return;
    if (tree.parent.get(node.id) === target.id) return;
    if (isUnder(tree, target.id, node.id)) {
      toast.info(`${tree.byId.get(target.id).name} reports to ${tree.byId.get(node.id).name}, so they can't be their manager.`);
      return;
    }
    setPendingMove({ member: tree.byId.get(node.id), manager: tree.byId.get(target.id) });
  };

  const confirmMove = async () => {
    setMoving(true);
    try {
      await orgHierarchyAPI.updateMember(pendingMove.member.id, { manager_external_id: pendingMove.manager.external_id });
      toast.success(`${pendingMove.member.name} now reports to ${pendingMove.manager.name}.`);
      setPendingMove(null);
      onChanged();
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setMoving(false);
    }
  };

  const selected = selectedId ? tree.byId.get(selectedId) : null;
  const expandable = [...tree.children.entries()].filter(([, kids]) => kids.length > 0).map(([id]) => id);

  // ─── Render ──────────────────────────────────────────────────────────
  if (active.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface px-6 py-14 text-center">
        <Users className="mx-auto h-8 w-8 text-ink-subtle" />
        <p className="mt-3 text-sm font-semibold text-ink">No one in the directory yet</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
          The org chart draws itself from the directory: each person's manager and level. Add people by hand, paste a
          spreadsheet, or connect your HR system.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => onGoTo('directory')}>
            Go to the directory
          </Button>
          {canManage && (
            <Button variant="outline" onClick={() => onGoTo('hr')}>
              Connect HR
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-muted">
        <span>
          <span className="font-semibold text-ink">{active.length}</span> people ·{' '}
          <span className="font-semibold text-ink">{tree.parent.size}</span> reporting lines
        </span>
        {Object.entries(flagCounts).map(([flag, count]) => (
          <button
            key={flag}
            type="button"
            onClick={() => setHighlight((current) => (current === flag ? null : flag))}
            aria-pressed={highlight === flag}
            title={`${FLAG_INFO[flag].description} Click to highlight them.`}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors ${
              highlight === flag
                ? 'border-warning-solid bg-warning-solid text-ink-inverse'
                : 'border-warning-line bg-warning-soft text-warning-fg hover:brightness-95'
            }`}
          >
            <AlertTriangle className="h-3 w-3" />
            {count} · {FLAG_INFO[flag].label}
          </button>
        ))}
      </div>

      <div className="relative h-[calc(100dvh-17rem)] min-h-[520px] overflow-hidden rounded-xl border border-line bg-canvas">
        <OrgChartContext.Provider value={{ toggle }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode={theme === 'dark' ? 'dark' : 'light'}
            onNodesChange={onNodesChange}
            onNodeClick={(_event, node) => node.type === 'person' && setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            nodesDraggable={canManage}
            nodesConnectable={false}
            deleteKeyCode={null}
            onlyRenderVisibleElements
            minZoom={0.1}
            maxZoom={1.5}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            style={{ '--xy-background-color': 'transparent' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="var(--color-line-strong)" />
          </ReactFlow>
        </OrgChartContext.Provider>

        {/* Find someone */}
        <div className="absolute left-3 top-3 z-10 w-72 max-w-[calc(100%-1.5rem)]">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-md focus-within:border-line-accent">
            <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && matches[0]) {
                  reveal(matches[0].external_id);
                  setQuery('');
                }
                if (event.key === 'Escape') setQuery('');
              }}
              placeholder="Find a person"
              aria-label="Find a person"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
          </label>
          {query.trim() && (
            <ul className="mt-1 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
              {matches.length === 0 && <li className="px-3 py-2 text-xs text-ink-muted">No one matches.</li>}
              {matches.map((member) => (
                <li key={member.external_id}>
                  <button
                    type="button"
                    onClick={() => {
                      reveal(member.external_id);
                      setQuery('');
                    }}
                    className="flex w-full flex-col px-3 py-1.5 text-left transition-colors hover:bg-hover"
                  >
                    <span className="truncate text-sm text-ink">{member.name}</span>
                    <span className="truncate text-[11px] text-ink-subtle">
                      {[member.designation, member.department].filter(Boolean).join(' · ') || member.external_id}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <div className="pointer-events-none absolute bottom-16 right-3 top-3 z-10 flex flex-col items-end">
            <div className="pointer-events-auto flex max-h-full">
              <PersonPanel
                member={selected}
                tree={tree}
                levelTitle={levelByCode.get(selected.level_code)?.title}
                canManage={canManage}
                onSelect={reveal}
                onEdit={() => setEditing(selected)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </div>
        )}

        <CanvasControls
          onFit={fit}
          after={
            expandable.length > 0 && (
              <>
                <CanvasDivider />
                <button
                  type="button"
                  onClick={() => setCollapsed(new Set())}
                  aria-label="Expand every team"
                  title="Expand every team"
                  className={canvasIconButton}
                >
                  <ChevronsUpDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed(new Set(expandable.filter((id) => !tree.roots.includes(id))))}
                  aria-label="Fold every team"
                  title="Fold every team"
                  className={canvasIconButton}
                >
                  <ChevronsDownUp className="h-4 w-4" />
                </button>
              </>
            )
          }
        />
      </div>

      <ConfirmationModal
        isOpen={Boolean(pendingMove)}
        onClose={() => setPendingMove(null)}
        onConfirm={confirmMove}
        title="Change manager?"
        message={
          pendingMove
            ? `${pendingMove.member.name} will report to ${pendingMove.manager.name}${
                tree.parent.get(pendingMove.member.external_id)
                  ? ` instead of ${tree.byId.get(tree.parent.get(pendingMove.member.external_id)).name}`
                  : ''
              }. Reports naming ${pendingMove.member.name} will escalate to ${pendingMove.manager.name}.${
                pendingMove.member.source !== 'manual' ? ' This is saved as a correction, so the next HR sync keeps it.' : ''
              }`
            : ''
        }
        confirmText="Change manager"
        variant="primary"
        isLoading={moving}
      />

      {editing && (
        <MemberEditorModal
          member={editing}
          levels={levels}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
};

const OrgChartPanel = (props) => (
  <ReactFlowProvider>
    <Chart {...props} />
  </ReactFlowProvider>
);

export default OrgChartPanel;
