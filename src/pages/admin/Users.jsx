import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { intlLocale, isRtl } from '../../utils/locale';
import {
  UserPlus,
  UserX,
  Shield,
  Eye,
  EyeOff,
  PenBoxIcon,
  X,
  Upload,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import DirectoryLinkModal from '../../components/users/DirectoryLinkModal';
import ImportUsersModal from '../../components/users/ImportUsersModal';
import AddPersonModal from '../../components/users/AddPersonModal';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useMemberNames } from '../../hooks/useMemberNames';
import Card from '../../components/ui/Card';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge, { RoleBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Modal, { ConfirmationModal } from '../../components/ui/Modal';
import { Link, useSearchParams } from 'react-router-dom';
import { usersAPI } from '../../api';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import { parseServerDate } from '../../utils/formatters';
import useSEO from '../../hooks/useSEO';
import { useCan } from '../../hooks/useCan';
import { ACCESS, PERM } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { DEFAULT_PAGE_SIZE, normalizeListResponse } from '../../utils/pagination';
import TableSortControl from '../../components/ui/TableSortControl';
import { useTableSort, byDate, byText } from '../../hooks/useTableSort';
import { useOrgRoles, REPORTER_ROLE } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import ChangeRoleModal from '../../components/roles/ChangeRoleModal';
import RoleSelect from '../../components/roles/RoleSelect';
import { toast } from 'react-toastify';
import UserAvatar from '../../components/ui/UserAvatar';
import Alert from '../../components/ui/Alert';
import {
  AUTH_PROVIDERS,
  AUTH_PROVIDER_OPTIONS,
  authProviderLabel as englishProviderLabel,
  isPasswordAccount,
} from '../../utils/authProviders';

// Google and Microsoft are names; "Password" is a word to translate.
const authProviderLabel = (provider) =>
  !provider || provider === AUTH_PROVIDERS.PASSWORD
    ? i18n.t('provider.password', { ns: 'people' })
    : englishProviderLabel(provider);

const USERS_TOUR_KEY = 'xposer_users_tour_seen';

// Column order here is the column order in the table. Actions is not sortable,
// so it keeps a plain header. Labels are translation keys (users.columns.*),
// read when the page renders.
const SORT_COLUMNS = {
  full_name: { defaultOrder: 'asc', value: byText('full_name') },
  username: { defaultOrder: 'asc', value: byText('username') },
  // Roles have no rank any more; the page swaps in their display names.
  role: { defaultOrder: 'asc', value: byText('role') },
  auth_provider: { defaultOrder: 'asc', value: byText('auth_provider') },
  created_at: { defaultOrder: 'desc', value: byDate('created_at') },
  is_active: { defaultOrder: 'desc', value: (user) => (user.is_active ? 1 : 0) },
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = parseServerDate(dateString);
  if (!date) return '-';
  return date.toLocaleDateString(intlLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Users = () => {
  const { t } = useTranslation('people');
  useSEO({
    title: t('users.seoTitle'),
    description: t('users.seoDescription'),
    noIndex: true,
  });
  // Every staff user can open this page; the list is filtered server-side to
  // their own account plus the roles their role may see (viewable_roles).
  // Changing anyone is admin-only — each row's `access` block says which
  // actions apply, so nothing here is re-derived from role names.
  const can = useCan();
  const canCreateUsers = can(PERM.userCreate);
  const canUpdateUsers = can(PERM.userUpdate);
  // Changing someone's role is a separate grant on top of editing them.
  const canChangeRoles = can(PERM.userUpdate, PERM.userManageRoles);
  const currentUserId = useAuthStore((state) => state.user?.id);
  /** Admin actions on someone else's row; never on your own (use My account). */
  const rowCanManage = (user) =>
    user.access ? Boolean(user.access.can_manage) : canUpdateUsers && user.id !== currentUserId;
  const isSelf = (user) => user.id === currentUserId;
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  // Role names: an admin's full list, otherwise only the roles whose users
  // this person can see (GET /users/visible-roles). Each user also carries
  // `role_name`, which is preferred for their own label.
  const { allRoles: visibleRoles, nameFor, byCode } = useOrgRoles();
  const roleLabel = (user) => user.role_name || nameFor(user.role);
  const [roleChangeUser, setRoleChangeUser] = useState(null);
  // After a role change or deactivation: open cases the person can no longer work.
  const [stranded, setStranded] = useState(null);

  // The directory: who each account is linked to, and at what level. Level
  // decides which reports someone sees; role decides what they can do.
  const canReadHierarchy = can(PERM.hierarchyRead);
  const [levels, setLevels] = useState([]);
  const [linkUser, setLinkUser] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const loadDirectory = useCallback(() => {
    if (!canReadHierarchy) return;
    orgHierarchyAPI
      .listLevels()
      .then((levelList) => setLevels(Array.isArray(levelList) ? levelList : []))
      .catch(() => setLevels([]));
  }, [canReadHierarchy]);
  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);
  const levelTitle = (code) => levels.find((l) => l.code === code)?.title || code;
  const [users, setUsers] = useState([]);
  // Only the entries this page of users links to, not the whole directory.
  const { memberOf, refresh: refreshLinks, lookup: linkLookup } = useMemberNames(
    users.map((u) => u.hierarchy_member_id),
    { enabled: canReadHierarchy },
  );
  const memberFor = (user) => memberOf(user.hierarchy_member_id);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordFormData, setResetPasswordFormData] = useState({
    new_password: '',
    auth_provider: AUTH_PROVIDERS.PASSWORD,
  });
  const [resetPasswordFormErrors, setResetPasswordFormErrors] = useState({});
  const [resetPasswordFormLoading, setResetPasswordFormLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, type: '', user: null });
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();

  // Dashboard links arrive as ?status=active, so the query string drives the
  // status filter and the filtered view survives a refresh.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || 'all';
  // ?role=code — how the roles screen links to "who still has this role".
  const roleFilter = searchParams.get('role') || '';
  // ?level=code and ?unlinked=true — how the org chart drills into people.
  const levelFilter = searchParams.get('level') || '';
  const unlinkedFilter = searchParams.get('unlinked') === 'true';
  const clearFilter = useCallback((key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const clearRoleFilter = useCallback(() => clearFilter('role'), [clearFilter]);
  const setRoleFilter = useCallback((value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set('role', value);
      else next.delete('role');
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const setStatusFilter = useCallback((value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (!value || value === 'all') next.delete('status');
      else next.set('status', value);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // ?search=… (e.g. from a directory entry's "Has a login") opens the list on
  // that person.
  useEffect(() => {
    const initial = searchParams.get('search');
    if (initial) {
      setSearchTerm(initial);
      setDebouncedSearch(initial);
    }
    // Only on arrival; typing takes over from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Debounce the search term so we don't fire a request on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 400);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await usersAPI.getAllUsers({
        page: currentPage,
        page_size: DEFAULT_PAGE_SIZE,
        search: debouncedSearch || undefined,
        is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
        role: roleFilter || undefined,
        level_code: levelFilter || undefined,
        unlinked: unlinkedFilter || undefined,
      });
      const { items, total, totalPages: pages } = normalizeListResponse(response);
      setUsers(items);
      setTotalPages(pages);
      setTotalUsers(total);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, statusFilter, roleFilter, levelFilter, unlinkedFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // A narrower filter rarely has as many pages as the one it replaced.
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, roleFilter, levelFilter, unlinkedFilter]);

  // The endpoint takes `search` and paginates the result, so filtering again
  // here would only hide rows it matched on fields this table doesn't show.
  // Status is the exception: it is sent as `is_active`, but the rows are
  // checked here too so an older backend that ignores the parameter still
  // shows a list that matches the selected tab.
  const visibleUsers = useMemo(() => {
    if (statusFilter === 'all') return users;
    const wantActive = statusFilter === 'active';
    return users.filter((item) => Boolean(item.is_active) === wantActive);
  }, [users, statusFilter]);

  // Ordering the current page: the endpoint paginates server-side, so this
  // sorts the rows on screen rather than the whole result set.
  const sortColumns = useMemo(() => {
    const columns = Object.fromEntries(
      Object.entries(SORT_COLUMNS).map(([field, column]) => [field, { ...column, label: t(`users.columns.${field}`) }]),
    );
    columns.role = { ...columns.role, value: (user) => roleLabel(user).toLowerCase() };
    return columns;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameFor, t]);
  const sort = useTableSort(visibleUsers, sortColumns, { defaultSortBy: 'created_at' });
  const { sortedRows: filteredUsers, getHeaderProps } = sort;
  // True only when moving an existing SSO account back onto a password.
  const isSwitchingToPassword =
    resetPasswordFormData.auth_provider === AUTH_PROVIDERS.PASSWORD
    && !isPasswordAccount(selectedUser);

  // A role can be deleted while its only holders are inactive, so someone
  // reactivated onto it would come back with no permissions at all.
  const roleMissing = (user) => byCode.size > 0 && user.role !== REPORTER_ROLE && !byCode.has(user.role);

  const handleStatusToggle = async (user) => {
    if (!user.is_active && roleMissing(user)) {
      setConfirmModal({ open: false, type: '', user: null });
      toast.error(t('users.roleGone', { role: roleLabel(user), name: user.full_name || user.username }));
      if (canChangeRoles) setRoleChangeUser(user);
      return;
    }
    try {
      if (user.is_active) {
        const result = await usersAPI.deleteUser(user.id);
        if (result?.warnings?.length) setStranded({ user, warnings: result.warnings });
      } else {
        await usersAPI.activateUser(user.id);
      }
      fetchUsers();
    } catch (error) {
      console.error('Error toggling status:', error);
    } finally {
      setConfirmModal({ open: false, type: '', user: null });
    }
  };

  const handleResetPassword = (user) => {
    setSelectedUser(user);
    setResetPasswordFormData({
      new_password: '',
      auth_provider: user.auth_provider || AUTH_PROVIDERS.PASSWORD,
    });
    setResetPasswordFormErrors({});
    setIsResetPasswordModalOpen(true);
  };

  const validateResetPasswordForm = () => {
    const errors = {};
    const nextProvider = resetPasswordFormData.auth_provider;
    const switchingToSSO = nextProvider !== AUTH_PROVIDERS.PASSWORD;

    // Moving an account to Google/Microsoft drops its password entirely, so
    // there is nothing to validate.
    if (switchingToSSO) return errors;

    // Staying on (or switching back to) password sign-in always needs one:
    // the backend rejects a switch to 'password' without a new password.
    if (!resetPasswordFormData.new_password.trim()) {
      errors.new_password = t('users.reset.required');
    } else if (resetPasswordFormData.new_password.length < 8) {
      errors.new_password = t('users.reset.tooShort');
    }
    return errors;
  };

  const handleResetPasswordSubmit = async () => {
    const errors = validateResetPasswordForm();
    if (Object.keys(errors).length > 0) {
      setResetPasswordFormErrors(errors);
      return;
    }

    setResetPasswordFormLoading(true);
    const currentProvider = selectedUser?.auth_provider || AUTH_PROVIDERS.PASSWORD;
    const nextProvider = resetPasswordFormData.auth_provider;

    try {
      if (nextProvider !== currentProvider) {
        // A switch back to password sign-in must carry the new password in
        // the same request.
        await usersAPI.updateAuthProvider(selectedUser.id, {
          auth_provider: nextProvider,
          ...(nextProvider === AUTH_PROVIDERS.PASSWORD
            ? { password: resetPasswordFormData.new_password }
            : {}),
        });
      } else {
        await usersAPI.updatePasswordByAdmin(selectedUser.id, {
          new_password: resetPasswordFormData.new_password,
        });
      }
      setIsResetPasswordModalOpen(false);
      setResetPasswordFormData({ new_password: '', auth_provider: AUTH_PROVIDERS.PASSWORD });
      setResetPasswordFormErrors({});
      fetchUsers();
    } catch (error) {
      console.error('Error updating sign-in method:', error);
    } finally {
      setResetPasswordFormLoading(false);
    }
  };

  // Where an account sits in the directory, under its role: the entry's name
  // and level, or a flag when it's unlinked or its entry is gone. Nothing for
  // reporters, who aren't placed.
  const renderPlacement = (user) => {
    if (user.role === REPORTER_ROLE) return null;
    const member = memberFor(user);
    const seesTeam = byCode.get(user.role)?.permissions?.includes(PERM.reportReadSubordinates);
    // An admin may also link their own account.
    const open = canUpdateUsers && (rowCanManage(user) || isSelf(user)) ? () => setLinkUser(user) : undefined;
    // Linked, but the entry is still being looked up: no flag yet.
    if (!member && user.hierarchy_member_id && linkLookup.pending) {
      return <span className="block h-4 w-24 animate-pulse rounded bg-active" />;
    }
    return member ? (
      <button
        type="button"
        onClick={open}
        disabled={!open}
        className="min-w-0 text-start disabled:cursor-default"
        title={open ? t('users.placement.change') : undefined}
      >
        <span className="block truncate text-sm font-medium text-ink" dir="auto">{member.name}</span>
        <span className="block truncate text-xs text-ink-muted">
          {member.level_code ? levelTitle(member.level_code) : t('users.placement.noLevel')}
        </span>
      </button>
    ) : (
      <button
        type="button"
        onClick={open}
        disabled={!open}
        title={[
          // Unlinked: no link at all. Entry missing: linked to an
          // employee ID that is no longer in the directory —
          // usually a person removed after the account was linked.
          user.hierarchy_member_id
            ? t('users.placement.missingTitle', { id: user.hierarchy_member_id })
            : t('users.placement.unlinkedTitle'),
          seesTeam && t('users.placement.seesOwn'),
          open && t('users.placement.clickToFix'),
        ]
          .filter(Boolean)
          .join(' ')}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-fg hover:bg-warning-line disabled:cursor-default"
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {user.hierarchy_member_id ? t('users.placement.missing') : t('users.placement.unlinked')}
      </button>
    );
  };

  // A row's actions: your own account, or the admin controls for another's.
  const renderActions = (user) => (
    <>
      {isSelf(user) && (
        <Link
          to={staffPath(orgSlug, 'account')}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-link hover:bg-accent-soft"
          title={canUpdateUsers ? t('users.self.editTitle') : t('users.self.passwordTitle')}
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {canUpdateUsers ? t('users.self.myAccount') : t('users.self.changePassword')}
        </Link>
      )}
      {rowCanManage(user) && (
        <div className="flex justify-end gap-2">
          {canChangeRoles && (
            <Button
              variant="ghost"
              size="small"
              title={t('users.actions.changeRole')}
              aria-label={t('changeRole.title', { name: user.full_name || user.username })}
              onClick={() => setRoleChangeUser(user)}
            >
              <Shield className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="small"
            title={t('users.actions.manageSignIn')}
            aria-label={t('users.actions.manageSignInFor', { name: user.full_name || user.username })}
            onClick={() => handleResetPassword(user)}
          >
            <PenBoxIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="small"
            title={user.is_active ? t('users.actions.deactivate') : t('users.actions.activate')}
            aria-label={t(user.is_active ? 'users.actions.deactivateFor' : 'users.actions.activateFor', { name: user.full_name || user.username })}
            onClick={() => setConfirmModal({
              open: true,
              type: user.is_active ? 'deactivate' : 'activate',
              user
            })}
          >
            {user.is_active
              ? <UserX className="h-4 w-4 text-danger-fg" aria-hidden="true" />
              : <UserPlus className="h-4 w-4 text-success-fg" aria-hidden="true" />
            }
          </Button>
        </div>
      )}
    </>
  );

  // A user on a phone: who they are, their role and sign-in, and what you can
  // do. Username, created date and the directory entry are in the desktop
  // table; a directory problem or a pending first sign-in still shows here.
  const renderSummary = (user) => {
    const member = canReadHierarchy && user.role !== REPORTER_ROLE ? memberFor(user) : null;
    // Only a known problem: not while a linked entry is still being looked up.
    const placementProblem =
      canReadHierarchy && user.role !== REPORTER_ROLE && !member && !(user.hierarchy_member_id && linkLookup.pending);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} size="small" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink" dir="auto">{user.full_name || user.username}</p>
            <p className="truncate text-xs text-ink-muted" dir="ltr">{user.email}</p>
          </div>
          <Badge variant={user.is_active ? 'success' : 'danger'} dot size="small">
            {user.is_active ? t('users.status.active') : t('users.status.inactive')}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2 ps-12">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <RoleBadge role={user.role} label={roleLabel(user)} />
            <span>{authProviderLabel(user.auth_provider)}</span>
            {placementProblem && renderPlacement(user)}
            {user.must_change_password && <span className="font-medium text-warning-fg">{t('users.noPasswordYet')}</span>}
          </div>
          <div className="-my-1 shrink-0 [&_.gap-2]:gap-0">{renderActions(user)}</div>
        </div>
      </div>
    );
  };

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-user-management"]',
        title: t('users.tour.sidebarTitle'),
        content: t('users.tour.sidebarBody'),
        placement: isRtl() ? 'left' : 'right',
        skipBeacon: true,
      });
    }

    steps.push(
      {
        target: '[data-tour="users-search"]',
        title: t('users.tour.searchTitle'),
        content: t('users.tour.searchBody'),
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="users-add"]',
        title: t('users.tour.addTitle'),
        content: t('users.tour.addBody'),
        placement: 'bottom',
      },
      {
        target: '[data-tour="users-table"]',
        title: t('users.tour.tableTitle'),
        content: t('users.tour.tableBody'),
        placement: 'top',
      }
    );

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: t('users.tour.accountTitle'),
      content: t('users.tour.accountBody'),
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop, t]);

  return (
    <div className="space-y-6">
      <DashboardTour ref={tourRef} storageKey={USERS_TOUR_KEY} steps={tourSteps} />

      {stranded && (
        <Alert
          variant="warning"
          title={t('users.stranded.title', { name: stranded.user.full_name || stranded.user.username })}
          dismissible
          onDismiss={() => setStranded(null)}
        >
          <ul className="list-disc space-y-1 ps-4">
            {stranded.warnings.map((warning, i) => (
              <li key={i}>{warning.message}</li>
            ))}
          </ul>
          {can(ACCESS.caseReports) && (
            <Link
              to={`${staffPath(orgSlug, 'reports')}?${new URLSearchParams({
                assigned_to: stranded.user.id,
                assignee: stranded.user.full_name || stranded.user.username || '',
              })}`}
              className="mt-2 inline-block font-semibold underline underline-offset-2"
            >
              {t('users.stranded.seeCases')}
            </Link>
          )}
        </Alert>
      )}

      {!canUpdateUsers && (
        <Alert variant="info">
          {t('users.readOnlyNotice')}
        </Alert>
      )}

      {/* Header Actions. Below lg the search takes its own row, the filters
          wrap, and on phones the two actions share a full-width row. */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 lg:gap-4">
        <div className="relative w-full lg:w-96" data-tour="users-search">
          <Input
            placeholder={t('users.searchPlaceholder')}
            aria-label={t('users.searchLabel')}
            value={searchTerm}
            onChange={handleSearchChange}
          // startAdornment={<Search className="h-4 w-4 text-ink-subtle" />}
          />
        </div>
        <div className="flex flex-wrap items-center lg:justify-end gap-2 sm:gap-3 min-w-0">
          <div className="inline-flex shrink-0 rounded-lg border border-line p-0.5" role="group" aria-label={t('users.statusFilter')}>
            {[
              { id: 'all', label: t('users.status.all') },
              { id: 'active', label: t('users.status.active') },
              { id: 'inactive', label: t('users.status.inactive') },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={statusFilter === option.id}
                onClick={() => setStatusFilter(option.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${statusFilter === option.id
                  ? 'bg-accent-soft text-accent-fg'
                  : 'text-ink-muted hover:text-ink hover:bg-hover'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* Only the roles whose users this person can see. */}
          {visibleRoles.length > 1 && (
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label={t('users.roleFilter')}
              className="h-9 min-w-0 max-w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink"
            >
              <option value="">{t('users.allRoles')}</option>
              {visibleRoles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.code === REPORTER_ROLE ? t('addPerson.reporter') : role.name}
                </option>
              ))}
              {roleFilter && !visibleRoles.some((r) => r.code === roleFilter) && (
                <option value={roleFilter}>{nameFor(roleFilter)}</option>
              )}
            </select>
          )}
          <TableSortControl {...sort} id="users" className="shrink-0" />
          {canCreateUsers && (
            <div className="flex w-full gap-2 sm:w-auto sm:gap-3">
              <Button variant="outline" startIcon={Upload} onClick={() => setImportOpen(true)} className="flex-1 sm:flex-none">
                {t('users.import')}
              </Button>
              <Button
                variant="secondary"
                startIcon={UserPlus}
                onClick={() => setIsAddModalOpen(true)}
                data-tour="users-add"
                className="flex-1 sm:flex-none"
              >
                {t('addPerson.title')}
              </Button>
            </div>
          )}
        </div>
      </div>

      {(roleFilter || levelFilter || unlinkedFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-secondary">
          {t('users.filters.showing')}
          {[
            roleFilter && { key: 'role', label: t('users.filters.role', { name: nameFor(roleFilter) }) },
            levelFilter && { key: 'level', label: t('users.filters.level', { name: levelTitle(levelFilter) }) },
            unlinkedFilter && { key: 'unlinked', label: t('users.filters.unlinked') },
          ]
            .filter(Boolean)
            .map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearFilter(chip.key)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-accent bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-fg hover:bg-hover"
                aria-label={t('users.filters.clear', { label: chip.label })}
              >
                {chip.label}
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
          {unlinkedFilter && (
            <span className="text-xs text-ink-muted">{t('users.filters.unlinkedNote')}</span>
          )}
        </div>
      )}

      {/* Users Table */}
      <Card padding="none" data-tour="users-table">
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              {Object.entries(sortColumns).map(([field, column]) => (
                <Table.Head key={field} {...getHeaderProps(field)}>
                  {column.label}
                </Table.Head>
              ))}
              <Table.Head className="text-end">{t('users.columns.actions')}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading
                rows={DEFAULT_PAGE_SIZE}
                cells={[
                  <div key="u" className="flex items-center gap-3">
                    <Skeleton.Circle />
                    <div className="space-y-0.5">
                      <Skeleton.Text className="w-28" />
                      <Skeleton.Text size="xs" className="w-36" />
                    </div>
                  </div>,
                  <Skeleton.Text key="n" className="w-36" />,
                  <div key="r" className="space-y-1.5">
                    <Skeleton.Badge className="w-14" />
                    {canReadHierarchy && <Skeleton.Badge className="w-20" />}
                  </div>,
                  <Skeleton.Badge key="s" tall className="w-18" />,
                  <div key="c" className="space-y-0.5">
                    <Skeleton.Text size="xs" className="w-20" />
                    <Skeleton.Text size="xs" className="w-14" />
                  </div>,
                  <Skeleton.Badge key="a" tall className="w-16" />,
                  <div key="x" className="flex justify-end gap-2">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-8 w-8 rounded-lg" />
                    ))}
                  </div>,
                ]}
              />
            ) : filteredUsers.length === 0 ? (
              <Table.Empty
                message={debouncedSearch ? t('users.empty.noMatch') : t('users.empty.none')}
                description={debouncedSearch ? t('users.empty.noMatchHelp') : t('users.empty.noneHelp')}
                icon={Shield}
              />
            ) : (
              filteredUsers.map((user) => (
                <Table.Row key={user.id} mobile={renderSummary(user)}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} size="medium" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate" dir="auto">{user.full_name}</p>
                        <p className="text-xs text-ink-muted break-all" dir="ltr">{user.email}</p>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm font-medium text-ink-muted font-mono" dir="ltr">{user.username}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <RoleBadge role={user.role} label={roleLabel(user)} />
                    {/* Where they sit in the hierarchy, under what they can do.
                        Their level comes from their role, via their directory entry. */}
                    {canReadHierarchy && (
                      <div className="mt-1.5">
                        {renderPlacement(user)}
                      </div>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={isPasswordAccount(user) ? 'default' : 'info'}>
                      {authProviderLabel(user.auth_provider)}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-ink-muted">{formatDate(user.created_at)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={user.is_active ? 'success' : 'danger'} dot>
                      {user.is_active ? t('users.status.active') : t('users.status.inactive')}
                    </Badge>
                    {/* Still on the default password: they've never signed in
                        properly, which is worth seeing after a bulk import. */}
                    {user.must_change_password && (
                      <span className="mt-1 block text-[11px] font-medium text-warning-fg" title={t('users.noPasswordYetTitle')}>
                        {t('users.noPasswordYet')}
                      </span>
                    )}
                  </Table.Cell>

                  <Table.Cell className="text-end">
                    {renderActions(user)}
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>

        {totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-line">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalUsers}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, type: '', user: null })}
        onConfirm={() => handleStatusToggle(confirmModal.user)}
        title={confirmModal.type === 'deactivate' ? t('users.confirm.deactivateTitle') : t('users.confirm.activateTitle')}
        message={
          confirmModal.type === 'activate' && confirmModal.user && roleMissing(confirmModal.user)
            ? t('users.confirm.roleGone', { name: confirmModal.user.full_name || confirmModal.user.username, role: roleLabel(confirmModal.user) })
            : t(confirmModal.type === 'deactivate' ? 'users.confirm.deactivateBody' : 'users.confirm.activateBody', { name: confirmModal.user?.full_name || confirmModal.user?.username })
        }
        variant={confirmModal.type === 'deactivate' ? 'danger' : 'success'}
        confirmText={confirmModal.type === 'deactivate' ? t('users.actions.deactivate') : t('users.actions.activate')}
      />

      {linkUser && (
        <DirectoryLinkModal
          user={linkUser}
          levels={levels}
          onClose={() => setLinkUser(null)}
          onSaved={() => {
            setLinkUser(null);
            fetchUsers();
            refreshLinks();
          }}
        />
      )}

      {importOpen && (
        <ImportUsersModal
          onClose={() => setImportOpen(false)}
          onImported={() => {
            fetchUsers();
            refreshLinks();
          }}
        />
      )}

      {roleChangeUser && (
        <ChangeRoleModal
          user={roleChangeUser}
          isSelf={roleChangeUser.id === currentUserId}
          onClose={() => setRoleChangeUser(null)}
          onChanged={(_role, warnings) => {
            if (warnings?.length) setStranded({ user: roleChangeUser, warnings });
            setRoleChangeUser(null);
            fetchUsers();
          }}
        />
      )}

      <AddPersonModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdded={() => {
          fetchUsers();
          refreshLinks();
        }}
      />

      {/* Manage Sign-in Modal — password reset and provider switching share a
          form because they are the same decision from an admin's point of view. */}
      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title={t('users.reset.title')}
        className="bg-surface absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            <Trans
              t={t}
              i18nKey="users.reset.current"
              values={{ name: selectedUser?.full_name, provider: authProviderLabel(selectedUser?.auth_provider) }}
              components={{ b: <span className="font-medium text-ink" /> }}
            />
          </p>

          <div className="flex flex-col">
            <label htmlFor="users-field-1" className="text-sm font-medium text-ink-secondary mb-1">
              {t('addPerson.signInMethod')}
            </label>
            <select id="users-field-1"
              name="auth_provider"
              value={resetPasswordFormData.auth_provider}
              onChange={(e) => setResetPasswordFormData((prev) => ({
                ...prev,
                auth_provider: e.target.value,
              }))}
              className="border border-line-strong rounded-lg shadow-sm focus:ring-accent-ring focus:border-line-accent p-2 text-sm"
            >
              {AUTH_PROVIDER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{value === AUTH_PROVIDERS.PASSWORD ? t('provider.password') : label}</option>
              ))}
            </select>
          </div>

          {resetPasswordFormData.auth_provider === AUTH_PROVIDERS.PASSWORD ? (
            <div className="relative">
              <Input
                label={isSwitchingToPassword ? t('users.reset.newPassword') : t('users.reset.newPasswordReset')}
                type={showResetPassword ? 'text' : 'password'}
                name="new_password"
                value={resetPasswordFormData.new_password}
                onChange={(e) => setResetPasswordFormData((prev) => ({ ...prev, new_password: e.target.value }))}
                error={resetPasswordFormErrors.new_password}
                helperText={isSwitchingToPassword
                  ? t('users.reset.requiredForSwitch')
                  : undefined}
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                aria-label={showResetPassword ? t('setPassword.hide', { field: t('users.reset.newPassword') }) : t('setPassword.show', { field: t('users.reset.newPassword') })}
                className="absolute end-3 top-7.25 text-ink-muted hover:text-ink-secondary focus:outline-none z-10"
              >
                {showResetPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          ) : (
            <Alert variant="warning">
              {t('users.reset.ssoWarning', { provider: authProviderLabel(resetPasswordFormData.auth_provider) })}
            </Alert>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsResetPasswordModalOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="secondary" onClick={handleResetPasswordSubmit} disabled={resetPasswordFormLoading}>
              {resetPasswordFormLoading ? t('common:status.saving') : t('roleEditor.saveChanges')}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default Users;
