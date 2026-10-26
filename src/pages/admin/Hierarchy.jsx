// src/pages/admin/Hierarchy.jsx
//
// The reporting hierarchy — the ladder that decides who a report escalates
// to. A report implicating a Finance Executive must reach someone above them,
// never their peers and never themselves.
//
// Coverage is the landing tab because it answers the question an admin
// actually has ("is this working?"); the org chart shows the same directory
// as a picture; levels and the directory are where the fixes happen. They
// reload together after any change, so a fix made on one tab shows up on the
// others. The directory itself is never loaded whole — it's the client's
// entire headcount — so the Directory tab and the by-person chart page and
// search it on the server.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import Tabs from '../../components/ui/Tabs';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { ConfirmationModal } from '../../components/layout/Modal';
import CoveragePanel from '../../components/hierarchy/CoveragePanel';
import LevelsPanel from '../../components/hierarchy/LevelsPanel';
import DirectoryPanel from '../../components/hierarchy/DirectoryPanel';
import OrgChartPanel from '../../components/hierarchy/OrgChartPanel';
import LevelChart from '../../components/hierarchy/LevelChart';
import ChartViewSwitch from '../../components/hierarchy/ChartViewSwitch';
import SyncPanel from '../../components/hierarchy/SyncPanel';
import EscalationPanel from '../../components/hierarchy/EscalationPanel';
import PendingPanel from '../../components/hierarchy/PendingPanel';
import HierarchySkeleton from '../../components/hierarchy/HierarchySkeleton';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { sortLevels } from '../../utils/hierarchy';
import { errorSummary } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';

// Non-admins with org_hierarchy:read get the org chart — levels and people,
// read-only — and nothing else; every other tab is admin only, viewing
// included (coverage, the queue, sync and escalation are admin-only reads).
const TABS = [
  { value: 'coverage', label: 'Coverage', adminOnly: true },
  { value: 'chart', label: 'Org chart' },
  { value: 'levels', label: 'Levels', adminOnly: true },
  { value: 'directory', label: 'Directory', adminOnly: true },
  { value: 'escalation', label: 'Escalation policy', adminOnly: true },
  // People an HR sync found, waiting for a level, a role and a login decision.
  { value: 'approvals', label: 'Approvals', adminOnly: true },
  { value: 'hr', label: 'HR connection', adminOnly: true },
];

const Hierarchy = () => {
  useSEO({
    title: 'Reporting Hierarchy',
    description: 'Who a report escalates to: levels, the staff directory, and whether it all resolves.',
    noIndex: true,
  });
  const canManage = useCan()(PERM.hierarchyManage);

  const tabs = TABS.filter((t) => !t.adminOnly || canManage);
  const homeTab = canManage ? 'coverage' : 'chart';
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabs.some((t) => t.value === searchParams.get('tab')) ? searchParams.get('tab') : homeTab;
  const switchTab = useCallback(
    (value) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === homeTab) next.delete('tab');
          else next.set('tab', value);
          return next;
        },
        { replace: true },
      ),
    [setSearchParams, homeTab],
  );
  // Leaving the escalation policy with unsaved changes asks first.
  const escalationDirty = useRef(false);
  const setEscalationDirty = useCallback((dirty) => {
    escalationDirty.current = dirty;
  }, []);
  const [leavingTo, setLeavingTo] = useState(null);
  const setTab = useCallback(
    (value) => {
      if (escalationDirty.current && value !== 'escalation') setLeavingTo(value);
      else switchTab(value);
    },
    [switchTab],
  );

  // Org chart: by level (the default — one cheap call) or by person.
  const chartView = searchParams.get('view') === 'people' ? 'people' : 'levels';
  const setChartView = useCallback(
    (value) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === 'people') next.set('view', 'people');
          else next.delete('view');
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const [reloadKey, setReloadKey] = useState(0);

  const [levels, setLevels] = useState([]);
  const [memberTotal, setMemberTotal] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
    // The org chart needs only the active levels; the rest is admin only.
    if (!canManage) {
      try {
        const levelData = await orgHierarchyAPI.listLevels({ activeOnly: true });
        setLevels(Array.isArray(levelData) ? levelData : []);
        setError(null);
        setLoaded(true);
      } catch (err) {
        setError(errorSummary(err));
      } finally {
        setLoading(false);
      }
      return;
    }
    try {
      // Inactive levels too: the Levels tab shows them. Of the directory, only
      // its size, for the tab's count.
      const [levelData, memberData, coverageData, pendingData] = await Promise.all([
        orgHierarchyAPI.listLevels({ activeOnly: false }),
        orgHierarchyAPI.listMembers({ pageSize: 1 }),
        orgHierarchyAPI.coverage(),
        // For the Approvals badge; the queue is optional, never a reason to fail.
        orgHierarchyAPI.listPending({ status: 'pending' }).catch(() => null),
      ]);
      if (Array.isArray(pendingData)) setPendingCount(pendingData.length);
      setLevels(Array.isArray(levelData) ? levelData : []);
      setMemberTotal(memberData?.total ?? null);
      setCoverage(coverageData);
      setError(null);
      setLoaded(true);
    } catch (err) {
      setError(errorSummary(err));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  const activeLevels = useMemo(() => sortLevels(levels.filter((l) => l.is_active !== false)), [levels]);
  const memberCounts = useMemo(
    () => new Map((coverage?.levels || []).map((l) => [l.code, l.member_count])),
    [coverage],
  );

  const initialLoad = loading && !loaded;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-ink">Reporting Hierarchy</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Who a report escalates to — someone above the person it names, never their peers or themselves.
          </p>
        </div>
        <Button variant="outline" startIcon={RefreshCw} onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>

      {!canManage && (
        <Alert variant="info" title="View only">
          Your role can see the org chart — its levels and the people in it. Everything else here, and any change, is
          for admins.
        </Alert>
      )}

      {error && (
        <Alert variant="error" title="Couldn't load the hierarchy">
          {error}{' '}
          <button type="button" onClick={load} className="font-medium text-link hover:underline">
            Try again
          </button>
        </Alert>
      )}

      {!error && (
          <Tabs value={tab} onChange={setTab}>
            <Tabs.List className="mb-5">
              {tabs.map(({ value, label }) => (
                <Tabs.Trigger key={value} value={value}>
                  {label}
                  {/* Counts arrive with the data; hold their space meanwhile. */}
                  {initialLoad && (value === 'levels' || value === 'directory') && <span className="invisible"> (0)</span>}
                  {!initialLoad && value === 'levels' && ` (${activeLevels.length})`}
                  {!initialLoad && value === 'directory' && memberTotal != null && ` (${memberTotal})`}
                  {value === 'approvals' && pendingCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-fg">
                      {pendingCount}
                    </span>
                  )}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {initialLoad ? (
              <HierarchySkeleton tab={tab} view={chartView} canManage={canManage} />
            ) : (
            <>

            <Tabs.Content value="coverage">
              <CoveragePanel
                coverage={coverage}
                levels={activeLevels}
                canManage={canManage}
                onChanged={load}
                onGoTo={setTab}
              />
            </Tabs.Content>
            <Tabs.Content value="chart">
              <ChartViewSwitch value={chartView} onChange={setChartView} />
              {chartView === 'people' ? (
                <OrgChartPanel
                  levels={activeLevels}
                  reloadKey={reloadKey}
                  canManage={canManage}
                  onChanged={load}
                  onGoTo={setTab}
                />
              ) : (
                <LevelChart onGoTo={setTab} reloadKey={reloadKey} />
              )}
            </Tabs.Content>
            <Tabs.Content value="levels">
              <LevelsPanel levels={levels} memberCounts={memberCounts} canManage={canManage} onChanged={load} />
            </Tabs.Content>
            <Tabs.Content value="directory">
              <DirectoryPanel levels={activeLevels} canManage={canManage} onChanged={load} reloadKey={reloadKey} />
            </Tabs.Content>
            <Tabs.Content value="approvals">
              <PendingPanel levels={activeLevels} canManage={canManage} onChanged={load} onCount={setPendingCount} />
            </Tabs.Content>
            <Tabs.Content value="escalation">
              <EscalationPanel canManage={canManage} onGoTo={setTab} onDirtyChange={setEscalationDirty} />
            </Tabs.Content>
            {canManage && (
              <Tabs.Content value="hr">
                <SyncPanel onChanged={load} onGoTo={setTab} />
              </Tabs.Content>
            )}
            </>
            )}
          </Tabs>
      )}
      <ConfirmationModal
        isOpen={Boolean(leavingTo)}
        onClose={() => setLeavingTo(null)}
        onConfirm={() => {
          escalationDirty.current = false;
          switchTab(leavingTo);
          setLeavingTo(null);
        }}
        title="Leave without saving?"
        message="Your changes to the escalation policy haven't been saved. They will be lost."
        confirmText="Leave"
        cancelText="Keep editing"
      />
    </div>
  );
};

export default Hierarchy;
