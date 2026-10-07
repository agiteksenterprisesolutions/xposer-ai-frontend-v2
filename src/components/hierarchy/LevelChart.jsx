// src/components/hierarchy/LevelChart.jsx
//
// The organization drawn by level, from GET /org-hierarchy/chart: one cheap
// call however large the organization is, levels most senior first, each with
// the roles present at it. People are a drill-down — a role chip opens the
// user list filtered to that level and role, which is where paging belongs.
//
// Escalation is shown as the backend resolves it (`receives_escalations`):
// the lowest level and levels marked "not an escalation target" never receive
// a case, whatever their stored setting.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Layers, Link2Off, UserRound, Users } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { ACCESS } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { errorSummary } from '../../utils/errors';

const usersLink = (orgSlug, params) => `${staffPath(orgSlug, 'users')}?${new URLSearchParams(params).toString()}`;

const LevelRow = ({ level, isLowest, usersHref, nameFor }) => {
  const roles = level.roles || [];
  const blockedReason = level.receives_escalations === false
    ? isLowest || level.is_lowest_level
      ? 'Lowest level · never an escalation target'
      : 'Not an escalation target'
    : null;

  return (
    <li className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9375rem] font-semibold text-ink">{level.title}</span>
            <span className="font-mono text-[11px] text-ink-subtle">
              {level.code} · rank {level.rank}
            </span>
            {level.department && <Badge size="small">{level.department}</Badge>}
            {level.vacant && <Badge variant="warning" size="small">Vacant</Badge>}
            {blockedReason && <Badge size="small">{blockedReason}</Badge>}
          </div>
          {level.departments?.length > 0 && !level.department && (
            <p className="mt-0.5 text-xs text-ink-muted">{level.departments.join(' · ')}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5" title="People in the directory at this level">
            <Users className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-semibold text-ink">{level.member_count ?? 0}</span> people
          </span>
          <span title="Directory entries with a login, and without one">
            <span className="font-semibold text-ink">{level.with_account ?? 0}</span> with a login ·{' '}
            <span className="font-semibold text-ink">{level.without_account ?? 0}</span> without
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {roles.length === 0 && <span className="text-xs text-ink-muted">No accounts at this level yet.</span>}
        {roles.map(({ role, count }) => {
          const chip = (
            <>
              {nameFor(role)}
              <span className="rounded-full bg-active px-1.5 text-[11px] font-semibold text-ink-secondary">{count}</span>
            </>
          );
          return usersHref ? (
            <Link
              key={role}
              to={usersHref({ level: level.code, role })}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-secondary transition-colors hover:border-line-accent hover:text-accent-fg"
              title={`See the ${nameFor(role)} accounts at ${level.title}`}
            >
              {chip}
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ) : (
            <span
              key={role}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-secondary"
            >
              {chip}
            </span>
          );
        })}
      </div>
    </li>
  );
};

const LevelChartSkeleton = () => (
  <ul className="space-y-3" aria-busy="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <Skeleton.Text size="base" className="w-48" />
          <Skeleton.Text size="xs" className="w-56" />
        </div>
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-6.5 w-24 rounded-full" />
          <Skeleton className="h-6.5 w-20 rounded-full" />
        </div>
      </li>
    ))}
  </ul>
);

const LevelChart = ({ onGoTo, reloadKey }) => {
  const { nameFor } = useOrgRoles();
  const can = useCan();
  const orgSlug = useAuthStore((s) => s.user?.organization_slug);
  const [chart, setChart] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setChart(await orgHierarchyAPI.chart());
      setError(null);
    } catch (err) {
      setError(errorSummary(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const canSeeUsers = can(ACCESS.users);
  const usersHref = canSeeUsers ? (params) => usersLink(orgSlug, params) : null;

  if (error) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-secondary">
        Couldn't load the chart. {error}{' '}
        <button type="button" onClick={load} className="font-medium text-link hover:underline">
          Try again
        </button>
      </div>
    );
  }
  if (!chart) return <LevelChartSkeleton />;

  const levels = chart.levels || [];
  const lowest = levels.at(-1)?.code;

  return (
    <div className="space-y-4">
      {chart.unplaced_members > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">
              {chart.unplaced_members} {chart.unplaced_members === 1 ? 'person has' : 'people have'} no level.
            </span>{' '}
            Escalation can't route a report around someone who isn't placed.
          </p>
          <button type="button" onClick={() => onGoTo?.('directory')} className="font-semibold underline underline-offset-2">
            Place them
          </button>
        </div>
      )}
      {chart.unlinked_accounts > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-secondary">
          <Link2Off className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            <span className="font-semibold text-ink">
              {chart.unlinked_accounts} {chart.unlinked_accounts === 1 ? 'account isn’t' : 'accounts aren’t'} linked to
              the directory.
            </span>{' '}
            They see only their own cases, whatever their role allows.
          </p>
          {usersHref && (
            <Link to={usersHref({ unlinked: 'true' })} className="font-semibold text-link hover:underline">
              See them
            </Link>
          )}
        </div>
      )}

      {levels.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <Layers className="h-6 w-6 text-ink-subtle" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">No levels yet</p>
          <p className="max-w-sm text-sm text-ink-muted">
            The chart is drawn from your levels — the ladder a report escalates up. Add them first.
          </p>
          <Button variant="secondary" size="small" className="mt-2" onClick={() => onGoTo?.('levels')}>
            Go to Levels
          </Button>
        </div>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            {chart.level_count ?? levels.length} levels · {chart.member_count ?? 0} people · most senior first.
            {usersHref && ' Click a role to see who holds it.'}
          </p>
          <ol className="space-y-3">
            {levels.map((level) => (
              <LevelRow key={level.code} level={level} isLowest={level.code === lowest} usersHref={usersHref} nameFor={nameFor} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
};

export default LevelChart;
