// src/components/hierarchy/CoveragePanel.jsx
//
// "Is it working?" — the landing view of the hierarchy screen. `resolvable`
// says whether an escalation lookup can return anything at all; the lists say
// where it can't. A sync reports unmatched job titles only once, in its own
// response; this is the standing answer.
//
// Each unmapped job title gets the two one-click fixes: add the title to a
// level's aliases (so future syncs place those people), or put the people with
// that title on a level now.
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Layers, UserX, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Alert from '../ui/Alert';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { errorSummary } from '../../utils/errors';

const Stat = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-line bg-surface p-4">
    <div className="flex items-center gap-2 text-xs text-ink-muted">
      <Icon className="h-4 w-4" />
      {label}
    </div>
    <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{value ?? 0}</p>
  </div>
);

const UnmappedTitle = ({ entry, levels, members, canManage, onChanged }) => {
  const [levelCode, setLevelCode] = useState('');
  const [busy, setBusy] = useState(null); // 'alias' | 'assign'
  const level = levels.find((l) => l.code === levelCode);

  // The people carrying this title with no level yet, by id, from the directory.
  const unplaced = members.filter(
    (m) => m.is_active !== false && !m.level_code && (m.designation || '').trim() === entry.designation,
  );

  const addAlias = async () => {
    setBusy('alias');
    try {
      await orgHierarchyAPI.updateLevel(level.id, {
        designation_aliases: [...(level.designation_aliases || []), entry.designation],
      });
      toast.success(`"${entry.designation}" now maps to ${level.title} from the next sync.`);
      onChanged();
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setBusy(null);
    }
  };

  const assignPeople = async () => {
    setBusy('assign');
    const results = await Promise.allSettled(
      unplaced.map((m) => orgHierarchyAPI.updateMember(m.id, { level_code: level.code })),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === 0) {
      toast.success(`${unplaced.length} ${unplaced.length === 1 ? 'person' : 'people'} placed on ${level.title}.`);
    } else {
      toast.error(`${failed.length} of ${unplaced.length} couldn't be updated: ${errorSummary(failed[0].reason)}`);
    }
    setBusy(null);
    onChanged();
  };

  return (
    <li className="space-y-2 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{entry.designation}</p>
        <p className="text-xs text-ink-muted">
          {entry.people.length} {entry.people.length === 1 ? 'person' : 'people'}: {entry.people.join(', ')}
        </p>
      </div>
      {canManage && levels.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={levelCode}
            onChange={(event) => setLevelCode(event.target.value)}
            aria-label={`Level for ${entry.designation}`}
            className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink sm:w-56"
          >
            <option value="">Choose a level…</option>
            {levels.map((l) => (
              <option key={l.code} value={l.code}>
                {l.title}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="small"
            disabled={!level || Boolean(busy)}
            isLoading={busy === 'alias'}
            onClick={addAlias}
            title="Future syncs place everyone with this title on the level"
          >
            Add title to level
          </Button>
          <Button
            variant="outline"
            size="small"
            disabled={!level || Boolean(busy) || unplaced.length === 0}
            isLoading={busy === 'assign'}
            onClick={assignPeople}
            title="Set the level on these people now, as corrections that survive syncs"
          >
            Put {unplaced.length === 1 ? 'this person' : 'these people'} on it
          </Button>
        </div>
      )}
    </li>
  );
};

const CoveragePanel = ({ coverage, levels, members, canManage, onChanged, onGoTo }) => {
  if (!coverage) return null;

  const problems = coverage.problems || [];
  const unmapped = coverage.unmapped_designations || [];
  const noManager = coverage.members_without_manager || [];
  const coverageLevels = coverage.levels || [];
  const hasCode = (code) => problems.some((p) => p.code === code);

  return (
    <div className="space-y-6">
      {coverage.resolvable ? (
        <Alert variant="success" title="Escalation can resolve">
          A report naming someone in the directory can be routed to the person above them.
          {problems.length > 0 && ' Some gaps below may still leave individual reports for a human to route.'}
        </Alert>
      ) : (
        <Alert variant="error" title="Escalation can't resolve anything yet">
          Every report will fall back to manual routing until the problems below are fixed.
        </Alert>
      )}

      {problems.length > 0 && (
        <Card title="What needs attention" icon={AlertTriangle}>
          <ul className="space-y-2">
            {problems.map((problem, index) => (
              <li key={`${problem.code}-${index}`} className="flex flex-col gap-1 text-sm text-ink-secondary sm:flex-row sm:items-center sm:justify-between">
                <span>{problem.message}</span>
                {problem.code === 'no_levels' && canManage && (
                  <Button variant="outline" size="small" onClick={() => onGoTo('levels')}>
                    Add levels
                  </Button>
                )}
                {problem.code === 'no_members' && canManage && (
                  <Button variant="outline" size="small" onClick={() => onGoTo('directory')}>
                    Add people
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Layers} label="Levels" value={coverage.level_count} />
        <Stat icon={Users} label="People" value={coverage.member_count} />
        <Stat icon={Users} label="Added by hand" value={coverage.manual_member_count} />
        <Stat icon={CheckCircle2} label="Corrected from HR" value={coverage.override_count} />
      </div>

      {unmapped.length > 0 && (
        <Card title={`Job titles on no level (${unmapped.length})`} icon={AlertTriangle}>
          <p className="text-xs text-ink-muted">
            People with these titles can't be escalated from, and nobody can escalate to them.
          </p>
          <ul className="mt-2 divide-y divide-line-subtle">
            {unmapped.map((entry) => (
              <UnmappedTitle
                key={entry.designation}
                entry={entry}
                levels={levels}
                members={members}
                canManage={canManage}
                onChanged={onChanged}
              />
            ))}
          </ul>
        </Card>
      )}

      {coverageLevels.length > 0 && (
        <Card title="Levels" icon={Layers} padding="none">
          <ul className="divide-y divide-line-subtle">
            {coverageLevels.map((level) => (
              <li key={level.code} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{level.title}</span>
                    <span className="font-mono text-[11px] text-ink-subtle">
                      {level.code} · rank {level.rank}
                    </span>
                    {level.department && <Badge size="small">{level.department}</Badge>}
                    {level.vacant && <Badge variant="warning" size="small">Vacant</Badge>}
                  </div>
                  {level.members?.length > 0 && (
                    <p className="truncate text-xs text-ink-muted" title={level.members.join(', ')}>
                      {level.members.join(', ')}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                  {level.member_count} {level.member_count === 1 ? 'person' : 'people'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {noManager.length > 0 && (
        <Card title={`No manager on file (${noManager.length})`} icon={UserX}>
          <p className="text-xs text-ink-muted">
            Escalation falls back to the nearest level above for these people, which is less precise than a real reporting
            line.
          </p>
          <ul className="mt-2 divide-y divide-line-subtle">
            {noManager.map((person, index) => (
              <li key={`${person.name}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-ink">{person.name}</span>
                <span className="text-xs text-ink-muted">{person.reason}</span>
              </li>
            ))}
          </ul>
          {canManage && (
            <Button className="mt-3" variant="outline" size="small" onClick={() => onGoTo('directory')}>
              Open the directory
            </Button>
          )}
        </Card>
      )}

      {!hasCode('no_levels') && !hasCode('no_members') && unmapped.length === 0 && noManager.length === 0 && problems.length === 0 && (
        <p className="text-sm text-ink-muted">No gaps found: every person has a level and a manager on file.</p>
      )}
    </div>
  );
};

export default CoveragePanel;
