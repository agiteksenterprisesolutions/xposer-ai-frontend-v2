import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  UserPlus,
  UserX,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  PenBoxIcon,
  X,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import DirectoryLinkModal from '../../components/users/DirectoryLinkModal';
import ImportUsersModal from '../../components/users/ImportUsersModal';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import Card from '../../components/ui/Card';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge, { RoleBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import Modal, { ConfirmationModal } from '../../components/ui/Modal';
import { useSearchParams } from 'react-router-dom';
import { usersAPI } from '../../api';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import { parseServerDate } from '../../utils/formatters';
import useSEO from '../../hooks/useSEO';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { DEFAULT_PAGE_SIZE, normalizeListResponse } from '../../utils/pagination';
import TableSortControl from '../../components/ui/TableSortControl';
import { useTableSort, byDate, byText } from '../../hooks/useTableSort';
import { useOrgRoles, REPORTER_ROLE } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import ChangeRoleModal from '../../components/roles/ChangeRoleModal';
import RoleSelect from '../../components/roles/RoleSelect';
import { copyToClipboard } from '../../utils/clipboard';
import { toast } from 'react-toastify';
import UserAvatar from '../../components/ui/UserAvatar';
import Alert from '../../components/ui/Alert';
import {
  AUTH_PROVIDERS,
  AUTH_PROVIDER_OPTIONS,
  authProviderLabel,
  isPasswordAccount,
} from '../../utils/authProviders';

const USERS_TOUR_KEY = 'xposer_users_tour_seen';

// Column order here is the column order in the table. Actions is not sortable,
// so it keeps a plain header.
const SORT_COLUMNS = {
  full_name: { label: 'User', defaultOrder: 'asc', value: byText('full_name') },
  username: { label: 'Username', defaultOrder: 'asc', value: byText('username') },
  // Roles have no rank any more; the page swaps in their display names.
  role: { label: 'Role', defaultOrder: 'asc', value: byText('role') },
  auth_provider: { label: 'Sign-in', defaultOrder: 'asc', value: byText('auth_provider') },
  created_at: { label: 'Created On', defaultOrder: 'desc', value: byDate('created_at') },
  is_active: { label: 'Status', defaultOrder: 'desc', value: (user) => (user.is_active ? 1 : 0) },
};

const INITIAL_FORM = {
  full_name: '',
  email: '',
  username: '',
  role: REPORTER_ROLE,
  auth_provider: AUTH_PROVIDERS.PASSWORD,
  password: '',
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = parseServerDate(dateString);
  if (!date) return '-';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Users = () => {
  useSEO({
    title: 'User Management',
    description: 'Create, edit, and deactivate accounts across your organization.',
    noIndex: true,
  });
  // user:read_all opens this page; each change below has its own permission.
  const can = useCan();
  const canCreateUsers = can(PERM.userCreate);
  const canUpdateUsers = can(PERM.userUpdate);
  // Changing someone's role is a separate grant on top of editing them.
  const canChangeRoles = can(PERM.userUpdate, PERM.userManageRoles);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { nameFor, byCode } = useOrgRoles();
  const [roleChangeUser, setRoleChangeUser] = useState(null);

  // The directory: who each account is linked to, and at what level. Level
  // decides which reports someone sees; role decides what they can do.
  const canReadHierarchy = can(PERM.hierarchyRead);
  const canManageHierarchy = can(PERM.hierarchyManage);
  const [members, setMembers] = useState([]);
  const [levels, setLevels] = useState([]);
  const [linkUser, setLinkUser] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const loadDirectory = useCallback(() => {
    if (!canReadHierarchy) return;
    Promise.all([orgHierarchyAPI.listMembers({ activeOnly: false }), orgHierarchyAPI.listLevels()])
      .then(([memberList, levelList]) => {
        setMembers(Array.isArray(memberList) ? memberList : []);
        setLevels(Array.isArray(levelList) ? levelList : []);
      })
      .catch(() => {
        setMembers([]);
        setLevels([]);
      });
  }, [canReadHierarchy]);
  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);
  const memberFor = (user) => members.find((m) => m.external_id === user.hierarchy_member_id) || null;
  const levelTitle = (code) => levels.find((l) => l.code === code)?.title || code;
  const [users, setUsers] = useState([]);
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
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, type: '', user: null });
  const [showPassword, setShowPassword] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();

  // Dashboard links arrive as ?status=active, so the query string drives the
  // status filter and the filtered view survives a refresh.
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || 'all';
  // ?role=code — how the roles screen links to "who still has this role".
  const roleFilter = searchParams.get('role') || '';
  const clearRoleFilter = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('role');
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
  }, [currentPage, debouncedSearch, statusFilter, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // A narrower filter rarely has as many pages as the one it replaced.
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, roleFilter]);

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
  const sortColumns = useMemo(() => ({
    ...SORT_COLUMNS,
    role: { ...SORT_COLUMNS.role, value: (user) => nameFor(user.role).toLowerCase() },
  }), [nameFor]);
  const sort = useTableSort(visibleUsers, sortColumns, { defaultSortBy: 'created_at' });
  const { sortedRows: filteredUsers, getHeaderProps } = sort;
  // SSO accounts have no password field, no default password and no reset flow.
  const isCreatingPasswordAccount = formData.auth_provider === AUTH_PROVIDERS.PASSWORD;
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
      toast.error(`The ${nameFor(user.role)} role no longer exists. Give ${user.full_name || user.username} a role first.`);
      if (canChangeRoles) setRoleChangeUser(user);
      return;
    }
    try {
      if (user.is_active) {
        await usersAPI.deleteUser(user.id);
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

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required.';
    if (!formData.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!formData.username.trim()) errors.username = 'Username is required.';
    // Password rules only apply to password accounts; SSO accounts must not
    // carry one at all (the backend 422s if they do).
    if (formData.auth_provider === AUTH_PROVIDERS.PASSWORD
      && formData.password && formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    return errors;
  };

  const handleCreateUser = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormLoading(true);
    const isPasswordAccount = formData.auth_provider === AUTH_PROVIDERS.PASSWORD;
    // Sending a password alongside an SSO provider is a 422 — the credential
    // belongs to Google/Microsoft, not to us.
    const { password, ...withoutPassword } = formData;
    const payload = isPasswordAccount ? formData : withoutPassword;

    try {
      const response = await usersAPI.createUser(payload);
      setCreatedUser({
        ...response,
        auth_provider: formData.auth_provider,
        // SSO users get an invite email from the backend instead of credentials.
        password_used: isPasswordAccount ? (formData.password || 'User123!') : null,
      });
      setIsAddModalOpen(false);
      setFormData(INITIAL_FORM);
      setFormErrors({});
      setShowPassword(false);
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
    } finally {
      setFormLoading(false);
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
      errors.new_password = 'Password is required.';
    } else if (resetPasswordFormData.new_password.length < 8) {
      errors.new_password = 'Password must be at least 8 characters.';
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
        // Changing the method is a PATCH. A switch back to password sign-in
        // must carry the new password in the same request.
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

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setShowPassword(false);
  };

  const handleCopyDetails = async () => {
    if (!createdUser) return;
    const text = [
      `Full Name: ${createdUser.full_name}`,
      `Email: ${createdUser.email}`,
      `Username: ${createdUser.username}`,
      `Role: ${nameFor(createdUser.role)}`,
      createdUser.password_used
        ? `Password: ${createdUser.password_used}`
        : `Sign-in: ${authProviderLabel(createdUser.auth_provider)}`,
    ].join('\n');
    if (!(await copyToClipboard(text))) {
      toast.error('Could not copy — please select the credentials and copy them manually.');
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-user-management"]',
        title: 'User Management',
        content: 'Create, edit, and deactivate accounts for everyone in your organization.',
        placement: 'right',
        skipBeacon: true,
      });
    }

    steps.push(
      {
        target: '[data-tour="users-search"]',
        title: 'Search users',
        content: 'Find anyone by name, email, or username.',
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="users-add"]',
        title: 'Add a new user',
        content: "Create a new account and give it one of your organization's roles.",
        placement: 'bottom',
      },
      {
        target: '[data-tour="users-table"]',
        title: 'Manage users',
        content: 'Reset a password, or activate/deactivate an account, right from this table.',
        placement: 'top',
      }
    );

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: 'Your account',
      content: 'Manage your profile or log out from here.',
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop]);

  return (
    <div className="space-y-6">
      <DashboardTour ref={tourRef} storageKey={USERS_TOUR_KEY} steps={tourSteps} />

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96" data-tour="users-search">
          <Input
            placeholder="Search by name, email, or username..."
            value={searchTerm}
            onChange={handleSearchChange}
          // startAdornment={<Search className="h-4 w-4 text-ink-subtle" />}
          />
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
          <div className="inline-flex rounded-lg border border-line p-0.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'inactive', label: 'Inactive' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setStatusFilter(option.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${statusFilter === option.id
                  ? 'bg-accent-soft text-accent-fg'
                  : 'text-ink-muted hover:text-ink hover:bg-hover'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <TableSortControl {...sort} id="users" className="shrink-0" />
          {canCreateUsers && (
            <Button variant="outline" startIcon={Upload} onClick={() => setImportOpen(true)}>
              Import
            </Button>
          )}
          {canCreateUsers && (
            <Button
              variant="secondary"
              startIcon={UserPlus}
              onClick={() => setIsAddModalOpen(true)}
              data-tour="users-add"
            >
              Add New User
            </Button>
          )}
        </div>
      </div>

      {roleFilter && (
        <div className="flex items-center gap-2 text-sm text-ink-secondary">
          Showing people with the role
          <button
            type="button"
            onClick={clearRoleFilter}
            className="inline-flex items-center gap-1.5 rounded-full border border-line-accent bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-fg hover:bg-hover"
            aria-label={`Clear the ${nameFor(roleFilter)} filter`}
          >
            {nameFor(roleFilter)}
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Users Table */}
      <Card padding="none" data-tour="users-table">
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              {Object.entries(SORT_COLUMNS).map(([field, column]) => (
                <Table.Head key={field} {...getHeaderProps(field)}>
                  {column.label}
                </Table.Head>
              ))}
              <Table.Head className="text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading
                rows={DEFAULT_PAGE_SIZE}
                cells={[
                  <div key="u" className="flex items-center space-x-3">
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
                message={debouncedSearch ? 'No matching users' : 'No users found'}
                description={debouncedSearch ? 'Try a different name, email, or username.' : 'Try adjusting your search criteria'}
                icon={Shield}
              />
            ) : (
              filteredUsers.map((user) => (
                <Table.Row key={user.id}>
                  <Table.Cell>
                    <div className="flex items-center space-x-3">
                      <UserAvatar user={user} size="medium" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{user.full_name}</p>
                        <p className="text-xs text-ink-muted break-all">{user.email}</p>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm font-medium text-ink-muted font-mono">{user.username}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <RoleBadge role={user.role} label={nameFor(user.role)} />
                    {/* Level and role are independent: where they sit (which
                        reports they see) shown under what they can do. */}
                    {canReadHierarchy && (
                      <div className="mt-1.5">
                        {user.role === REPORTER_ROLE ? (
                        null
                      ) : (() => {
                        const member = memberFor(user);
                        const seesTeam = byCode.get(user.role)?.permissions?.includes(PERM.reportReadSubordinates);
                        const open = canUpdateUsers ? () => setLinkUser(user) : undefined;
                        return member ? (
                          <button
                            type="button"
                            onClick={open}
                            disabled={!open}
                            className="min-w-0 text-left disabled:cursor-default"
                            title={open ? 'Change directory entry' : undefined}
                          >
                            <span className="block truncate text-sm font-medium text-ink">{member.name}</span>
                            <span className="block truncate text-xs text-ink-muted">
                              {member.level_code ? levelTitle(member.level_code) : 'No level'}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={open}
                            disabled={!open}
                            title={
                              seesTeam
                                ? "Not linked, so they see only their own cases — not their team's."
                                : 'Not linked to a directory entry.'
                            }
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-fg hover:bg-warning-line disabled:cursor-default"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            {user.hierarchy_member_id ? 'Entry missing' : 'Unlinked'}
                          </button>
                        );
                      })()}
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
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Cell>

                  <Table.Cell className="text-right">
                    {canUpdateUsers && (
                      <div className="flex justify-end space-x-2">
                        {canChangeRoles && (
                          <Button
                            variant="ghost"
                            size="small"
                            title="Change role"
                            aria-label={`Change role for ${user.full_name || user.username}`}
                            onClick={() => setRoleChangeUser(user)}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="small"
                          title="Manage sign-in"
                          onClick={() => handleResetPassword(user)}
                        >
                          <PenBoxIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="small"
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => setConfirmModal({
                            open: true,
                            type: user.is_active ? 'deactivate' : 'activate',
                            user
                          })}
                        >
                          {user.is_active
                            ? <UserX className="h-4 w-4 text-danger-fg" />
                            : <UserPlus className="h-4 w-4 text-success-fg" />
                          }
                        </Button>
                      </div>
                    )}
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
        title={confirmModal.type === 'deactivate' ? 'Deactivate User' : 'Activate User'}
        message={
          confirmModal.type === 'activate' && confirmModal.user && roleMissing(confirmModal.user)
            ? `${confirmModal.user.full_name || confirmModal.user.username}'s role, ${nameFor(confirmModal.user.role)}, no longer exists, so they would return with no permissions. You'll be asked to choose a new role.`
            : `Are you sure you want to ${confirmModal.type} user ${confirmModal.user?.full_name || confirmModal.user?.username}?`
        }
        variant={confirmModal.type === 'deactivate' ? 'danger' : 'success'}
        confirmText={confirmModal.type === 'deactivate' ? 'Deactivate' : 'Activate'}
      />

      {linkUser && (
        <DirectoryLinkModal
          user={linkUser}
          members={members}
          levels={levels}
          canEditLevel={canManageHierarchy}
          onClose={() => setLinkUser(null)}
          onSaved={() => {
            setLinkUser(null);
            fetchUsers();
            loadDirectory();
          }}
        />
      )}

      {importOpen && (
        <ImportUsersModal
          onClose={() => setImportOpen(false)}
          onImported={() => {
            fetchUsers();
            loadDirectory();
          }}
        />
      )}

      {roleChangeUser && (
        <ChangeRoleModal
          user={roleChangeUser}
          isSelf={roleChangeUser.id === currentUserId}
          onClose={() => setRoleChangeUser(null)}
          onChanged={() => {
            setRoleChangeUser(null);
            fetchUsers();
          }}
        />
      )}

      {/* Add User Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        title="Add New User"
        className="bg-surface absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]"
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            name="full_name"
            value={formData.full_name}
            onChange={handleFormChange}
            error={formErrors.full_name}
            required
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleFormChange}
            error={formErrors.email}
            required
            helperText="Required — the sign-in identity, and how the account is linked to its directory entry automatically."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleFormChange}
              error={formErrors.username}
              required
            />
            <div className="flex flex-col">
              <label className="text-sm font-medium text-ink-secondary mb-1">
                Sign-in Method <span className="text-danger-fg ml-1">*</span>
              </label>
              <select
                name="auth_provider"
                value={formData.auth_provider}
                onChange={handleFormChange}
                className="border border-line-strong rounded-lg shadow-sm focus:ring-accent-ring focus:border-line-accent p-2 text-sm"
              >
                {AUTH_PROVIDER_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="text-xs text-ink-muted mt-1">
                {isCreatingPasswordAccount
                  ? 'The user receives their credentials by email.'
                  : `The user signs in with ${authProviderLabel(formData.auth_provider)} — no password is set.`}
              </p>
            </div>
            {/* SSO accounts own no password: the field is hidden rather than
                disabled, so it can never be submitted by accident. */}
            {isCreatingPasswordAccount && (
              <div className="relative">
                <Input
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleFormChange}
                  error={formErrors.password}
                  className="pr-10"
                  helperText={<span className="font-medium text-ink">Default password is User123!</span>}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-5.5 text-ink-muted hover:text-ink-secondary focus:outline-none z-10"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-ink-secondary mb-1">
                Role <span className="text-danger-fg ml-1">*</span>
              </label>
              <RoleSelect
                name="role"
                value={formData.role}
                onChange={handleFormChange}
                className="border border-line-strong rounded-lg shadow-sm focus:ring-accent-ring focus:border-line-accent p-2 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={handleCloseModal} disabled={formLoading}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleCreateUser} disabled={formLoading}>
              {formLoading ? 'Saving...' : 'Save User'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* User Created Success Modal */}
      <Modal
        isOpen={!!createdUser}
        onClose={() => setCreatedUser(null)}
        title="User Created Successfully"
        className="bg-surface absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {createdUser?.password_used
              ? 'Please make sure to copy the user credentials below. The password will not be shown again.'
              : `This account signs in with ${authProviderLabel(createdUser?.auth_provider)}. They have been emailed an invitation — there is no password to share.`}
          </p>

          <div className="bg-subtle border border-line rounded-xl p-4 space-y-3 font-mono text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-ink-muted font-sans">Full Name:</span>
              <span className="font-semibold text-ink">{createdUser?.full_name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ink-muted font-sans shrink-0">Email:</span>
              <span className="font-semibold text-ink break-all text-right">{createdUser?.email}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ink-muted font-sans">Username:</span>
              <span className="font-semibold text-ink">{createdUser?.username}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ink-muted font-sans">Role:</span>
              <span className="font-semibold text-ink">{nameFor(createdUser?.role)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-ink-muted font-sans">
                {createdUser?.password_used ? 'Password:' : 'Sign-in:'}
              </span>
              <span className="font-semibold text-ink select-all">
                {createdUser?.password_used || authProviderLabel(createdUser?.auth_provider)}
              </span>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              startIcon={copied ? Check : Copy}
              onClick={handleCopyDetails}
            >
              {copied ? 'Copied!' : 'Copy Credentials'}
            </Button>
            <Button variant="secondary" onClick={() => setCreatedUser(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manage Sign-in Modal — password reset and provider switching share a
          form because they are the same decision from an admin's point of view. */}
      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title="Manage Sign-in"
        className="bg-surface absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            {selectedUser?.full_name} currently signs in with{' '}
            <span className="font-medium text-ink">
              {authProviderLabel(selectedUser?.auth_provider)}
            </span>.
          </p>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-ink-secondary mb-1">
              Sign-in Method
            </label>
            <select
              name="auth_provider"
              value={resetPasswordFormData.auth_provider}
              onChange={(e) => setResetPasswordFormData((prev) => ({
                ...prev,
                auth_provider: e.target.value,
              }))}
              className="border border-line-strong rounded-lg shadow-sm focus:ring-accent-ring focus:border-line-accent p-2 text-sm"
            >
              {AUTH_PROVIDER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {resetPasswordFormData.auth_provider === AUTH_PROVIDERS.PASSWORD ? (
            <div className="relative">
              <Input
                label={isSwitchingToPassword ? 'New Password' : 'New Password (reset)'}
                type={showResetPassword ? 'text' : 'password'}
                name="new_password"
                value={resetPasswordFormData.new_password}
                onChange={(e) => setResetPasswordFormData((prev) => ({ ...prev, new_password: e.target.value }))}
                error={resetPasswordFormErrors.new_password}
                helperText={isSwitchingToPassword
                  ? 'Required — switching away from SSO needs a password to sign in with.'
                  : undefined}
              />
              <button
                type="button"
                onClick={() => setShowResetPassword(!showResetPassword)}
                className="absolute right-3 top-7.25 text-ink-muted hover:text-ink-secondary focus:outline-none z-10"
              >
                {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <Alert variant="warning">
              This account will sign in with {authProviderLabel(resetPasswordFormData.auth_provider)}.
              Any existing password is removed, and the email address above must match
              their {authProviderLabel(resetPasswordFormData.auth_provider)} account.
            </Alert>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsResetPasswordModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleResetPasswordSubmit} disabled={resetPasswordFormLoading}>
              {resetPasswordFormLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default Users;
