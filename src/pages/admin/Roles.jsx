// src/pages/admin/Roles.jsx
//
// Roles & permissions. An organization builds its own roles from the
// permission catalog; access everywhere in the app follows from them. Two
// codes are structural: `admin` (fixed, shown read-only) and `reporter` (the
// public self-service identity, not listed here at all). The seeded roles —
// manager, officer, reviewer — are a starting point and fully editable.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Lock, Pencil, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import RoleEditorModal from '../../components/roles/RoleEditorModal';
import DeleteRoleModal from '../../components/roles/DeleteRoleModal';
import { orgRolesAPI } from '../../api/orgRoles';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { errorSummary } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';

const actionLabel = (permission) => {
  const action = permission.slice(permission.indexOf(':') + 1);
  return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, ' ');
};

/** A role's permissions, bucketed under the catalog's own group labels. */
const groupForDisplay = (permissions, catalog) => {
  const held = new Set(permissions);
  const groups = (catalog?.groups || [])
    .map((group) => ({
      key: group.key,
      label: group.label,
      permissions: group.permissions.map((entry) => entry.permission).filter((p) => held.has(p)),
    }))
    .filter((group) => group.permissions.length > 0);

  const catalogued = new Set(groups.flatMap((group) => group.permissions));
  const other = permissions.filter((p) => !catalogued.has(p));
  if (other.length) groups.push({ key: '_other', label: 'Other', permissions: other });
  return groups;
};

const RoleCard = ({ role, catalog, canManage, onEdit, onDelete }) => {
  const groups = useMemo(() => groupForDisplay(role.permissions || [], catalog), [role.permissions, catalog]);
  const count = role.permissions?.length || 0;

  return (
    <Card padding="none" className={`overflow-hidden ${role.is_active === false ? 'opacity-70' : ''}`}>
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-active">
            {role.is_fixed ? <Lock className="h-5 w-5 text-ink-muted" /> : <Shield className="h-5 w-5 text-ink-muted" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-ink">{role.name}</h3>
              {role.is_fixed && <Badge variant="dark" size="small">Fixed</Badge>}
              {role.is_system_default && !role.is_fixed && <Badge variant="secondary" size="small">Default</Badge>}
              {role.is_active === false && <Badge variant="warning" size="small">Inactive</Badge>}
            </div>
            <p className="mt-0.5 font-mono text-xs text-ink-subtle">
              {role.code} · {count} permission{count === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {role.is_fixed || !canManage ? (
            <Button variant="outline" size="small" startIcon={Eye} onClick={() => onEdit(role)}>
              View
            </Button>
          ) : (
            <>
              <Button variant="outline" size="small" startIcon={Pencil} onClick={() => onEdit(role)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="small"
                onClick={() => onDelete(role)}
                aria-label={`Delete ${role.name}`}
                title="Delete role"
              >
                <Trash2 className="h-4 w-4 text-danger-fg" />
              </Button>
            </>
          )}
        </div>
      </div>

      {groups.length > 0 && (
        <div className="grid gap-x-6 gap-y-2 border-t border-line-subtle bg-subtle px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.key} className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{group.label}</p>
              <p className="mt-0.5 text-xs text-ink-secondary">{group.permissions.map(actionLabel).join(' · ')}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const Roles = () => {
  useSEO({
    title: 'Roles',
    description: "Build your organization's roles from permissions.",
    noIndex: true,
  });
  const can = useCan();
  const [showInactive, setShowInactive] = useState(false);
  const { roles, loading, error, reload } = useOrgRoles({ activeOnly: !showInactive });

  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState(null);
  const [editing, setEditing] = useState(null); // { role } — role null means create
  const [deleting, setDeleting] = useState(null);

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

  // Saving may change what the signed-in user holds — and so what the catalog
  // lets them grant — so it is refetched with the role list.
  const afterWrite = () => {
    setEditing(null);
    setDeleting(null);
    loadCatalog();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-ink">Roles &amp; permissions</h1>
          <p className="mt-1 text-sm text-ink-muted">
            What each person can see and do comes from the permissions on their role.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
              className="h-4 w-4 rounded border-line-strong"
            />
            Show inactive
          </label>
          <Button
            variant="outline"
            startIcon={RefreshCw}
            onClick={() => {
              reload();
              loadCatalog();
            }}
            disabled={loading}
          >
            Refresh
          </Button>
          {canManage && (
            <Button startIcon={Plus} onClick={() => setEditing({ role: null })} disabled={!catalog}>
              New role
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-subtle">
        Reporters aren't listed: the reporter identity is how the public files and follows their own reports, and
        isn't a staff role your organization manages.
      </p>

      {catalogError && (
        <Alert variant="error" title="Couldn't load the permission catalog">
          {catalogError}
        </Alert>
      )}

      {loading && roles.length === 0 && (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-line bg-surface p-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-active" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 rounded bg-active" />
                  <div className="h-2 w-48 rounded bg-active" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <Alert variant="error" title="Couldn't load roles">
          {errorSummary(error)}{' '}
          <button type="button" onClick={reload} className="font-medium text-link hover:underline">
            Try again
          </button>
        </Alert>
      )}

      {!error && roles.length > 0 && (
        <div className="space-y-4">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              catalog={catalog}
              canManage={canManage}
              onEdit={(r) => catalog && setEditing({ role: r })}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      {editing && catalog && (
        <RoleEditorModal
          role={editing.role}
          readOnly={!canManage}
          catalog={catalog}
          onClose={() => setEditing(null)}
          onSaved={afterWrite}
        />
      )}

      {deleting && <DeleteRoleModal role={deleting} onClose={() => setDeleting(null)} onDeleted={afterWrite} />}
    </div>
  );
};

export default Roles;
