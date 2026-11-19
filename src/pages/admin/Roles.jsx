// src/pages/admin/Roles.jsx
//
// Roles & permissions, as a matrix: every staff role is a column, every
// permission a row, grouped as the catalog groups them. Ticks can be changed
// in place, for several roles at once, and are saved together from the bar at
// the bottom. Selecting a column shows that role's summary — who holds it,
// which AI agents act as it, how much it grants — and its validation messages.
//
// Two codes are fixed: `admin` (every permission) and `reporter` (the public
// self-service identity, own-scoped). Both are columns, shown read-only so an
// admin can see what each grants; edit and delete are gated on `is_fixed`,
// never on the code — except a fixed role's level, which can be changed.
//
// Each role sits at one hierarchy level, and its holders sit there with it,
// so the columns run most senior first: the role list is the org chart. A
// role with no level is flagged — nobody holding it can be placed. The seeded roles — manager, officer, reviewer — are a
// starting point and fully editable.
//
// The rules the editor modal follows apply here too: a permission the
// signed-in user doesn't hold can't be granted (`granted: false`), each
// permission's `requires_any_of` is checked instantly, and the server's
// /validate has the final word.
//
// Admin only (role:manage): every role with its permissions, the catalog and
// the access matrix are admin-only reads. Other staff see role names only.
// Below the grid, "Who can see whom" (GET /org-roles/access-matrix) shows each
// role's `viewable_roles` — whose accounts its holders see under User
// Management. Admin accounts are visible to admins only.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import RoleEditorModal from '../../components/roles/RoleEditorModal';
import DeleteRoleModal from '../../components/roles/DeleteRoleModal';
import { catalogEntries, localPrerequisiteErrors } from '../../components/roles/PermissionPicker';
import { orgRolesAPI } from '../../api/orgRoles';
import { orgAgentsAPI } from '../../api/orgAgents';
import { usersAPI } from '../../api/users';
import { invalidateOrgRoles, useOrgRoles } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { ACCESS, PERM, PERMISSION_HINTS, permissionLabel, permissionLabels, togglePermissionIn } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { sortRolesByLevel } from '../../utils/roleLevels';
import { describeError, errorSummary } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';

const VALIDATE_DEBOUNCE_MS = 350;

// Warnings that come back from a save that went through. The ones about cases
// (assigned_cases_hidden, owner_cannot_handle) need someone to reassign cases
// or pick another owner, so they stay on screen until dismissed.
const CASE_WARNINGS = new Set(['assigned_cases_hidden']);
const OWNER_WARNINGS = new Set(['owner_cannot_handle']);

const SavedWarnings = ({ warnings, orgSlug, onDismiss }) => {
  const { t } = useTranslation('people');
  if (!warnings.length) return null;
  const linkCases = warnings.some((w) => CASE_WARNINGS.has(w.code));
  const linkTypes = warnings.some((w) => OWNER_WARNINGS.has(w.code));
  return (
    <Alert variant="warning" title={t('roles.savedWarnings.title')} dismissible onDismiss={onDismiss}>
      <ul className="list-disc space-y-1 ps-4">
        {warnings.map((warning, i) => (
          <li key={i}>
            {warning.role && <span className="font-semibold">{warning.role}: </span>}
            {warning.message}
          </li>
        ))}
      </ul>
      {(linkCases || linkTypes) && (
        <p className="mt-2 flex flex-wrap gap-x-4">
          {linkCases && (
            <Link to={staffPath(orgSlug, 'reports')} className="font-semibold underline underline-offset-2">
              {t('roles.savedWarnings.goCases')}
            </Link>
          )}
          {linkTypes && (
            <Link to={staffPath(orgSlug, 'report-types')} className="font-semibold underline underline-offset-2">
              {t('roles.savedWarnings.goTypes')}
            </Link>
          )}
        </p>
      )}
    </Alert>
  );
};

const setKey = (permissions) => [...permissions].sort().join(',');

const sameSet = (a, b) => a.size === b.size && [...a].every((p) => b.has(p));

// ─── While the roles and the catalog load ───────────────────────────────

const SKELETON_ROLES = 6;

/** The summary card, legend and matrix, with the data stubbed. */
const RolesSkeleton = () => {
  const { t } = useTranslation('people');
  return (
  <div className="space-y-4" aria-busy="true">
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3 lg:w-64 lg:shrink-0">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="min-w-0">
            <Skeleton.Text size="base" className="w-28" />
            <Skeleton.Text size="xs" className="w-20" />
          </div>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="min-w-0 rounded-xl bg-subtle px-3.5 py-2.5">
              <Skeleton.Text size="xs" className="w-24" />
              <span className="mt-0.5 flex h-[22px] items-center">
                <Skeleton className="h-3.5 w-16" />
              </span>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 gap-2">
          <Skeleton.Button small className="w-28" />
          <Skeleton.Button small className="w-10" />
        </div>
      </div>
    </section>

    <div className="flex items-center gap-x-5 text-xs">
      <Skeleton.Text size="xs" className="w-64" />
      <Skeleton.Text size="xs" className="ms-auto w-32" />
    </div>

    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-176 border-separate border-spacing-0 [&_td]:border-b [&_td]:border-line-subtle [&_th]:border-b [&_th]:border-line-subtle">
        <thead>
          <tr className="bg-subtle">
            <th className="w-72 min-w-52 bg-subtle px-4 py-3 text-start align-bottom text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
              {t('roles.permission')}
            </th>
            {Array.from({ length: SKELETON_ROLES }).map((_, i) => (
              <th key={i} className="min-w-30 border-s border-line-subtle px-2 py-3">
                <span className="flex flex-col items-center gap-0.5">
                  <Skeleton.Text className="w-20" />
                  <Skeleton.Text size="xs" className="w-12" />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="bg-subtle/60">
            <th className="bg-subtle px-4 py-2.5 text-start">
              <Skeleton.Text size="xs" className="w-24" />
            </th>
            {Array.from({ length: SKELETON_ROLES }).map((_, i) => (
              <td key={i} className="border-s border-line-subtle">
                <Skeleton.Text size="xs" className="mx-auto w-6" />
              </td>
            ))}
          </tr>
          {Array.from({ length: 8 }).map((_, row) => (
            <tr key={row}>
              <th className="px-4 py-3 text-start font-normal">
                <Skeleton.Text className={row % 3 === 0 ? 'w-48' : 'w-36'} />
              </th>
              {Array.from({ length: SKELETON_ROLES }).map((_, i) => (
                <td key={i} className="border-s border-line-subtle text-center">
                  <Skeleton.Circle size="h-5 w-5" className="mx-auto" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Who can see whom */}
    <section className="rounded-2xl border border-line bg-surface px-4 py-3.5 sm:px-5">
      <Skeleton.Text size="base" className="w-36" />
      <Skeleton.Text size="xs" className="mt-1 w-96 max-w-full" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-4">
            <Skeleton.Text className="w-28 shrink-0" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton.Circle key={i} size="h-5 w-5" className="mx-auto" />
            ))}
          </div>
        ))}
      </div>
    </section>
  </div>
  );
};

// ─── The selected role, in brief ─────────────────────────────────────────

const Stat = ({ label, children, to }) => {
  const body = (
    <>
      <span className="block text-xs text-ink-subtle">{label}</span>
      <span className="mt-0.5 block truncate text-[15px] font-semibold text-ink">{children}</span>
    </>
  );
  return to ? (
    <Link to={to} className="min-w-0 rounded-xl bg-subtle px-3.5 py-2.5 transition-colors hover:bg-hover">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 rounded-xl bg-subtle px-3.5 py-2.5">{body}</div>
  );
};

const RoleSummary = ({
  role,
  viewableNames = [],
  saved,
  draft,
  total,
  people,
  agents,
  paths,
  canManage,
  problems,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation('people');
  const added = [...draft].filter((p) => !saved.has(p)).length;
  const removed = [...saved].filter((p) => !draft.has(p)).length;
  const changed = added + removed > 0;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3 lg:w-64 lg:shrink-0">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
              role.is_fixed ? 'bg-ink text-canvas' : 'bg-accent-soft text-accent-fg'
            }`}
          >
            {role.is_fixed ? <Lock className="h-4 w-4" aria-hidden="true" /> : role.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-base font-bold text-ink" dir="auto">{role.name}</h2>
              {role.is_fixed && <Badge variant="dark" size="small">{t('roles.fixed')}</Badge>}
              {role.is_active === false && <Badge variant="warning" size="small">{t('users.status.inactive')}</Badge>}
            </div>
            <p className="font-mono text-xs text-ink-subtle" dir="ltr">{role.code}</p>
            <p className={`mt-0.5 text-xs ${role.level_code ? 'text-ink-muted' : 'font-medium text-warning-fg'}`}>
              {role.level_code
                ? t('users.filters.level', { name: role.level_title || role.level_code })
                : t('roles.noLevel')}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          {people !== undefined && (
            <Stat label={t('roles.stat.people')} to={paths.users ? `${paths.users}?role=${encodeURIComponent(role.code)}` : null}>
              {people === null ? '—' : t('roles.stat.peopleCount', { count: people })}
            </Stat>
          )}
          {agents !== undefined && (
            <Stat
              label={t('roles.stat.agents')}
              to={agents.length && paths.agents ? `${paths.agents}?agent=${encodeURIComponent(agents[0].code)}` : null}
            >
              {agents.length === 0 ? t('roles.stat.none') : agents.map((a) => a.name).join(t('permJoin.list'))}
            </Stat>
          )}
          <Stat label={t('roleEditor.permissions')}>
            {t('permPicker.selectedOf', { count: draft.size, total })}
            {changed && (
              <span className="ms-1.5 text-xs font-medium text-accent-fg">
                <bdi dir="ltr">
                  {added > 0 && `+${added}`}
                  {added > 0 && removed > 0 && ' '}
                  {removed > 0 && `−${removed}`}
                </bdi>{' '}
                {t('roles.unsaved')}
              </span>
            )}
          </Stat>
        </div>

        <div className="flex shrink-0 gap-2">
          {!canManage ? (
            <Button variant="outline" size="small" onClick={onEdit}>
              {t('common:actions.view')}
            </Button>
          ) : role.is_fixed ? (
            <Button variant="outline" size="small" startIcon={Pencil} onClick={onEdit} title={t('roles.changeLevelTitle')}>
              {t('roles.changeLevel')}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="small"
                startIcon={Pencil}
                onClick={onEdit}
                disabled={changed}
                title={changed ? t('roles.editBlocked') : t('roles.editTitle')}
              >
                {t('roles.editDetails')}
              </Button>
              <Button variant="ghost" size="small" onClick={onDelete} aria-label={t('deleteRole.title', { name: role.name }).replace(/[?؟]$/, '')} title={t('deleteRole.submit')}>
                <Trash2 className="h-4 w-4 text-danger-fg" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </div>

      {Array.isArray(role.viewable_roles) && <p className="mt-3 text-xs text-ink-muted">
        <span className="font-medium text-ink-secondary">{t('roles.canSee')} </span>
        {role.code === 'admin'
          ? t('roles.canSeeEveryone')
          : viewableNames.length
            ? t('roles.canSeeRoles', { roles: viewableNames.join(t('permJoin.list')) })
            : t('roles.canSeeOwn')}
      </p>}

      {role.is_fixed && (
        <p className="mt-3 text-xs text-ink-muted">
          {role.is_staff_role === false
            ? t('roles.fixedReporter')
            : t('roles.fixedAdmin')}
        </p>
      )}

      {problems.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {problems.map((problem, index) => (
            <li
              key={index}
              className={`flex items-start gap-2 text-xs ${problem.error ? 'text-danger-fg' : 'text-warning-fg'}`}
            >
              {problem.error ? (
                <XCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{problem.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// ─── One cell of the grid ─────────────────────────────────────────────────

const Cell = ({ role, permission, label, held, was, locked, fixed, error, selected, onToggle }) => {
  const { t } = useTranslation('people');
  const changed = held !== was;
  let mark = 'border-[1.5px] border-line-strong bg-surface';
  if (fixed) mark = held ? 'bg-active text-ink-muted' : 'border-[1.5px] border-line bg-surface';
  else if (error) mark = 'bg-danger-solid text-white ring-2 ring-danger-line';
  else if (held && changed) mark = 'border-[1.5px] border-dashed border-accent bg-accent-soft text-accent-fg';
  else if (held) mark = 'bg-accent text-on-accent';
  else if (changed) mark = 'border-[1.5px] border-dashed border-danger-line bg-danger-soft';

  const state = held ? t('roles.cell.allowed') : t('roles.cell.notAllowed');
  const note = error || (changed ? (held ? t('roles.cell.willAllow') : t('roles.cell.willRemove')) : '');

  return (
    <td className={`border-s border-line-subtle p-0 text-center ${selected ? 'bg-accent-soft/40' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={held}
        aria-label={t(note ? 'roles.cell.labelNote' : 'roles.cell.label', { role: role.name, permission: label, state, note })}
        title={
          fixed
            ? t('roles.cell.fixed', { role: role.name })
            : locked
              ? t('permPicker.lockedTitle')
              : note || undefined
        }
        disabled={fixed || locked}
        onClick={() => onToggle(role.code, permission)}
        className="group flex h-11 w-full items-center justify-center disabled:cursor-not-allowed"
      >
        <span
          className={`flex h-5.5 w-5.5 items-center justify-center rounded-full transition-transform group-enabled:group-hover:scale-110 ${mark} ${
            locked && !fixed && !held ? 'opacity-40' : ''
          }`}
        >
          {held && !error && <Check className="h-3 w-3" strokeWidth={3.2} aria-hidden="true" />}
          {error && <span className="text-[11px] font-bold leading-none" aria-hidden="true">!</span>}
        </span>
      </button>
    </td>
  );
};

// ─── The page ─────────────────────────────────────────────────────────────

// ─── Who can see whom ─────────────────────────────────────────────────────

/**
 * Rows are the viewer's role, columns the role of the account being looked
 * at. A tick means holders of the row's role see those accounts under User
 * Management. Only admins can manage accounts; everyone sees their own.
 */
const AccessMatrix = ({ data, canManage, onEdit }) => {
  const { t } = useTranslation('people');
  const [open, setOpen] = useState(true);
  const rows = data?.roles || [];
  if (!rows.length) return null;
  const columns = rows[0].targets || [];

  return (
    <section className="rounded-2xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-start sm:px-5"
      >
        <span>
          <span className="block text-[15px] font-semibold text-ink">{t('roles.matrix.title')}</span>
          <span className="block text-xs text-ink-muted">
            {t('roles.matrix.help')}
          </span>
        </span>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-ink-muted transition-transform ${open ? '' : '-rotate-90 rtl:rotate-90'}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-line-subtle scrollbar-thin">
          <table className="w-full min-w-140 border-separate border-spacing-0 text-start text-sm [&_td]:border-b [&_td]:border-line-subtle [&_th]:border-b [&_th]:border-line-subtle">
            <thead>
              <tr className="bg-subtle">
                <th scope="col" className="sticky start-0 z-10 bg-subtle-solid px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
                  <Trans t={t} i18nKey="roles.matrix.corner" components={{ s: <span className="normal-case tracking-normal" /> }} />
                </th>
                {columns.map((target) => (
                  <th key={target.role} scope="col" className="border-s border-line-subtle px-3 py-2.5 text-center text-xs font-semibold text-ink">
                    {target.name}
                  </th>
                ))}
                {canManage && <th scope="col" className="border-s border-line-subtle px-3 py-2.5" aria-label={t('common:actions.edit')} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.role} className="hover:bg-hover/50">
                  <th scope="row" className="sticky start-0 z-10 bg-surface px-4 py-2.5 font-medium text-ink">
                    <span className="flex items-center gap-1.5">
                      {row.is_fixed && <Lock className="h-3 w-3 text-ink-subtle" aria-label={t('roleEditor.fixed.title')} />}
                      {row.name}
                      {row.can_manage_users && (
                        <Badge variant="dark" size="small">
                          {t('roles.matrix.managesAccounts')}
                        </Badge>
                      )}
                    </span>
                  </th>
                  {(row.targets || []).map((target) => (
                    <td key={target.role} className="border-s border-line-subtle px-3 py-2.5 text-center">
                      {target.can_view ? (
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-on-accent"
                          title={t(target.can_manage ? 'roles.matrix.canSeeChange' : 'roles.matrix.canSee', { role: row.name, target: target.name })}
                        >
                          <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden="true" />
                          <span className="sr-only">{t('roles.cell.allowed')}</span>
                        </span>
                      ) : (
                        <span
                          className="inline-block h-5 w-5 rounded-full border-[1.5px] border-line-strong"
                          title={
                            target.role === 'admin' && row.role !== 'admin'
                              ? t('roles.matrix.adminOnly')
                              : t('roles.matrix.cantSee', { role: row.name, target: target.name })
                          }
                        />
                      )}
                    </td>
                  ))}
                  {canManage && (
                    <td className="border-s border-line-subtle px-3 py-2.5 text-end">
                      {!row.is_fixed && (
                        <button type="button" onClick={() => onEdit(row.role)} className="text-xs font-medium text-link hover:underline">
                          {t('roles.matrix.change')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const Roles = () => {
  const { t } = useTranslation('people');
  useSEO({
    title: t('roles.seoTitle'),
    description: t('roles.seoDescription'),
    noIndex: true,
  });
  const can = useCan();
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const [showInactive, setShowInactive] = useState(false);
  const { allRoles, loading, error, reload } = useOrgRoles({ activeOnly: !showInactive });

  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState(null);
  const [editing, setEditing] = useState(null); // { role } — role null means create
  const [deleting, setDeleting] = useState(null);
  // ?role=officer (from a level's role chips) opens on that role.
  const [searchParams] = useSearchParams();
  const [selectedCode, setSelectedCode] = useState(() => searchParams.get('role'));
  const [drafts, setDrafts] = useState({}); // code → Set of permissions, for roles changed in the grid
  const [validations, setValidations] = useState({}); // code → { key, result }
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState({});
  const [agents, setAgents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Saved, but with consequences to act on (cases their holders can no longer open).
  const [savedWarnings, setSavedWarnings] = useState([]);
  const [confirmEscalation, setConfirmEscalation] = useState(false);
  const [matrixVersion, setMatrixVersion] = useState(0);
  // Who can see whom: { data, done }. Fetched with the rest so the page
  // appears whole rather than piece by piece.
  const [matrix, setMatrix] = useState({ data: null, done: false });
  const [peopleReady, setPeopleReady] = useState(false);
  const [agentsReady, setAgentsReady] = useState(false);

  // Holder counts come from the users list, which shows only the roles the
  // viewer's own role may see — so count only those, rather than show a 0.
  const me = useAuthStore((state) => state.user);
  const canSeePeople = can(ACCESS.users);
  const myRole = allRoles.find((r) => r.code === me?.role);
  const canSeeHolders = (code) =>
    canSeePeople && (me?.role === 'admin' || (myRole?.viewable_roles || []).includes(code) || code === me?.role);
  const canSeeAgents = can(PERM.agentRead);
  const paths = {
    users: canSeePeople ? staffPath(orgSlug, 'users') : null,
    agents: canSeeAgents ? staffPath(orgSlug, 'agents') : null,
  };

  const loadCatalog = useCallback(async () => {
    setCatalogError(null);
    try {
      setCatalog(await orgRolesAPI.catalog());
    } catch (err) {
      setCatalogError(errorSummary(err));
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const canManage = can(PERM.roleManage) && catalog?.can_manage_roles !== false;

  // Every role, fixed ones included — `reporter` is locked like `admin`, but an
  // admin still needs to see what it grants.
  const roles = useMemo(() => sortRolesByLevel(allRoles), [allRoles]);
  // Only once a ladder is in use (some role has a level): before any level
  // exists there is nothing to place a role on yet.
  const unplacedRoles = roles.some((role) => role.level_code)
    ? roles.filter((role) => !role.level_code && role.is_active !== false)
    : [];
  const entries = useMemo(() => catalogEntries(catalog), [catalog]);
  const total = catalog?.total ?? entries.size;

  // Who holds each role, and which agents act as it — context for the summary.
  const rolesKey = roles.map((r) => r.code).join(',');
  useEffect(() => {
    let live = true;
    orgRolesAPI
      .accessMatrix()
      .then((data) => live && setMatrix({ data, done: true }))
      .catch(() => live && setMatrix({ data: null, done: true }));
    return () => {
      live = false;
    };
  }, [matrixVersion]);

  useEffect(() => {
    if (!canSeePeople) {
      setPeopleReady(true);
      return undefined;
    }
    if (!rolesKey) return undefined;
    let cancelled = false;
    Promise.all(
      rolesKey.split(',').map((code) =>
        usersAPI
          .getAllUsers({ role: code, page: 1, page_size: 1 })
          .then((data) => [code, typeof data?.total === 'number' ? data.total : null])
          .catch(() => [code, null]),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setPeople(Object.fromEntries(pairs));
      setPeopleReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [rolesKey, canSeePeople]);

  useEffect(() => {
    if (!canSeeAgents) {
      setAgentsReady(true);
      return;
    }
    orgAgentsAPI
      .list()
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]))
      .finally(() => setAgentsReady(true));
  }, [canSeeAgents]);

  // The first load shows one skeleton until everything the page draws has
  // arrived; after that, refreshes update in place.
  const everythingLoaded =
    !loading && Boolean(catalog) && (peopleReady || roles.length === 0) && agentsReady && matrix.done;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (everythingLoaded) setShown(true);
  }, [everythingLoaded]);

  const savedSets = useMemo(() => Object.fromEntries(roles.map((r) => [r.code, new Set(r.permissions || [])])), [roles]);
  const heldBy = (code) => drafts[code] || savedSets[code] || new Set();
  const changedCodes = Object.keys(drafts).filter((code) => savedSets[code] && !sameSet(drafts[code], savedSets[code]));

  const selected = roles.find((r) => r.code === selectedCode) || roles.find((r) => !r.is_fixed) || roles[0] || null;

  // ─── Editing in the grid ─────────────────────────────────────────────
  const toggle = (code, permission) => {
    if (!canManage) return;
    setSaveError(null);
    setSelectedCode(code);
    setDrafts((prev) => {
      const next = togglePermissionIn(prev[code] || savedSets[code] || [], permission);
      const out = { ...prev };
      if (sameSet(next, savedSets[code] || new Set())) delete out[code];
      else out[code] = next;
      return out;
    });
  };

  const discard = () => {
    setDrafts({});
    setValidations({});
    setSaveError(null);
  };

  // The server's verdict on each changed role once ticking settles; a stale
  // reply (for a set since changed again) is ignored.
  const draftKeys = Object.fromEntries(changedCodes.map((code) => [code, setKey(drafts[code])]));
  const draftSignature = JSON.stringify(draftKeys);
  const latest = useRef(draftKeys);
  latest.current = draftKeys;
  useEffect(() => {
    const keys = JSON.parse(draftSignature);
    const codes = Object.keys(keys);
    if (!codes.length) return undefined;
    const timer = setTimeout(() => {
      codes.forEach(async (code) => {
        const key = keys[code];
        try {
          const result = await orgRolesAPI.validate(key ? key.split(',') : []);
          if (latest.current[code] === key) setValidations((prev) => ({ ...prev, [code]: { key, result } }));
        } catch {
          // The local checks stand; saving is the final word.
        }
      });
    }, VALIDATE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftSignature]);

  /** Errors (block saving) and warnings for one role's current draft. */
  const problemsFor = (code) => {
    if (!drafts[code]) return { errors: new Map(), list: [] };
    const draft = drafts[code];
    const errors = new Map(localPrerequisiteErrors(draft, entries));
    const server = validations[code]?.key === setKey(draft) ? validations[code].result : null;
    (server?.errors || []).forEach((e) => e.permission && errors.set(e.permission, { message: e.message }));
    const list = [
      ...[...errors.entries()].map(([, e]) => ({ error: true, message: e.message })),
      ...(server?.errors || []).filter((e) => !e.permission).map((e) => ({ error: true, message: e.message })),
      ...(server?.warnings || []).map((w) => ({ error: false, message: w.message })),
    ];
    if (server?.not_grantable?.length) {
      list.push({
        error: true,
        message: t('roles.notGrantable', {
          labels: permissionLabels(server.not_grantable, t('permJoin.list')),
          count: server.not_grantable.length,
        }),
      });
    }
    return { errors, list, invalid: server?.valid === false };
  };

  const problemsByRole = Object.fromEntries(changedCodes.map((code) => [code, problemsFor(code)]));
  const blocked = changedCodes.some((code) => problemsByRole[code].errors.size > 0 || problemsByRole[code].invalid);
  const addsRoleManage = changedCodes.some(
    (code) => drafts[code].has(PERM.roleManage) && !savedSets[code].has(PERM.roleManage),
  );

  const save = async () => {
    if (saving || blocked || !changedCodes.length) return;
    if (addsRoleManage && !confirmEscalation) {
      setConfirmEscalation(true);
      return;
    }
    setConfirmEscalation(false);
    setSaving(true);
    setSaveError(null);
    const failed = {};
    const warnings = [];
    let savedCount = 0;
    for (const code of changedCodes) {
      const role = roles.find((r) => r.code === code);
      try {
        const saved = await orgRolesAPI.update(role.id, { permissions: [...drafts[code]] });
        (saved?.warnings || []).forEach((warning) => warnings.push({ ...warning, role: role.name }));
        savedCount += 1;
      } catch (err) {
        failed[code] = describeError(err);
      }
    }
    setSaving(false);
    setSavedWarnings(warnings);
    if (savedCount) {
      invalidateOrgRoles();
      // Changing roles can change what the signed-in user holds.
      useAuthStore.getState().refreshUser();
      loadCatalog();
      toast.success(t('roles.savedCount', { count: savedCount }));
    }
    // Keep only what didn't save, so it can be fixed and retried.
    setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([code]) => failed[code])));
    const failedCodes = Object.keys(failed);
    if (failedCodes.length) {
      setSaveError(
        failedCodes
          .map((code) => `${roles.find((r) => r.code === code)?.name}: ${failed[code].summary}`)
          .join(' · '),
      );
    }
  };


  const afterWrite = () => {
    setEditing(null);
    setDeleting(null);
    loadCatalog();
    setMatrixVersion((v) => v + 1);
  };

  // ─── Rows ────────────────────────────────────────────────────────────
  const term = query.trim().toLowerCase();
  const groups = (catalog?.groups || [])
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter(
        (entry) =>
          !term ||
          entry.permission.toLowerCase().includes(term) ||
          permissionLabel(entry.permission).toLowerCase().includes(term),
      ),
    }))
    .filter((group) => group.permissions.length > 0);

  const toggleGroup = (key) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const colCount = roles.length + 1;
  const selectedProblems = selected ? problemsByRole[selected.code]?.list || [] : [];

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-xl font-bold text-ink">{t('roles.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            {t('roles.intro')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 focus-within:border-line-accent">
            <Search className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('roles.find')}
              aria-label={t('roles.find')}
              className="w-40 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle sm:w-48"
            />
          </label>
          <Button
            variant="outline"
            onClick={() => {
              reload();
              loadCatalog();
            }}
            disabled={loading}
            aria-label={t('roles.refresh')}
            title={t('roles.refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
          {canManage && (
            <Button startIcon={Plus} onClick={() => setEditing({ role: null })} disabled={!catalog}>
              {t('roleEditor.newTitle')}
            </Button>
          )}
        </div>
      </div>

      {catalogError && (
        <Alert variant="error" title={t('roles.catalogError')}>
          {catalogError}
        </Alert>
      )}

      {error && !loading && (
        <Alert variant="error" title={t('roleSelect.error')}>
          {errorSummary(error)}{' '}
          <button type="button" onClick={reload} className="font-medium text-link hover:underline">
            {t('common:actions.retry')}
          </button>
        </Alert>
      )}

      <SavedWarnings warnings={savedWarnings} orgSlug={orgSlug} onDismiss={() => setSavedWarnings([])} />

      {shown && unplacedRoles.length > 0 && (
        <Alert variant="warning" title={t('roles.unplaced.title', { count: unplacedRoles.length })}>
          {t('roles.unplaced.body', { roles: unplacedRoles.map((r) => r.name).join(t('permJoin.list')) })}
        </Alert>
      )}

      {!shown && !error && !catalogError && <RolesSkeleton />}

      {shown && selected && catalog && (
        <RoleSummary
          role={selected}
          saved={savedSets[selected.code] || new Set()}
          draft={heldBy(selected.code)}
          total={total}
          people={canSeeHolders(selected.code) ? (selected.code in people ? people[selected.code] : null) : undefined}
          viewableNames={(selected.viewable_roles || []).map((code) => roles.find((r) => r.code === code)?.name || code)}
          agents={
            canSeeAgents
              ? agents.filter((a) => a.role_source === 'org_role' && a.role_code === selected.code)
              : undefined
          }
          paths={paths}
          canManage={canManage}
          problems={selectedProblems}
          onEdit={() => setEditing({ role: selected })}
          onDelete={() => setDeleting(selected)}
        />
      )}

      {shown && roles.length > 0 && catalog && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-on-accent">
                <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden="true" />
              </span>
              {t('roles.legend.allowed')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full border-[1.5px] border-line-strong" />
              {t('roles.legend.notAllowed')}
            </span>
            {canManage && (
              <span className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full border-[1.5px] border-dashed border-accent bg-accent-soft" />
                {t('roles.legend.unsaved')}
              </span>
            )}
            <span className="hidden sm:inline">{t('roles.legend.selectHint')}</span>
            <label className="ms-auto flex cursor-pointer items-center gap-2 text-ink-secondary">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4 rounded border-line-strong"
              />
              {t('roles.showInactive')}
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line bg-surface scrollbar-thin">
            {/* Separated borders, drawn on the cells: collapsed borders spill a
                pixel past the table and made the box scroll sideways. */}
            <table className="w-full min-w-176 border-separate border-spacing-0 text-start [&_td]:border-b [&_td]:border-line-subtle [&_th]:border-b [&_th]:border-line-subtle [&>tbody:last-child>tr:last-child>*]:border-b-0">
              <thead>
                <tr className="border-b border-line bg-subtle">
                  <th
                    scope="col"
                    className="sticky start-0 z-10 w-40 min-w-40 sm:w-72 sm:min-w-52 bg-subtle-solid px-3 sm:px-4 py-3 align-bottom text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle"
                  >
                    {t('roles.permission')}
                  </th>
                  {roles.map((role) => {
                    const on = selected?.code === role.code;
                    const dirty = changedCodes.includes(role.code);
                    return (
                      <th
                        key={role.code}
                        scope="col"
                        className={`min-w-30 border-s border-line-subtle p-0 align-bottom ${
                          on ? 'bg-accent-soft shadow-[inset_0_-2px_0_var(--color-accent)]' : ''
                        } ${role.is_active === false ? 'opacity-60' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedCode(role.code)}
                          aria-pressed={on}
                          className="flex w-full flex-col items-center gap-0.5 px-2 py-3 transition-colors hover:bg-hover"
                        >
                          <span className="flex items-center gap-1 text-sm font-semibold text-ink">
                            {role.is_fixed && <Lock className="h-3 w-3 text-ink-subtle" aria-label={t('roleEditor.fixed.title')} />}
                            <span dir="auto">{role.name}</span>
                          </span>
                          {role.level_code ? (
                            <span className="text-[11px] font-medium text-ink-muted">{role.level_title || role.level_code}</span>
                          ) : (
                            <span
                              className="rounded-full bg-warning-soft px-1.5 py-px text-[10px] font-semibold text-warning-fg"
                              title={t('roles.noLevelTitle')}
                            >
                              {t('users.placement.noLevel')}
                            </span>
                          )}
                          <span className="text-[11px] font-normal text-ink-subtle">
                            {t('permPicker.selectedOf', { count: heldBy(role.code).size, total })}
                          </span>
                          {dirty && (
                            <span className="mt-0.5 rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-on-accent">
                              {t('roles.unsavedBadge')}
                            </span>
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              {groups.map((group) => {
                const open = Boolean(term) || !collapsed.has(group.key);
                return (
                  <tbody key={group.key}>
                    <tr className="border-b border-line-subtle bg-subtle/60">
                      <th scope="rowgroup" className="sticky start-0 z-10 bg-subtle-solid p-0">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          aria-expanded={open}
                          className="flex w-full items-center gap-2 px-3 sm:px-4 py-2.5 text-start text-xs font-bold uppercase tracking-wider text-ink-secondary"
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90 rtl:rotate-90'}`} aria-hidden="true" />
                          {group.label}
                          <span className="font-medium normal-case tracking-normal text-ink-subtle">
                            {group.permissions.length}
                          </span>
                        </button>
                      </th>
                      {roles.map((role) => {
                        const held = heldBy(role.code);
                        const count = group.permissions.filter((e) => held.has(e.permission)).length;
                        return (
                          <td
                            key={role.code}
                            className={`border-s border-line-subtle text-center text-[11px] font-semibold text-ink-subtle ${
                              selected?.code === role.code ? 'bg-accent-soft/40' : ''
                            }`}
                          >
                            <bdi dir="ltr">{count}/{group.permissions.length}</bdi>
                          </td>
                        );
                      })}
                    </tr>
                    {open &&
                      group.permissions.map((entry) => {
                        const label = permissionLabel(entry.permission);
                        return (
                          <tr key={entry.permission} className="border-b border-line-subtle last:border-b-0 hover:bg-hover/50">
                            <th scope="row" className="sticky start-0 z-10 bg-surface px-3 sm:px-4 py-3 font-normal">
                              <span className="block text-sm text-ink">{label}</span>
                              {PERMISSION_HINTS[entry.permission] && (
                                <span className="mt-0.5 block max-w-80 text-xs text-ink-muted">{PERMISSION_HINTS[entry.permission]}</span>
                              )}
                            </th>
                            {roles.map((role) => (
                              <Cell
                                key={role.code}
                                role={role}
                                permission={entry.permission}
                                label={label}
                                held={heldBy(role.code).has(entry.permission)}
                                was={(savedSets[role.code] || new Set()).has(entry.permission)}
                                locked={!canManage || !entry.granted}
                                fixed={Boolean(role.is_fixed)}
                                error={problemsByRole[role.code]?.errors.get(entry.permission)?.message}
                                selected={selected?.code === role.code}
                                onToggle={toggle}
                              />
                            ))}
                          </tr>
                        );
                      })}
                  </tbody>
                );
              })}
              {groups.length === 0 && (
                <tbody>
                  <tr>
                    <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-ink-muted">
                      {t('roles.noMatch', { query })}
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>

          <p className="text-xs text-ink-subtle">
            {t('roles.footnote')}
            {canManage && ` ${t('roles.footnoteManage')}`}
          </p>
        </>
      )}

      {shown && (
        <AccessMatrix
          data={matrix.data}
          canManage={canManage}
          onEdit={(code) => {
            const role = roles.find((r) => r.code === code);
            if (role) setEditing({ role });
          }}
        />
      )}

      {/* Save bar */}
      {changedCodes.length > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl bg-ink px-4 py-3 text-canvas shadow-xl sm:flex-row sm:items-center sm:ps-5">
          <div className="min-w-0 flex-1 text-sm">
            {confirmEscalation ? (
              <p>
                <Trans t={t} i18nKey="roles.saveBar.escalation" components={{ b: <span className="font-semibold" /> }} />
              </p>
            ) : saveError ? (
              <p>
                <span className="font-semibold">{t('roles.saveBar.couldNotSave')}</span> {saveError}
              </p>
            ) : (
              <p>
                <Trans
                  t={t}
                  i18nKey="roles.saveBar.unsaved"
                  values={{ roles: changedCodes.map((code) => roles.find((r) => r.code === code)?.name).join(t('permJoin.list')) }}
                  components={{ b: <span className="font-semibold" /> }}
                />
                {blocked && <span className="opacity-80">{t('roles.saveBar.fixFirst')}</span>}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={confirmEscalation ? () => setConfirmEscalation(false) : discard}
              disabled={saving}
              className="h-9 rounded-lg border border-canvas/25 px-3.5 text-sm font-medium transition-colors hover:bg-canvas/10 disabled:opacity-50"
            >
              {confirmEscalation ? t('common:actions.back') : t('roles.saveBar.discard')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || blocked}
              className="h-9 rounded-lg bg-canvas px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t('common:status.saving') : confirmEscalation ? t('roleEditor.saveAnyway') : t('roleEditor.saveChanges')}
            </button>
          </div>
        </div>
      )}

      {editing && catalog && (
        <RoleEditorModal
          role={editing.role}
          readOnly={!canManage}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setSavedWarnings((saved?.warnings || []).map((warning) => ({ ...warning, role: saved.name })));
            afterWrite();
            if (saved?.code) setSelectedCode(saved.code);
          }}
        />
      )}

      {deleting && <DeleteRoleModal role={deleting} onClose={() => setDeleting(null)} onDeleted={afterWrite} />}
    </div>
  );
};

export default Roles;
