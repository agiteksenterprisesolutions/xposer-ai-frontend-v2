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
// never on the code. The seeded roles — manager, officer, reviewer — are a
// starting point and fully editable.
//
// The rules the editor modal follows apply here too: a permission the
// signed-in user doesn't hold can't be granted (`granted: false`), each
// permission's `requires_any_of` is checked instantly, the server's
// /validate has the final word, and granting role:manage asks first.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { PERM, permissionLabel, permissionLabels } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';

const VALIDATE_DEBOUNCE_MS = 350;

const setKey = (permissions) => [...permissions].sort().join(',');

const sameSet = (a, b) => a.size === b.size && [...a].every((p) => b.has(p));

// ─── While the roles and the catalog load ───────────────────────────────

const SKELETON_ROLES = 6;

/** The summary card, legend and matrix, with the data stubbed. */
const RolesSkeleton = () => (
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
      <Skeleton.Text size="xs" className="ml-auto w-32" />
    </div>

    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-176 border-separate border-spacing-0 [&_td]:border-b [&_td]:border-line-subtle [&_th]:border-b [&_th]:border-line-subtle">
        <thead>
          <tr className="bg-subtle">
            <th className="w-72 min-w-52 bg-subtle px-4 py-3 text-left align-bottom text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
              Permission
            </th>
            {Array.from({ length: SKELETON_ROLES }).map((_, i) => (
              <th key={i} className="min-w-30 border-l border-line-subtle px-2 py-3">
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
            <th className="bg-subtle px-4 py-2.5 text-left">
              <Skeleton.Text size="xs" className="w-24" />
            </th>
            {Array.from({ length: SKELETON_ROLES }).map((_, i) => (
              <td key={i} className="border-l border-line-subtle">
                <Skeleton.Text size="xs" className="mx-auto w-6" />
              </td>
            ))}
          </tr>
          {Array.from({ length: 8 }).map((_, row) => (
            <tr key={row}>
              <th className="px-4 py-3 text-left font-normal">
                <Skeleton.Text className={row % 3 === 0 ? 'w-48' : 'w-36'} />
              </th>
              {Array.from({ length: SKELETON_ROLES }).map((_, i) => (
                <td key={i} className="border-l border-line-subtle text-center">
                  <Skeleton.Circle size="h-5 w-5" className="mx-auto" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

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
            {role.is_fixed ? <Lock className="h-4 w-4" /> : role.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-base font-bold text-ink">{role.name}</h2>
              {role.is_fixed && <Badge variant="dark" size="small">Fixed</Badge>}
              {role.is_active === false && <Badge variant="warning" size="small">Inactive</Badge>}
            </div>
            <p className="font-mono text-xs text-ink-subtle">{role.code}</p>
          </div>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          {people !== undefined && (
            <Stat label="People with this role" to={paths.users ? `${paths.users}?role=${encodeURIComponent(role.code)}` : null}>
              {people === null ? '—' : `${people} ${people === 1 ? 'person' : 'people'}`}
            </Stat>
          )}
          {agents !== undefined && (
            <Stat
              label="AI agents acting as it"
              to={agents.length && paths.agents ? `${paths.agents}?agent=${encodeURIComponent(agents[0].code)}` : null}
            >
              {agents.length === 0 ? 'None' : agents.map((a) => a.name).join(', ')}
            </Stat>
          )}
          <Stat label="Permissions">
            {draft.size} of {total}
            {changed && (
              <span className="ml-1.5 text-xs font-medium text-accent-fg">
                {added > 0 && `+${added}`}
                {added > 0 && removed > 0 && ' '}
                {removed > 0 && `−${removed}`} unsaved
              </span>
            )}
          </Stat>
        </div>

        <div className="flex shrink-0 gap-2">
          {role.is_fixed || !canManage ? (
            <Button variant="outline" size="small" onClick={onEdit}>
              View
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="small"
                startIcon={Pencil}
                onClick={onEdit}
                disabled={changed}
                title={changed ? 'Save or discard the changes in the grid first.' : 'Rename, deactivate or edit in a list'}
              >
                Edit details
              </Button>
              <Button variant="ghost" size="small" onClick={onDelete} aria-label={`Delete ${role.name}`} title="Delete role">
                <Trash2 className="h-4 w-4 text-danger-fg" />
              </Button>
            </>
          )}
        </div>
      </div>

      {role.is_fixed && (
        <p className="mt-3 text-xs text-ink-muted">
          {role.is_staff_role === false
            ? 'The identity people use to file and follow their own reports. Its permissions are fixed, and it cannot be edited or deleted.'
            : "The organization's root role. It always holds every permission this organization can grant, and cannot be edited or deleted."}
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
                <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
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
  const changed = held !== was;
  let mark = 'border-[1.5px] border-line-strong bg-surface';
  if (fixed) mark = held ? 'bg-active text-ink-muted' : 'border-[1.5px] border-line bg-surface';
  else if (error) mark = 'bg-danger-solid text-white ring-2 ring-danger-line';
  else if (held && changed) mark = 'border-[1.5px] border-dashed border-accent bg-accent-soft text-accent-fg';
  else if (held) mark = 'bg-accent text-on-accent';
  else if (changed) mark = 'border-[1.5px] border-dashed border-danger-line bg-danger-soft';

  const state = held ? 'allowed' : 'not allowed';
  const note = error || (changed ? (held ? 'will be allowed when saved' : 'will be removed when saved') : '');

  return (
    <td className={`border-l border-line-subtle p-0 text-center ${selected ? 'bg-accent-soft/40' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={held}
        aria-label={`${role.name}: ${label}, ${state}${note ? ` — ${note}` : ''}`}
        title={
          fixed
            ? `${role.name} is fixed`
            : locked
              ? "You can't grant a permission you don't hold yourself."
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
          {held && !error && <Check className="h-3 w-3" strokeWidth={3.2} />}
          {error && <span className="text-[11px] font-bold leading-none">!</span>}
        </span>
      </button>
    </td>
  );
};

// ─── The page ─────────────────────────────────────────────────────────────

const Roles = () => {
  useSEO({
    title: 'Roles',
    description: "Build your organization's roles from permissions.",
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
  const [selectedCode, setSelectedCode] = useState(null);
  const [drafts, setDrafts] = useState({}); // code → Set of permissions, for roles changed in the grid
  const [validations, setValidations] = useState({}); // code → { key, result }
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState({});
  const [agents, setAgents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmEscalation, setConfirmEscalation] = useState(false);

  const canSeePeople = can(PERM.userReadAll);
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
  const roles = allRoles;
  const entries = useMemo(() => catalogEntries(catalog), [catalog]);
  const total = catalog?.total ?? entries.size;

  // Who holds each role, and which agents act as it — context for the summary.
  const rolesKey = roles.map((r) => r.code).join(',');
  useEffect(() => {
    if (!canSeePeople || !rolesKey) return undefined;
    let cancelled = false;
    Promise.all(
      rolesKey.split(',').map((code) =>
        usersAPI
          .getAllUsers({ role: code, page: 1, page_size: 1 })
          .then((data) => [code, typeof data?.total === 'number' ? data.total : null])
          .catch(() => [code, null]),
      ),
    ).then((pairs) => !cancelled && setPeople(Object.fromEntries(pairs)));
    return () => {
      cancelled = true;
    };
  }, [rolesKey, canSeePeople]);

  useEffect(() => {
    if (!canSeeAgents) return;
    orgAgentsAPI
      .list()
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => setAgents([]));
  }, [canSeeAgents]);

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
      const next = new Set(prev[code] || savedSets[code] || []);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
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
        message: `You don't hold ${permissionLabels(server.not_grantable, ', ')} yourself, so you can't grant ${
          server.not_grantable.length === 1 ? 'it' : 'them'
        }.`,
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
    let savedCount = 0;
    for (const code of changedCodes) {
      const role = roles.find((r) => r.code === code);
      try {
        const saved = await orgRolesAPI.update(role.id, { permissions: [...drafts[code]] });
        (saved?.warnings || []).forEach((warning) => toast.warning(warning.message));
        savedCount += 1;
      } catch (err) {
        failed[code] = describeError(err);
      }
    }
    setSaving(false);
    if (savedCount) {
      invalidateOrgRoles();
      // Changing roles can change what the signed-in user holds.
      useAuthStore.getState().refreshUser();
      loadCatalog();
      toast.success(`${savedCount} role${savedCount === 1 ? '' : 's'} saved.`);
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
          <h1 className="text-xl font-bold text-ink">Roles &amp; Permissions</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            What each role can see and do. Pages, buttons and AI agents all follow from these ticks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 focus-within:border-line-accent">
            <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a permission"
              aria-label="Find a permission"
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
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {canManage && (
            <Button startIcon={Plus} onClick={() => setEditing({ role: null })} disabled={!catalog}>
              New role
            </Button>
          )}
        </div>
      </div>

      {catalogError && (
        <Alert variant="error" title="Couldn't load the permission catalog">
          {catalogError}
        </Alert>
      )}

      {error && !loading && (
        <Alert variant="error" title="Couldn't load roles">
          {errorSummary(error)}{' '}
          <button type="button" onClick={reload} className="font-medium text-link hover:underline">
            Try again
          </button>
        </Alert>
      )}

      {(loading || !catalog) && roles.length === 0 && !error && !catalogError && <RolesSkeleton />}

      {selected && catalog && (
        <RoleSummary
          role={selected}
          saved={savedSets[selected.code] || new Set()}
          draft={heldBy(selected.code)}
          total={total}
          people={canSeePeople ? (selected.code in people ? people[selected.code] : null) : undefined}
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

      {roles.length > 0 && catalog && (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-on-accent">
                <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
              </span>
              Allowed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-4 w-4 rounded-full border-[1.5px] border-line-strong" />
              Not allowed
            </span>
            {canManage && (
              <span className="flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-full border-[1.5px] border-dashed border-accent bg-accent-soft" />
                Unsaved change
              </span>
            )}
            <span className="hidden sm:inline">Select a role's name to see its summary.</span>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-ink-secondary">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4 rounded border-line-strong"
              />
              Show inactive roles
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line bg-surface scrollbar-thin">
            {/* Separated borders, drawn on the cells: collapsed borders spill a
                pixel past the table and made the box scroll sideways. */}
            <table className="w-full min-w-176 border-separate border-spacing-0 text-left [&_td]:border-b [&_td]:border-line-subtle [&_th]:border-b [&_th]:border-line-subtle [&>tbody:last-child>tr:last-child>*]:border-b-0">
              <thead>
                <tr className="border-b border-line bg-subtle">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-72 min-w-52 bg-subtle px-4 py-3 align-bottom text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle"
                  >
                    Permission
                  </th>
                  {roles.map((role) => {
                    const on = selected?.code === role.code;
                    const dirty = changedCodes.includes(role.code);
                    return (
                      <th
                        key={role.code}
                        scope="col"
                        className={`min-w-30 border-l border-line-subtle p-0 align-bottom ${
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
                            {role.is_fixed && <Lock className="h-3 w-3 text-ink-subtle" aria-label="Fixed role" />}
                            {role.name}
                          </span>
                          <span className="text-[11px] font-normal text-ink-subtle">
                            {heldBy(role.code).size} of {total}
                          </span>
                          {dirty && (
                            <span className="mt-0.5 rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-on-accent">
                              Unsaved
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
                      <th scope="rowgroup" className="sticky left-0 z-10 bg-subtle p-0">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.key)}
                          aria-expanded={open}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-ink-secondary"
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
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
                            className={`border-l border-line-subtle text-center text-[11px] font-semibold text-ink-subtle ${
                              selected?.code === role.code ? 'bg-accent-soft/40' : ''
                            }`}
                          >
                            {count}/{group.permissions.length}
                          </td>
                        );
                      })}
                    </tr>
                    {open &&
                      group.permissions.map((entry) => {
                        const label = permissionLabel(entry.permission);
                        return (
                          <tr key={entry.permission} className="border-b border-line-subtle last:border-b-0 hover:bg-hover/50">
                            <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 font-normal">
                              <span className="block text-sm text-ink">{label}</span>
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
                      No permission matches "{query}".
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>

          <p className="text-xs text-ink-subtle">
            Locked columns are fixed roles: admin and reporter can be inspected but not changed.
            {canManage && ' Greyed-out ticks are permissions you don\'t hold yourself, so you can\'t grant them.'}
          </p>
        </>
      )}

      {/* Save bar */}
      {changedCodes.length > 0 && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl bg-ink px-4 py-3 text-canvas shadow-xl sm:flex-row sm:items-center sm:pl-5">
          <div className="min-w-0 flex-1 text-sm">
            {confirmEscalation ? (
              <p>
                <span className="font-semibold">A role will be able to manage roles.</span> Anyone holding it can
                rewrite every role's permissions, including their own.
              </p>
            ) : saveError ? (
              <p>
                <span className="font-semibold">Couldn't save:</span> {saveError}
              </p>
            ) : (
              <p>
                Unsaved changes to{' '}
                <span className="font-semibold">
                  {changedCodes.map((code) => roles.find((r) => r.code === code)?.name).join(', ')}
                </span>
                {blocked && <span className="opacity-80"> — fix the marked ticks before saving</span>}
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
              {confirmEscalation ? 'Back' : 'Discard'}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || blocked}
              className="h-9 rounded-lg bg-canvas px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : confirmEscalation ? 'Save anyway' : 'Save changes'}
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
