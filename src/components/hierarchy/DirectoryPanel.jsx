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
import { Link } from 'react-router-dom';
import { Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import { toast } from 'react-toastify';
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

const SourceBadge = ({ member }) =>
  member.source === 'manual' ? (
    <Badge variant="secondary" size="small" title="Added by hand. Every sync leaves this entry alone.">
      Added by hand
    </Badge>
  ) : (
    <Badge
      size="small"
      title="Your HR system owns this entry. If a later HR pull no longer includes this person, they are deactivated automatically. (Someone added by hand who later appears in HR switches to this badge and keeps their corrections.)"
    >
      From HR
    </Badge>
  );

const DirectoryPanel = ({ levels, canManage, onChanged, reloadKey }) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState('');
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
          <Badge variant="warning" size="small">Login deactivated</Badge>
          {canReactivate && member.is_active !== false && accounts.some((a) => a.is_active === false) && (
            <Button variant="outline" size="small" onClick={() => reactivate(member)} isLoading={reactivating === member.external_id}>
              Reactivate
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
          title={count > 1 ? accounts.map((a) => `${a.username} (${nameForRole(a.role)}${a.is_active === false ? ', deactivated' : ''})`).join('\n') : undefined}
        >
          {count > 1 ? `${count} logins` : 'Has a login'}
        </Badge>
      );
      return usersLink ? (
        <Link to={usersLink} title="Open in User Management" className="hover:opacity-80">
          {badge}
        </Link>
      ) : (
        badge
      );
    }
    if (canCreateUsers && member.is_active !== false) {
      return (
        <Button variant="outline" size="small" onClick={() => setCreatingLoginFor(member)}>
          Create login
        </Button>
      );
    }
    return <span className="text-sm text-ink-muted">No login</span>;
  };
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const levelTitle = useMemo(() => new Map(levels.map((l) => [l.code, l.title])), [levels]);

  const confirmRemove = async () => {
    setBusy(true);
    try {
      await orgHierarchyAPI.deleteMember(removing.id);
      toast.success(
        removing.source === 'manual' ? `${removing.name} removed.` : `${removing.name} deactivated.`,
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
    return <p className="text-[11px] text-ink-subtle">HR says: {hr ? format(hr) : '(none)'}</p>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, title…"
              aria-label="Search the directory"
              className="w-full rounded-lg border border-line bg-subtle py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-accent focus:ring-2 focus:ring-accent-ring"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            aria-label="Filter by level"
            className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink sm:w-52"
          >
            <option value="">All levels</option>
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
            Include inactive
          </label>
        </div>
        {/* Adding people — by hand or from a spreadsheet — is admin only (user:create). */}
        {canManage && canCreateUsers && (
          <div className="flex gap-2">
            <Button variant="outline" startIcon={Upload} onClick={() => setImporting(true)}>
              Paste from spreadsheet
            </Button>
            <Button startIcon={Plus} onClick={() => setAdding(true)}>
              Add person
            </Button>
          </div>
        )}
      </div>

      <Card padding="none">
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              <Table.Head>Person</Table.Head>
              <Table.Head>Job title</Table.Head>
              <Table.Head>Role · level</Table.Head>
              <Table.Head>Manager</Table.Head>
              <Table.Head>Login</Table.Head>
              <Table.Head>Source</Table.Head>
              {canManage && <Table.Head className="text-right">Actions</Table.Head>}
            </Table.Row>
          </Table.Header>
          <Table.Body className={loading && data ? 'opacity-60 transition-opacity' : ''}>
            {loadError ? (
              <Table.Empty
                message="Couldn't load the directory"
                description={loadError}
                icon={Users}
                action={
                  <Button variant="outline" size="small" onClick={() => setLocalTick((t) => t + 1)}>
                    Try again
                  </Button>
                }
              />
            ) : !data ? (
              <Table.Loading colSpan={canManage ? 7 : 6} rows={8} />
            ) : members.length === 0 ? (
              <Table.Empty
                message={filtering ? 'No one matches' : 'No one in the directory yet'}
                description={
                  filtering
                    ? 'Try a different search or level.'
                    : 'Add people by hand, paste a spreadsheet, or connect your HR system.'
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
                        title="Show in the org chart"
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
                    <p className="text-sm text-ink-secondary">{member.designation || '—'}</p>
                    {member.department && <p className="text-xs text-ink-subtle">{member.department}</p>}
                  </Table.Cell>
                  <Table.Cell>
                    {member.role_code ? (
                      <p className="text-sm text-ink">{nameForRole(member.role_code)}</p>
                    ) : (
                      <Badge variant="warning" size="small" title="A person is placed by their role">
                        No role
                      </Badge>
                    )}
                    {member.level_code ? (
                      <p className="text-xs text-ink-muted">
                        {levelTitle.get(member.level_code) || member.level_code}
                        {member.level_from === 'legacy' && ' · old level, needs a role'}
                      </p>
                    ) : (
                      member.role_code && <p className="text-xs text-warning-fg">Role has no level</p>
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
                        <Badge variant="info" size="small" title="A person corrected the manager HR sent. The correction survives syncs.">
                          Corrected
                        </Badge>
                      )}
                      {member.is_active === false && <Badge variant="warning" size="small">Inactive</Badge>}
                    </div>
                  </Table.Cell>
                  {canManage && (
                    <Table.Cell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => setEditing({ member })}
                          aria-label={`Edit ${member.name}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {member.is_active !== false && (
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => setRemoving(member)}
                            aria-label={`${member.source === 'manual' ? 'Remove' : 'Deactivate'} ${member.name}`}
                            title={member.source === 'manual' ? 'Remove' : 'Deactivate'}
                          >
                            <Trash2 className="h-4 w-4 text-danger-fg" />
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
            {loading ? 'Loading…' : `${total} ${total === 1 ? 'person' : 'people'}${filtering ? ' match' : ''}`}
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
        title={removing?.source === 'manual' ? 'Remove this person?' : 'Deactivate this person?'}
        message={
          removing?.source === 'manual'
            ? `${removing.name} was added by hand and will be removed from the directory permanently.`
            : removing
              ? `${removing.name} comes from your HR system, so they are deactivated rather than deleted — a real delete would be undone by the next sync. To remove them for good, remove them in HR.`
              : ''
        }
        confirmText={removing?.source === 'manual' ? 'Remove' : 'Deactivate'}
        destructive
        isLoading={busy}
      />
    </div>
  );
};

export default DirectoryPanel;
