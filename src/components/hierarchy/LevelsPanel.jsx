// src/components/hierarchy/LevelsPanel.jsx
//
// The ladder, most senior first. There is no fixed set of tiers: add as many
// as the organization has. Reordering rewrites ranks in steps of 10 (keeping
// room to slot a tier in later) rather than packing them contiguously.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Eye, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../utils/locale';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Alert from '../ui/Alert';
import { ConfirmationModal } from '../ui/Modal';
import LevelEditorModal from './LevelEditorModal';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { nextRank, reRank, sortLevels } from '../../utils/hierarchy';
import { errorSummary } from '../../utils/errors';
import { useAuthStore } from '../../store/authStore';
import { staffPath } from '../../utils/navigation';

const ALIAS_PREVIEW = 3;

/** The roles that sit at a level — derived from the roles, read-only. */
const levelRoles = (level) => (Array.isArray(level.roles) ? level.roles : []);

const LevelsPanel = ({ levels, memberCounts, canManage, onChanged }) => {
  const { t } = useTranslation('hierarchy');
  const { nameFor } = useOrgRoles();
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null); // { level } — null level means create
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  // 409 level_in_use from the last delete: { title, message, roles }.
  const [deleteBlocked, setDeleteBlocked] = useState(null);
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);

  const ordered = sortLevels(levels);
  const visible = showInactive ? ordered : ordered.filter((l) => l.is_active !== false);
  // Most senior first, so the last active level is the bottom of the ladder.
  const lowestCode = ordered.filter((l) => l.is_active !== false).at(-1)?.code;
  const inactiveCount = ordered.length - ordered.filter((l) => l.is_active !== false).length;

  const move = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= visible.length) return;
    const next = [...visible];
    [next[index], next[target]] = [next[target], next[index]];

    setBusy(true);
    try {
      // Sequential, so a failure leaves a clear point to report from.
      for (const { level, rank } of reRank(next)) {
        await orgHierarchyAPI.updateLevel(level.id, { rank });
      }
    } catch (error) {
      toast.error(t('levels.reorderFailed', { error: errorSummary(error) }));
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await orgHierarchyAPI.deleteLevel(deleting.id);
      toast.success(t('levels.deleted', { title: deleting.title }));
      setDeleting(null);
      setDeleteBlocked(null);
      onChanged();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      // 409 level_in_use: roles still sit here; deleting it would leave
      // everyone holding them unplaceable.
      if (detail?.code === 'level_in_use') {
        setDeleteBlocked({ title: deleting.title, message: detail.message, roles: detail.roles || [] });
        setDeleting(null);
      } else {
        toast.error(errorSummary(error));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {deleteBlocked && (
        <Alert variant="warning" title={t('levels.cantDelete', { title: deleteBlocked.title })} dismissible onDismiss={() => setDeleteBlocked(null)}>
          <p>{deleteBlocked.message}</p>
          {deleteBlocked.roles.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5">
              {deleteBlocked.roles.map((code) => (
                <Link
                  key={code}
                  to={`${staffPath(orgSlug, 'roles')}?role=${encodeURIComponent(code)}`}
                  className="rounded-full border border-warning-line bg-surface px-2.5 py-0.5 text-xs font-semibold hover:underline"
                >
                  {nameFor(code)}
                </Link>
              ))}
            </p>
          )}
          <p className="mt-2 text-xs">{t('levels.moveRolesFirst')}</p>
        </Alert>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">{t('levels.intro')}</p>
        <div className="flex items-center gap-3">
          {inactiveCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4 rounded border-line-strong"
              />
              {t('levels.showInactive', { count: inactiveCount })}
            </label>
          )}
          {canManage && (
            <Button startIcon={Plus} onClick={() => setEditing({ level: null })}>
              {t('levelEditor.newTitle')}
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <Card className="py-10 text-center">
          <Layers className="mx-auto h-8 w-8 text-ink-subtle" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">{t('levelChart.noLevels')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            {t('levels.emptyBody')}
          </p>
        </Card>
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-line-subtle">
            {visible.map((level, index) => {
              const aliases = level.designation_aliases || [];
              const count = memberCounts.get(level.code);
              return (
                <li
                  key={level.id}
                  className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${level.is_active === false ? 'opacity-60' : ''}`}
                >
                  {canManage && (
                    <div className="flex shrink-0 gap-1 sm:flex-col">
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={busy || index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={t('levels.moveUp', { title: level.title })}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        disabled={busy || index === visible.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={t('levels.moveDown', { title: level.title })}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink" dir="auto">{level.title}</span>
                      <span className="font-mono text-[11px] text-ink-subtle">
                        {t('coverage.codeRank', { code: level.code, rank: level.rank })}
                      </span>
                      {level.department && <Badge size="small">{level.department}</Badge>}
                      {level.is_active === false && <Badge variant="warning" size="small">{t('levels.inactive')}</Badge>}
                      {/* Escalation never stops here: the bottom rung by rule, or an oversight level by choice. */}
                      {level.code === lowestCode ? (
                        <Badge size="small">{t('levelChart.lowestNeverTarget')}</Badge>
                      ) : (
                        level.can_receive_escalations === false && <Badge size="small">{t('levelChart.notTarget')}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      {aliases.length === 0 ? (
                        <span>{t('levels.noAliases')}</span>
                      ) : (
                        <>
                          {aliases.slice(0, ALIAS_PREVIEW).map((alias) => (
                            <span key={alias} className="rounded-full border border-line px-2 py-0.5" dir="auto">
                              {alias}
                            </span>
                          ))}
                          {aliases.length > ALIAS_PREVIEW && <span>{t('levels.more', { count: aliases.length - ALIAS_PREVIEW })}</span>}
                        </>
                      )}
                      {levelRoles(level).length > 0 ? (
                        <span>· {new Intl.ListFormat(intlLocale(), { type: 'unit' }).format(levelRoles(level).map(nameFor))}</span>
                      ) : (
                        <span>· {t('levels.noRoleHere')}</span>
                      )}
                      {count != null && (
                        <span>
                          · {t('people', { count })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {canManage ? (
                      <>
                        <Button variant="outline" size="small" startIcon={Pencil} onClick={() => setEditing({ level })}>
                          {t('common:actions.edit')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => setDeleting(level)}
                          aria-label={t('levels.deleteLabel', { title: level.title })}
                        >
                          <Trash2 className="h-4 w-4 text-danger-fg" aria-hidden="true" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="small" startIcon={Eye} onClick={() => setEditing({ level })}>
                        {t('common:actions.view')}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {editing && (
        <LevelEditorModal
          level={editing.level}
          defaultRank={nextRank(levels)}
          readOnly={!canManage}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}

      <ConfirmationModal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={t('levels.deleteTitle')}
        message={
          deleting
            ? t('levels.deleteMessage', { title: deleting.title })
            : ''
        }
        confirmText={t('levels.deleteConfirm')}
        destructive
        isLoading={busy}
      />
    </div>
  );
};

export default LevelsPanel;
