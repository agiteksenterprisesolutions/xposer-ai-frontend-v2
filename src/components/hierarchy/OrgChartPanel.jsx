// src/components/hierarchy/OrgChartPanel.jsx
//
// The directory drawn as an org chart: who manages whom, top to bottom.
//
// It is loaded the way it's read (GET /org-hierarchy/chart/people): the
// people at the top first, then a manager's direct reports when their card is
// opened, 50 at a time with "Show more reports" for a larger team. Every card
// carries `direct_report_count`, so the open arrow needs no fetch, and each
// opened team is kept, so folding and reopening doesn't fetch again. The
// payload is a page of reports whatever the size of the company.
//
// "Find a person" searches the directory and opens the chart down to them in
// one step, from the `ancestors` of their node. A deep link
// (?view=people&person=<employee id>) does the same.
//
// The only edit made here is the one a chart is good at — changing someone's
// manager, by dragging their card onto the new manager — and it is confirmed
// first and saved as a correction (so it survives HR syncs). Everything else
// opens the same editor the Directory tab uses.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'react-toastify';
import { AlertTriangle, ChevronsDownUp, Loader2, Pencil, Search, Users, X } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { ConfirmationModal } from '../ui/Modal';
import CanvasControls, { CanvasDivider, canvasIconButton } from '../canvas/CanvasControls';
import MemberEditorModal from './MemberEditorModal';
import PersonNode, { MoreNode } from './PersonNode';
import { OrgChartContext } from './orgChartContext';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useDebounce } from '../../hooks/useDebounce';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useThemeStore } from '../../store/themeStore';
import { errorSummary } from '../../utils/errors';
import {
  FLAG_INFO,
  LOOSE_GROUP_ID,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  TOP,
  ancestorsOf,
  flagsFor,
  isMoreId,
  isUnder,
  layoutTree,
  moreId,
} from '../../utils/orgChart';

const GroupLabel = ({ data }) => (
  <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.06em] text-ink-subtle">{data.label}</p>
);

/** The frame behind a team drawn as a grid; the edge from their manager meets it. */
const TeamFrame = ({ data }) => (
  <div style={{ width: data.width, height: data.height }} className="rounded-2xl border border-dashed border-line-strong bg-subtle/60">
    <Handle type="target" position={Position.Top} isConnectable={false} style={hiddenHandle} />
  </div>
);
const hiddenHandle = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 };

const nodeTypes = { person: PersonNode, more: MoreNode, groupLabel: GroupLabel, team: TeamFrame };
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

const loginLabel = (member) => {
  if (member.has_account === undefined) return '—';
  if (!member.has_account) return 'None';
  if (!member.has_active_account) return <span className="text-warning-fg">Deactivated</span>;
  return (member.accounts?.length || 1) > 1 ? `${member.accounts.length} logins` : 'Has a login';
};

/** The selected person, their place in the chart, and anything wrong with it. */
const PersonPanel = ({ member, manager, reports, levelTitle, flags, canManage, onSelect, onOpenTeam, onEdit, onClose }) => {
  const { nameFor } = useOrgRoles();
  const count = member.direct_report_count ?? reports?.ids.length ?? 0;

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
          <Detail label="Role">{member.role_code ? nameFor(member.role_code) : '—'}</Detail>
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
          <Detail label="Login">{loginLabel(member)}</Detail>
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
            Direct reports <span className="text-ink-subtle">({count})</span>
          </p>
          {count === 0 ? (
            <p className="text-xs text-ink-muted">No one reports to {member.name.split(' ')[0]}.</p>
          ) : !reports ? (
            <button type="button" onClick={onOpenTeam} className="text-xs font-medium text-link hover:underline">
              Show them on the chart
            </button>
          ) : (
            <ul className="space-y-1">
              {reports.people.map((report) => (
                <li key={report.external_id} className="flex items-center justify-between gap-2 text-[13px]">
                  <PersonLink member={report} onSelect={onSelect} />
                  <span className="truncate text-xs text-ink-subtle">{report.designation}</span>
                </li>
              ))}
              {reports.total > reports.people.length && (
                <li className="text-xs text-ink-muted">and {reports.total - reports.people.length} more</li>
              )}
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

const addTo = (set, key) => (set.has(key) ? set : new Set([...set, key]));
const removeFrom = (set, key) => {
  if (!set.has(key)) return set;
  const next = new Set(set);
  next.delete(key);
  return next;
};

const Chart = ({ levels, canManage, onChanged, onGoTo, reloadKey }) => {
  const flow = useReactFlow();
  const theme = useThemeStore((state) => state.theme);
  const [searchParams, setSearchParams] = useSearchParams();

  const levelByCode = useMemo(() => new Map(levels.map((l) => [l.code, l])), [levels]);
  const rankOf = useCallback((code) => levelByCode.get(code)?.rank, [levelByCode]);

  // ─── What has been loaded ────────────────────────────────────────────
  const [people, setPeople] = useState(() => new Map()); // external_id → member
  // A list of reports per opened card, and the people at the top under TOP:
  // { ids, total, page, hasNext }.
  const [lists, setLists] = useState(() => new Map());
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(() => new Set()); // list keys being fetched
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const listsRef = useRef(lists);
  listsRef.current = lists;

  const remember = (members) =>
    setPeople((prev) => {
      const next = new Map(prev);
      members.filter(Boolean).forEach((m) => next.set(m.external_id, { ...next.get(m.external_id), ...m }));
      return next;
    });

  /** One page of `key`'s reports (or of the people at the top). Page 1 replaces what was there. */
  const fetchList = useCallback(async (key, page = 1) => {
    setBusy((prev) => addTo(prev, key));
    try {
      const data = await orgHierarchyAPI.peopleChart({ root: key === TOP ? null : key, page, quiet: true });
      remember([data.root, ...(data.children || [])]);
      setLists((prev) => {
        const next = new Map(prev);
        const before = page > 1 ? prev.get(key)?.ids || [] : [];
        const ids = [...before, ...(data.children || []).map((c) => c.external_id).filter((id) => !before.includes(id))];
        next.set(key, { ids, total: data.total ?? ids.length, page: data.page ?? page, hasNext: Boolean(data.has_next) });
        return next;
      });
      return data;
    } finally {
      setBusy((prev) => removeFrom(prev, key));
    }
  }, []);

  /** A card that 404s was removed since the chart loaded: fold it and say so. */
  const reportFailure = useCallback((key, error) => {
    if (error?.response?.status === 404 && key !== TOP) {
      toast.info('That person is no longer in the directory. Refresh to redraw the chart.');
      setExpanded((prev) => removeFrom(prev, key));
      return;
    }
    toast.error(errorSummary(error));
  }, []);

  // ─── Loading, and refreshing in place ────────────────────────────────
  // On every reload (the Refresh button, or after any change on any tab) the
  // top and every opened team are fetched again; teams that are folded are
  // forgotten, and fetched again when opened.
  const firstLoad = useRef(true);
  useEffect(() => {
    let live = true;
    const opened = [...expandedRef.current];
    setLists((prev) => new Map([...prev].filter(([key]) => key === TOP || expandedRef.current.has(key))));
    (async () => {
      let top;
      try {
        top = await fetchList(TOP);
      } catch (error) {
        if (!live) return;
        setLoadError(errorSummary(error));
        setStatus('error');
        return;
      }
      if (!live) return;
      setStatus('ready');
      setLoadError(null);
      if (firstLoad.current) {
        firstLoad.current = false;
        // One person at the top: open their team straight away.
        const only = top.children?.length === 1 ? top.children[0] : null;
        if (only?.direct_report_count > 0) {
          setExpanded((prev) => addTo(prev, only.external_id));
          fetchList(only.external_id).catch((error) => reportFailure(only.external_id, error));
        }
      }
      await Promise.all(opened.map((id) => fetchList(id).catch((error) => live && reportFailure(id, error))));
    })();
    return () => {
      live = false;
    };
  }, [reloadKey, fetchList, reportFailure]);

  // ─── The visible tree ────────────────────────────────────────────────
  const tops = useMemo(() => lists.get(TOP)?.ids || [], [lists]);
  const topSet = useMemo(() => new Set(tops), [tops]);

  // Who manages whom, as far as it's loaded.
  const parentOf = useMemo(() => {
    const map = new Map();
    lists.forEach((list, key) => {
      if (key === TOP) return;
      list.ids.forEach((id) => map.set(id, key));
    });
    return map;
  }, [lists]);

  const hasReports = useCallback(
    (id) => (people.get(id)?.direct_report_count || 0) > 0 || (lists.get(id)?.ids.length || 0) > 0,
    [people, lists],
  );

  const layout = useMemo(() => {
    const roots = tops.filter(hasReports);
    const loose = tops.filter((id) => !hasReports(id));
    if (lists.get(TOP)?.hasNext) loose.push(moreId(TOP));
    const childrenOf = (id) => {
      if (isMoreId(id) || !expanded.has(id)) return [];
      const list = lists.get(id);
      if (!list) return [];
      return list.hasNext ? [...list.ids, moreId(id)] : list.ids;
    };
    return { ...layoutTree({ roots, loose, childrenOf }), looseCount: loose.filter((id) => !isMoreId(id)).length };
  }, [tops, hasReports, expanded, lists]);

  const flagsOf = useCallback(
    (id) =>
      flagsFor({
        member: people.get(id),
        manager: people.get(parentOf.get(id)),
        atTop: topSet.has(id) && !parentOf.has(id),
        rankOf,
      }),
    [people, parentOf, topSet, rankOf],
  );

  const visiblePeople = useMemo(() => layout.visible.filter((id) => !isMoreId(id) && people.has(id)), [layout, people]);

  // ─── Canvas state ────────────────────────────────────────────────────
  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { id, valid }
  const [resetTick, setResetTick] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const [pendingMove, setPendingMove] = useState(null); // { member, manager }
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [teamFocus, setTeamFocus] = useState(null); // a card whose team was just opened

  // Problems among the people on screen; there's no whole-org count without loading it all.
  const flagCounts = useMemo(() => {
    const counts = {};
    visiblePeople.forEach((id) => flagsOf(id).forEach((flag) => (counts[flag] = (counts[flag] || 0) + 1)));
    return counts;
  }, [visiblePeople, flagsOf]);

  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((node) => [node.id, node]));
      const cards = layout.visible
        .filter((id) => isMoreId(id) || people.has(id))
        .map((id) => {
          const before = old.get(id);
          if (isMoreId(id)) {
            const parentKey = id.slice('__more:'.length);
            const list = lists.get(parentKey);
            return {
              id,
              type: 'more',
              position: layout.positions.get(id),
              width: PERSON_WIDTH,
              height: PERSON_HEIGHT,
              measured: before?.measured,
              draggable: false,
              selectable: false,
              data: { parentKey, remaining: list ? list.total - list.ids.length : 0, loading: busy.has(parentKey) },
            };
          }
          const member = people.get(id);
          const flags = flagsOf(id);
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
              levelTitle: levelByCode.get(member.level_code)?.title || member.level_code || null,
              flags,
              reports: member.direct_report_count ?? lists.get(id)?.total ?? 0,
              expanded: expanded.has(id) && lists.has(id),
              loading: busy.has(id),
              drop: dropTarget?.id === id ? (dropTarget.valid ? 'valid' : 'invalid') : null,
              dimmed: Boolean(highlight) && !flags.includes(highlight),
            },
          };
        });
      // Frames first, so they sit behind the cards.
      const frames = layout.teams.map((team) => ({
        id: team.id,
        type: 'team',
        position: { x: team.x, y: team.y },
        width: team.width,
        height: team.height,
        draggable: false,
        selectable: false,
        focusable: false,
        style: { pointerEvents: 'none' },
        data: { width: team.width, height: team.height },
      }));
      if (!layout.looseLabel || layout.looseCount === 0) return [...frames, ...cards];
      return [
        ...frames,
        ...cards,
        {
          id: LOOSE_GROUP_ID,
          type: 'groupLabel',
          position: layout.looseLabel,
          draggable: false,
          selectable: false,
          data: { label: `No manager and no reports (${layout.looseCount}${lists.get(TOP)?.hasNext ? '+' : ''})` },
        },
      ];
    });
  }, [layout, people, lists, busy, flagsOf, levelByCode, expanded, selectedId, dropTarget, highlight, canManage, resetTick]);

  const edges = useMemo(() => {
    const shown = new Set(layout.visible);
    const line = (source, target, dashed = false) => ({
      id: `${source}->${target}`,
      source,
      target,
      type: 'smoothstep',
      pathOptions: { borderRadius: 12 },
      style: dashed ? { ...edgeStyle, strokeDasharray: '4 4' } : edgeStyle,
      selectable: false,
      focusable: false,
    });
    const toCards = layout.visible
      // A card in a team frame is reached through the frame's one line.
      .filter((id) => !layout.inTeam.has(id))
      .map((id) => [id, isMoreId(id) ? id.slice('__more:'.length) : parentOf.get(id)])
      .filter(([id, parent]) => parent && parent !== TOP && shown.has(parent) && expanded.has(parent) && (isMoreId(id) || people.has(id)))
      .map(([id, parent]) => line(parent, id, isMoreId(id)));
    const toFrames = layout.teams.map((team) => line(team.parent, team.id));
    return [...toFrames, ...toCards];
  }, [layout, parentOf, expanded, people]);

  // ─── Navigation ──────────────────────────────────────────────────────
  const toggle = useCallback(
    (id) => {
      if (expandedRef.current.has(id)) {
        setExpanded((prev) => removeFrom(prev, id));
        return;
      }
      setExpanded((prev) => addTo(prev, id));
      setTeamFocus(id);
      if (!listsRef.current.has(id)) fetchList(id).catch((error) => reportFailure(id, error));
    },
    [fetchList, reportFailure],
  );

  const loadMore = useCallback(
    (key) => {
      const list = listsRef.current.get(key);
      fetchList(key, (list?.page || 1) + 1).catch((error) => reportFailure(key, error));
    },
    [fetchList, reportFailure],
  );

  /** Someone already loaded: open the folds above them, select them, bring them into view. */
  const select = useCallback(
    (id) => {
      const above = ancestorsOf(parentOf, id);
      setExpanded((prev) => (above.every((a) => prev.has(a)) ? prev : new Set([...prev, ...above])));
      setSelectedId(id);
      setFocusId(id);
    },
    [parentOf],
  );

  /** Anyone in the directory: load the path from the top down to them, then select them. */
  const [revealing, setRevealing] = useState(false);
  const reveal = useCallback(
    async (id) => {
      setRevealing(true);
      try {
        const data = await orgHierarchyAPI.peopleChart({ root: id, quiet: true });
        const chain = (data.ancestors || []).map((a) => a.external_id).reverse(); // top first
        // Each manager on the way down, with their team; their own fetch
        // hydrates them (ancestors are breadcrumbs, without counts or logins).
        await Promise.all(chain.filter((a) => !listsRef.current.has(a)).map((a) => fetchList(a).catch(() => null)));
        setPeople((prev) => {
          const next = new Map(prev);
          (data.ancestors || []).forEach((a) => !next.has(a.external_id) && next.set(a.external_id, a));
          next.set(data.root.external_id, { ...next.get(data.root.external_id), ...data.root });
          (data.children || []).forEach((c) => next.set(c.external_id, { ...next.get(c.external_id), ...c }));
          return next;
        });
        // Each step of the path is on its manager's list, even past the first page.
        const path = [...chain, id];
        setLists((prev) => {
          const next = new Map(prev);
          const ensure = (key, child) => {
            const list = next.get(key) || { ids: [], total: 0, page: 1, hasNext: false };
            if (!list.ids.includes(child)) next.set(key, { ...list, ids: [...list.ids, child] });
          };
          ensure(TOP, path[0]);
          for (let i = 0; i < path.length - 1; i += 1) ensure(path[i], path[i + 1]);
          if (!next.has(id)) {
            const ids = (data.children || []).map((c) => c.external_id);
            next.set(id, { ids, total: data.total ?? ids.length, page: data.page ?? 1, hasNext: Boolean(data.has_next) });
          }
          return next;
        });
        setExpanded((prev) => new Set([...prev, ...chain]));
        setSelectedId(id);
        setFocusId(id);
      } catch (error) {
        if (error?.response?.status === 404) toast.info('That person is no longer in the directory.');
        else toast.error(errorSummary(error));
      } finally {
        setRevealing(false);
      }
    },
    [fetchList],
  );

  // A deep link to a person: ?view=people&person=<employee id>.
  const linked = searchParams.get('person');
  useEffect(() => {
    if (status !== 'ready' || !linked) return;
    reveal(linked);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('person');
        return next;
      },
      { replace: true },
    );
  }, [status, linked, reveal, setSearchParams]);

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

  // The chart opens with only the top drawn; once the first team has arrived,
  // fit the view to what's there.
  const [fitPending, setFitPending] = useState(true);
  useEffect(() => {
    if (!fitPending || status !== 'ready' || busy.size > 0 || nodes.length === 0) return;
    setFitPending(false);
    requestAnimationFrame(() => flow.fitView({ padding: 0.15, maxZoom: 1 }));
  }, [fitPending, status, busy, nodes, flow]);

  // A team just opened: bring the manager and their reports into view,
  // without zooming in, and not so far out that the cards can't be read.
  useEffect(() => {
    if (!teamFocus || busy.has(teamFocus)) return;
    const list = lists.get(teamFocus);
    if (!list) return;
    const ids = [teamFocus, ...list.ids];
    if (!ids.every((id) => nodes.some((node) => node.id === id))) return;
    setTeamFocus(null);
    requestAnimationFrame(() =>
      flow.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.2, maxZoom: flow.getZoom(), minZoom: 0.5, duration: 400 }),
    );
  }, [teamFocus, busy, lists, nodes, flow]);

  // ─── Find a person ───────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query.trim(), 400);
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!debouncedQuery) {
      setMatches([]);
      return undefined;
    }
    let live = true;
    setSearching(true);
    orgHierarchyAPI
      .listMembers({ search: debouncedQuery, pageSize: 8, quiet: true })
      .then(({ items }) => live && setMatches(items))
      .catch(() => live && setMatches([]))
      .finally(() => live && setSearching(false));
    return () => {
      live = false;
    };
  }, [debouncedQuery]);

  const pick = (member) => {
    setQuery('');
    setMatches([]);
    if (layout.visible.includes(member.external_id)) select(member.external_id);
    else reveal(member.external_id);
  };

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
      ? { id: target.id, valid: !isUnder(parentOf, target.id, node.id) && parentOf.get(node.id) !== target.id }
      : null;
    setDropTarget((prev) => (prev?.id === next?.id && prev?.valid === next?.valid ? prev : next));
  };

  const onNodeDragStop = (_event, node) => {
    const target = targetUnder(node);
    setDropTarget(null);
    setResetTick((n) => n + 1); // the card goes back to its place until the move is saved
    if (!target) return;
    if (parentOf.get(node.id) === target.id) return;
    if (isUnder(parentOf, target.id, node.id)) {
      toast.info(`${people.get(target.id).name} reports to ${people.get(node.id).name}, so they can't be their manager.`);
      return;
    }
    setPendingMove({ member: people.get(node.id), manager: people.get(target.id) });
  };

  const confirmMove = async () => {
    setMoving(true);
    try {
      await orgHierarchyAPI.updateMember(pendingMove.member.id, { manager_external_id: pendingMove.manager.external_id });
      toast.success(`${pendingMove.member.name} now reports to ${pendingMove.manager.name}.`);
      // Show where they went: the new manager's team, opened.
      setExpanded((prev) => addTo(prev, pendingMove.manager.external_id));
      setPendingMove(null);
      onChanged();
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setMoving(false);
    }
  };

  const selected = selectedId ? people.get(selectedId) : null;
  const selectedReports = selected && lists.get(selectedId);

  // ─── Render ──────────────────────────────────────────────────────────
  if (status === 'loading' && !lists.has(TOP)) {
    return (
      <div className="flex h-[calc(100dvh-17rem)] min-h-[520px] items-center justify-center rounded-xl border border-line bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-ink-subtle" aria-label="Loading the org chart" />
      </div>
    );
  }

  if (status === 'error' && !lists.has(TOP)) {
    return (
      <div className="rounded-xl border border-line bg-surface px-6 py-14 text-center">
        <p className="text-sm font-semibold text-ink">Couldn't load the org chart</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{loadError}</p>
        <Button variant="secondary" className="mt-4" onClick={onChanged}>
          Try again
        </Button>
      </div>
    );
  }

  if (tops.length === 0) {
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
          Showing <span className="font-semibold text-ink">{visiblePeople.length}</span>{' '}
          {visiblePeople.length === 1 ? 'person' : 'people'}. Open a team with the count under a card.
        </span>
        {Object.entries(flagCounts).map(([flag, count]) => (
          <button
            key={flag}
            type="button"
            onClick={() => setHighlight((current) => (current === flag ? null : flag))}
            aria-pressed={highlight === flag}
            title={`${FLAG_INFO[flag].description} Counted among the people shown. Click to highlight them.`}
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
        <OrgChartContext.Provider value={{ toggle, loadMore }}>
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

        {/* Find someone — anywhere in the directory, not only on screen */}
        <div className="absolute left-3 top-3 z-10 w-72 max-w-[calc(100%-1.5rem)]">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-md focus-within:border-line-accent">
            {searching || revealing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-subtle" />
            ) : (
              <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
            )}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && matches[0]) pick(matches[0]);
                if (event.key === 'Escape') setQuery('');
              }}
              placeholder="Find a person"
              aria-label="Find a person"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
          </label>
          {query.trim() && debouncedQuery === query.trim() && !searching && (
            <ul className="mt-1 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-lg">
              {matches.length === 0 && <li className="px-3 py-2 text-xs text-ink-muted">No one matches.</li>}
              {matches.map((member) => (
                <li key={member.external_id}>
                  <button
                    type="button"
                    onClick={() => pick(member)}
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
                manager={people.get(parentOf.get(selectedId))}
                reports={
                  selectedReports
                    ? {
                        ids: selectedReports.ids,
                        people: selectedReports.ids.map((id) => people.get(id)).filter(Boolean),
                        total: selectedReports.total,
                      }
                    : null
                }
                levelTitle={levelByCode.get(selected.level_code)?.title}
                flags={flagsOf(selectedId)}
                canManage={canManage}
                onSelect={select}
                onOpenTeam={() => toggle(selectedId)}
                onEdit={() => setEditing(selected)}
                onClose={() => setSelectedId(null)}
              />
            </div>
          </div>
        )}

        <CanvasControls
          onFit={fit}
          after={
            expanded.size > 0 && (
              <>
                <CanvasDivider />
                <button
                  type="button"
                  onClick={() => setExpanded(new Set())}
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
                people.get(parentOf.get(pendingMove.member.external_id))
                  ? ` instead of ${people.get(parentOf.get(pendingMove.member.external_id)).name}`
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
