// src/components/hierarchy/CoveragePanel.jsx
//
// "Is it working?" — the landing view of the hierarchy screen. `resolvable`
// says whether an escalation lookup can return anything at all; the lists say
// where it can't. A sync reports unmatched job titles only once, in its own
// response; this is the standing answer.
//
// Each unmapped job title gets the two one-click fixes: add the title to a
// level's aliases (so future syncs suggest that level), or give the people
// with that title a role now — a person is placed by their role, never by a
// level set on them.
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Layers, UserX, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../utils/locale';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Alert from '../ui/Alert';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { errorSummary } from '../../utils/errors';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { roleWithLevel, sortRolesByLevel } from '../../utils/roleLevels';

const Stat = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-line bg-surface p-4">
    <div className="flex items-center gap-2 text-xs text-ink-muted">
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </div>
    <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{value ?? 0}</p>
  </div>
);

const UnmappedTitle = ({ entry, levels, canManage, onChanged }) => {
  const { t } = useTranslation('hierarchy');
  const [levelCode, setLevelCode] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [busy, setBusy] = useState(null); // 'alias' | 'assign'
  const level = levels.find((l) => l.code === levelCode);
  const { allRoles } = useOrgRoles();
  // Only roles that sit somewhere can place anyone.
  const placingRoles = sortRolesByLevel(allRoles.filter((r) => r.level_code && r.is_active !== false));
  const role = placingRoles.find((r) => r.code === roleCode);

  // The coverage entry names the people carrying this title; their ids come
  // from the directory, searched by the title, when the role is applied.
  const named = entry.people?.length || 0;
  const unplacedWithTitle = async () => {
    const found = [];
    for (let page = 1; ; page += 1) {
      const data = await orgHierarchyAPI.listMembers({ search: entry.designation, page, pageSize: 200 });
      found.push(...data.items);
      if (!data.has_next) break;
    }
    return found.filter((m) => m.is_active !== false && !m.level_code && (m.designation || '').trim() === entry.designation);
  };

  const addAlias = async () => {
    setBusy('alias');
    try {
      await orgHierarchyAPI.updateLevel(level.id, {
        designation_aliases: [...(level.designation_aliases || []), entry.designation],
      });
      toast.success(t('coverage.aliasAdded', { title: entry.designation, level: level.title }));
      onChanged();
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setBusy(null);
    }
  };

  const assignPeople = async () => {
    setBusy('assign');
    try {
      const unplaced = await unplacedWithTitle();
      if (unplaced.length === 0) {
        toast.info(t('coverage.allPlaced', { title: entry.designation }));
        return;
      }
      const results = await Promise.allSettled(
        unplaced.map((m) => orgHierarchyAPI.updateMember(m.id, { role_code: role.code })),
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === 0) {
        toast.success(t('coverage.roleGiven', { count: unplaced.length, role: role.name, level: role.level_title }));
      } else {
        toast.error(t('coverage.someFailed', { failed: failed.length, total: unplaced.length, error: errorSummary(failed[0].reason) }));
      }
      onChanged();
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="space-y-2 py-3">
      <div>
        <p className="text-sm font-medium text-ink" dir="auto">{entry.designation}</p>
        <p className="text-xs text-ink-muted">
          {t('coverage.peopleList', { count: entry.people.length, names: new Intl.ListFormat(intlLocale(), { type: 'unit' }).format(entry.people) })}
        </p>
      </div>
      {canManage && levels.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={levelCode}
            onChange={(event) => setLevelCode(event.target.value)}
            aria-label={t('coverage.levelFor', { title: entry.designation })}
            className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink sm:w-56"
          >
            <option value="">{t('coverage.chooseLevel')}</option>
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
            title={t('coverage.addAliasHint')}
          >
            {t('coverage.addAlias')}
          </Button>
        </div>
      )}
      {canManage && named > 0 && placingRoles.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={roleCode}
            onChange={(event) => setRoleCode(event.target.value)}
            aria-label={t('coverage.roleFor', { title: entry.designation })}
            className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink sm:w-56"
          >
            <option value="">{t('coverage.chooseRole')}</option>
            {placingRoles.map((r) => (
              <option key={r.code} value={r.code}>
                {roleWithLevel(r)}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="small"
            disabled={!role || Boolean(busy)}
            isLoading={busy === 'assign'}
            onClick={assignPeople}
            title={t('coverage.giveRoleHint')}
          >
            {t('coverage.giveRole', { count: named })}
          </Button>
        </div>
      )}
    </li>
  );
};

const CoveragePanel = ({ coverage, levels, canManage, onChanged, onGoTo }) => {
  const { t } = useTranslation('hierarchy');
  if (!coverage) return null;

  const problems = coverage.problems || [];
  const unmapped = coverage.unmapped_designations || [];
  const noManager = coverage.members_without_manager || [];
  const coverageLevels = coverage.levels || [];
  const hasCode = (code) => problems.some((p) => p.code === code);

  return (
    <div className="space-y-6">
      {coverage.resolvable ? (
        <Alert variant="success" title={t('coverage.resolvableTitle')}>
          {t('coverage.resolvableBody')}
          {problems.length > 0 && ` ${t('coverage.resolvableGaps')}`}
        </Alert>
      ) : (
        <Alert variant="error" title={t('coverage.unresolvableTitle')}>
          {t('coverage.unresolvableBody')}
        </Alert>
      )}

      {problems.length > 0 && (
        <Card title={t('coverage.needsAttention')} icon={AlertTriangle}>
          <ul className="space-y-2">
            {problems.map((problem, index) => (
              <li key={`${problem.code}-${index}`} className="flex flex-col gap-1 text-sm text-ink-secondary sm:flex-row sm:items-center sm:justify-between">
                <span>{problem.message}</span>
                {problem.code === 'no_levels' && canManage && (
                  <Button variant="outline" size="small" onClick={() => onGoTo('levels')}>
                    {t('coverage.addLevels')}
                  </Button>
                )}
                {problem.code === 'no_members' && canManage && (
                  <Button variant="outline" size="small" onClick={() => onGoTo('directory')}>
                    {t('coverage.addPeople')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={Layers} label={t('coverage.stats.levels')} value={coverage.level_count} />
        <Stat icon={Users} label={t('coverage.stats.people')} value={coverage.member_count} />
        <Stat icon={Users} label={t('coverage.stats.manual')} value={coverage.manual_member_count} />
        <Stat icon={CheckCircle2} label={t('coverage.stats.overrides')} value={coverage.override_count} />
      </div>

      {unmapped.length > 0 && (
        <Card title={t('coverage.unmappedTitle', { count: unmapped.length })} icon={AlertTriangle}>
          <p className="text-xs text-ink-muted">
            {t('coverage.unmappedBody')}
          </p>
          <ul className="mt-2 divide-y divide-line-subtle">
            {unmapped.map((entry) => (
              <UnmappedTitle
                key={entry.designation}
                entry={entry}
                levels={levels}
                canManage={canManage}
                onChanged={onChanged}
              />
            ))}
          </ul>
        </Card>
      )}

      {coverageLevels.length > 0 && (
        <Card title={t('coverage.levelsCard')} icon={Layers} padding="none">
          <ul className="divide-y divide-line-subtle">
            {coverageLevels.map((level) => (
              <li key={level.code} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink" dir="auto">{level.title}</span>
                    <span className="font-mono text-[11px] text-ink-subtle">
                      {t('coverage.codeRank', { code: level.code, rank: level.rank })}
                    </span>
                    {level.department && <Badge size="small">{level.department}</Badge>}
                    {level.vacant && <Badge variant="warning" size="small">{t('coverage.vacant')}</Badge>}
                  </div>
                  {level.members?.length > 0 && (
                    <p className="truncate text-xs text-ink-muted" title={level.members.join(', ')}>
                      {level.members.join(', ')}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                  {t('people', { count: level.member_count })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {noManager.length > 0 && (
        <Card title={t('coverage.noManagerTitle', { count: noManager.length })} icon={UserX}>
          <p className="text-xs text-ink-muted">
            {t('coverage.noManagerBody')}
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
              {t('coverage.openDirectory')}
            </Button>
          )}
        </Card>
      )}

      {!hasCode('no_levels') && !hasCode('no_members') && unmapped.length === 0 && noManager.length === 0 && problems.length === 0 && (
        <p className="text-sm text-ink-muted">{t('coverage.noGaps')}</p>
      )}
    </div>
  );
};

export default CoveragePanel;
