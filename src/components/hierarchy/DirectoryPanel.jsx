// src/components/hierarchy/DirectoryPanel.jsx
//
// The people escalation resolves against.
//
// A person sits where their role sits: `role_code` places them and
// `level_code` is resolved from it (read-only). `manager_external_id` is the
// effective manager; `manager_external_id_from_hr` is shown as provenance
// ("HR says …") where a human corrected it. Two badges carry different
// meanings and are kept apart:
//   source "manual"       — added by hand; untouched by every sync.
//   has_manual_override   — synced from HR, then the manager corrected.
//
// The directory is the client's whole headcount, so it is paged and searched
// on the server (GET /org-hierarchy/members): a page of 50, a search over
// name, email, job title, department and employee id, a level filter, and
// whether to include inactive entries. Managers named on the page are looked
// up by id rather than from a full list.
//
// The Login column reads two flags. No account → "Create login" (Add person
// prefilled from the entry; needs user:create, separate from managing the
// directory). Accounts, none active → "Login deactivated" + Reactivate, never
// a second login, which would collide on the username. An active account →
// "Has a login". `accounts` can hold more than one (a staff and a reporter
// account), so the badge follows `has_active_account`, not accounts[0].
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import Table from '../ui/Table';
import Pagination from '../ui/Pagination';
import { ConfirmationModal } from '../ui/Modal';
import MemberEditorModal from './MemberEditorModal';
import AddPersonModal from '../users/AddPersonModal';
import { useCan } from '../../hooks/useCan';
import { ACCESS, PERM } from '../../utils/permissions';
import BulkImportModal from './BulkImportModal';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { usersAPI } from '../../api/users';
import { useAuthStore } from '../../store/authStore';
import { staffPath } from '../../utils/navigation';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { errorSummary } from '../../utils/errors';
import { useDebounce } from '../../hooks/useDebounce';
import { useMemberNames } from '../../hooks/useMemberNames';

const PAGE_SIZE = 50;

const SourceBadge = ({ member }) => {
  const { t } = useTranslation('hierarchy');
  return member.source === 'manual' ? (
    <Badge variant="secondary" size="small" title={t('directory.manualHint')}>
      {t('directory.manual')}
    </Badge>
  ) : (
    <Badge size="small" title={t('directory.fromHrHint')}>
      {t('directory.fromHr')}
    </Badge>
  );
};

const DirectoryPanel = ({ levels, canManage, onChanged, reloadKey }) => {
  const { t } = useTranslation('hierarchy');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [page, setPage] = useState(1);
  // ?level=code — how an org chart role opens the people at its level. Read
  // once on arrival, then dropped so it doesn't come back on a later visit.
  const [searchParams, setSearchParams] = useSearchParams();
  const [levelFilter, setLevelFilter] = useState(() => searchParams.get('level') || '');
  useEffect(() => {
    if (!searchParams.has('level')) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('level');
      return next;
    }, { replace: true });
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null); // { member } — null member means add
  const [importing, setImporting] = useState(false);
  // Adding someone goes through the same form as Users → Add person, with its
  // "Create a login" switch, when the viewer may create users (POST
  // /users/person needs user:create). Without it, the directory-only form.
  const can = useCan();
  const canCreateUsers = can(PERM.userCreate);
  const canSeeUsers = can(ACCESS.users);
  const canReactivate = can(PERM.userUpdate);
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const { nameFor: nameForRole } = useOrgRoles();
  const [adding, setAdding] = useState(false);
  const [creatingLoginFor, setCreatingLoginFor] = useState(null);
  const [reactivating, setReactivating] = useState(null);

  // ─── The page ────────────────────────────────────────────────────────
  const [data, setData] = useState(null); // the page envelope
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [localTick, setLocalTick] = useState(0);

  // A new search or filter starts from page 1; on page 7 it would read as "no results".
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, levelFilter, showInactive]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    orgHierarchyAPI
      .listMembers({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        levelCode: levelFilter,
        activeOnly: !showInactive,
        quiet: true,
      })
      .then((result) => {
        if (!live) return;
        setData(result);
        setLoadError(null);
      })
      .catch((error) => live && setLoadError(errorSummary(error)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [page, debouncedSearch, levelFilter, showInactive, reloadKey, localTick]);

  const members = useMemo(() => data?.items || [], [data]);
  const total = data?.total ?? 0;
  const filtering = Boolean(debouncedSearch || levelFilter);

  // Managers on this page who aren't on it themselves, looked up by id.
  const { nameOf: lookedUpName } = useMemberNames(members.flatMap((m) => [m.manager_external_id, m.manager_external_id_from_hr]));
  const onPage = useMemo(() => new Map(members.map((m) => [m.external_id, m.name])), [members]);
  const nameFor = (id) => onPage.get(id) || lookedUpName(id) || id;

  // Hierarchy reloads everything after a change, and its reloadKey refetches this page.
  const changed = () => onChanged();

  const reactivate = async (member) => {
    setReactivating(member.external_id);
    try {
      const inactive = (member.accounts || []).filter((a) => a.is_active === false);
      await Promise.all(inactive.map((a) => usersAPI.activateUser(a.id)));
      changed();
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setReactivating(null);
    }
  };

  /** The Login cell: whether they can sign in, and the one action that fits. */
  const loginCell = (member) => {
    if (member.has_account === undefined) return <span className="text-sm text-ink-subtle">—</span>;
    const accounts = member.accounts || [];
    if (member.has_account && !member.has_active_account) {
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="warning" size="small">{t('directory.loginDeactivated')}</Badge>
          {canReactivate && member.is_active !== false && accounts.some((a) => a.is_active === false) && (
            <Button variant="outline" size="small" onClick={() => reactivate(member)} isLoading={reactivating === member.external_id}>
              {t('directory.reactivate')}
            </Button>
          )}
        </div>
      );
    }
    if (member.has_account) {
      const count = accounts.length || member.account_ids?.length || 1;
      const usersLink = canSeeUsers && member.email ? `${staffPath(orgSlug, 'users')}?search=${encodeURIComponent(member.email)}` : null;
      const badge = (
        <Badge
          variant="success"
          size="small"
          title={count > 1 ? accounts.map((a) => (a.is_active === false ? t('directory.accountDeactivated', { username: a.username, role: nameForRole(a.role) }) : t('directory.account', { username: a.username, role: nameForRole(a.role) }))).join('\n') : undefined}
        >
          {count > 1 ? t('directory.logins', { count }) : t('directory.hasLogin')}
        </Badge>
      );
      return usersLink ? (
        <Link to={usersLink} title={t('directory.openInUsers')} className="hover:opacity-80">
          {badge}
        </Link>
      ) : (
        badge
      );
    }
    if (canCreateUsers && member.is_active !== false) {
      return (
        <Button variant="outline" size="small" onClick={() => setCreatingLoginFor(member)}>
          {t('directory.createLogin')}
        </Button>
      );
    }
    return <span className="text-sm text-ink-muted">{t('directory.noLogin')}</span>;
  };
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const levelTitle = useMemo(() => new Map(levels.map((l) => [l.code, l.title])), [levels]);

  const confirmRemove = async () => {
    setBusy(true);
    try {
      await orgHierarchyAPI.deleteMember(removing.id);
      toast.success(
        removing.source === 'manual' ? t('directory.removed', { name: removing.name }) : t('directory.deactivated', { name: removing.name }),
      );
      setRemoving(null);
      changed();
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setBusy(false);
    }
  };

  const provenance = (member, field, format) => {
    if (!member.has_manual_override) return null;
    const hr = member[`${field}_from_hr`] ?? null;
    if (hr === (member[field] ?? null)) return null;
    return <p className="text-[11px] text-ink-subtle">{t('member.hrSays')} {hr ? format(hr) : t('member.none')}</p>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('directory.searchPlaceholder')}
              aria-label={t('picker.searchLabel')}
              className="w-full rounded-lg border border-line bg-subtle py-2 ps-9 pe-3 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-accent focus:ring-2 focus:ring-accent-ring"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            aria-label={t('directory.filterLevel')}
            className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink sm:w-52"
          >
            <option value="">{t('directory.allLevels')}</option>
            {levels.map((level) => (
              <option key={level.code} value={level.code}>
                {level.title}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="h-4 w-4 rounded border-line-strong"
            />
            {t('directory.includeInactive')}
          </label>
        </div>
        {/* Adding people — by hand or from a spreadsheet — is admin only (user:create). */}
        {canManage && canCreateUsers && (
          <div className="flex gap-2">
            <Button variant="outline" startIcon={Upload} onClick={() => setImporting(true)}>
              {t('directory.paste')}
            </Button>
            <Button startIcon={Plus} onClick={() => setAdding(true)}>
              {t('member.add')}
            </Button>
          </div>
        )}
      </div>

      <Card padding="none">
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              <Table.Head>{t('directory.cols.person')}</Table.Head>
              <Table.Head>{t('directory.cols.jobTitle')}</Table.Head>
              <Table.Head>{t('directory.cols.roleLevel')}</Table.Head>
              <Table.Head>{t('directory.cols.manager')}</Table.Head>
              <Table.Head>{t('directory.cols.login')}</Table.Head>
              <Table.Head>{t('directory.cols.source')}</Table.Head>
              {canManage && <Table.Head className="text-end">{t('directory.cols.actions')}</Table.Head>}
            </Table.Row>
          </Table.Header>
          <Table.Body className={loading && data ? 'opacity-60 transition-opacity' : ''}>
            {loadError ? (
              <Table.Empty
                message={t('directory.loadError')}
                description={loadError}
                icon={Users}
                action={
                  <Button variant="outline" size="small" onClick={() => setLocalTick((t) => t + 1)}>
                    {t('common:actions.retry')}
                  </Button>
                }
              />
            ) : !data ? (
              <Table.Loading colSpan={canManage ? 7 : 6} rows={8} />
            ) : members.length === 0 ? (
              <Table.Empty
                message={filtering ? t('directory.noMatch') : t('directory.empty')}
                description={
                  filtering
                    ? t('directory.noMatchBody')
                    : t('directory.emptyBody')
                }
                icon={Users}
              />
            ) : (
              members.map((member) => (
                <Table.Row key={member.id} className={member.is_active === false ? 'opacity-60' : ''}>
                  <Table.Cell>
                    {member.is_active !== false ? (
                      <Link
                        to={{ search: `?tab=chart&view=people&person=${encodeURIComponent(member.external_id)}` }}
                        title={t('directory.showInChart')}
                        className="text-sm font-medium text-ink hover:text-link hover:underline"
                      >
                        {member.name}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-ink">{member.name}</p>
                    )}
                    <p className="text-xs text-ink-muted">{member.email || member.external_id}</p>
                  </Table.Cell>
                  <Table.Cell>
                    <p className="text-sm text-ink-secondary" dir="auto">{member.designation || '—'}</p>
                    {member.department && <p className="text-xs text-ink-subtle">{member.department}</p>}
                  </Table.Cell>
                  <Table.Cell>
                    {member.role_code ? (
                      <p className="text-sm text-ink">{nameForRole(member.role_code)}</p>
                    ) : (
                      <Badge variant="warning" size="small" title={t('directory.noRoleHint')}>
                        {t('member.noRole')}
                      </Badge>
                    )}
                    {member.level_code ? (
                      <p className="text-xs text-ink-muted">
                        {levelTitle.get(member.level_code) || member.level_code}
                        {member.level_from === 'legacy' && ` · ${t('directory.legacyLevel')}`}
                      </p>
                    ) : (
                      member.role_code && <p className="text-xs text-warning-fg">{t('directory.roleNoLevel')}</p>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <p className="text-sm text-ink-secondary">
                      {member.manager_external_id ? nameFor(member.manager_external_id) : '—'}
                    </p>
                    {provenance(member, 'manager_external_id', nameFor)}
                  </Table.Cell>
                  <Table.Cell>{loginCell(member)}</Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      <SourceBadge member={member} />
                      {member.has_manual_override && (
                        <Badge variant="info" size="small" title={t('directory.correctedHint')}>
                          {t('directory.corrected')}
                        </Badge>
                      )}
                      {member.is_active === false && <Badge variant="warning" size="small">{t('levels.inactive')}</Badge>}
                    </div>
                  </Table.Cell>
                  {canManage && (
                    <Table.Cell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => setEditing({ member })}
                          aria-label={t('directory.editLabel', { name: member.name })}
                          title={t('common:actions.edit')}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        {member.is_active !== false && (
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => setRemoving(member)}
                            aria-label={member.source === 'manual' ? t('directory.removeLabel', { name: member.name }) : t('directory.deactivateLabel', { name: member.name })}
                            title={member.source === 'manual' ? t('directory.remove') : t('directory.deactivate')}
                          >
                            <Trash2 className="h-4 w-4 text-danger-fg" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  )}
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Card>

      {data && (
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-ink-muted" aria-live="polite">
            {loading ? t('common:status.loading') : filtering ? t('directory.matchCount', { count: total }) : t('people', { count: total })}
          </p>
          <Pagination
            currentPage={page}
            totalPages={data.total_pages || 1}
            totalItems={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {editing && (
        <MemberEditorModal
          member={editing.member}
          levels={levels.filter((l) => l.is_active !== false)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            changed();
          }}
        />
      )}

      <AddPersonModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        onAdded={changed}
      />

      {/* A login for someone already here: prefilled, keyed on their stored id. */}
      <AddPersonModal
        isOpen={Boolean(creatingLoginFor)}
        member={creatingLoginFor}
        onClose={() => setCreatingLoginFor(null)}
        onAdded={changed}
      />

      {importing && (
        <BulkImportModal
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            changed();
          }}
        />
      )}

      <ConfirmationModal
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={removing?.source === 'manual' ? t('directory.removeTitle') : t('directory.deactivateTitle')}
        message={
          removing?.source === 'manual'
            ? t('directory.removeMessage', { name: removing.name })
            : removing
              ? t('directory.deactivateMessage', { name: removing.name })
              : ''
        }
        confirmText={removing?.source === 'manual' ? t('directory.remove') : t('directory.deactivate')}
        destructive
        isLoading={busy}
      />
    </div>
  );
};

export default DirectoryPanel;
