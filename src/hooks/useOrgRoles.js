// src/hooks/useOrgRoles.js
//
// The organization's role names, shared by every screen that needs them (role
// dropdowns, labels, filters, assignee pickers) so a page with several
// consumers makes one request. Call invalidateOrgRoles() after any role write.
//
// GET /org-roles/ — every role with `permissions` and `viewable_roles` — is
// admin only (role:manage), for Roles & Permissions. Everyone else reads a
// narrower list, with names and levels but no permissions:
//   source 'visible' (default) GET /users/visible-roles — their own role and
//                              the roles whose users they can see;
//   source 'owners'            GET /report-types/owner-roles — every staff
//                              role, for the report-type owner pickers.
// An admin always gets the full list. Missing `permissions` mean unknown,
// never empty.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { orgRolesAPI } from '../api/orgRoles';
import { usersAPI } from '../api/users';
import { reportTypesAPI } from '../api/reportTypes';
import { ACCESS, PERM, getPermissions, satisfies } from '../utils/permissions';
import { useAuthStore } from '../store/authStore';

const cache = new Map(); // `${source}:${activeOnly}` → Promise<role[]>
const listeners = new Set();

// Where the narrower lists aren't available (a backend that predates them, or
// one failing), fall back quietly to /org-roles/, which still answers there.
const legacy = (activeOnly) => orgRolesAPI.list({ activeOnly, quiet: true });

const fetchers = {
  all: (activeOnly) => orgRolesAPI.list({ activeOnly }),
  visible: (activeOnly) => usersAPI.visibleRoles().catch(() => legacy(activeOnly)),
  // Needs report_type:manage; an agent or workflow editor without it still
  // gets the roles they can see.
  owners: (activeOnly) => reportTypesAPI.ownerRoles().catch(() => fetchers.visible(activeOnly)),
};

const load = (source, activeOnly) => {
  const key = `${source}:${activeOnly}`;
  if (!cache.has(key)) {
    const request = fetchers[source](activeOnly)
      .then((data) => (Array.isArray(data) ? data : []))
      .catch((error) => {
        cache.delete(key); // let the next caller retry
        throw error;
      });
    cache.set(key, request);
  }
  return cache.get(key);
};

/** Drop the cached role lists; mounted consumers refetch. */
export const invalidateOrgRoles = () => {
  cache.clear();
  listeners.forEach((notify) => notify());
};

/**
 * The public self-service identity. /org-roles/ lists it with
 * is_staff_role: false; it is never a role to assign staff to.
 */
export const REPORTER_ROLE = 'reporter';

/** True for a role staff can hold — everything except reporter. */
export const isStaffRole = (role) => role?.is_staff_role !== false && role?.code !== REPORTER_ROLE;

/** finance_lead → Finance lead, for a code with no role record to name it. */
export const humanizeRoleCode = (code) =>
  code ? code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ') : '';

/**
 * True when holders of `role` can open reports someone could hand them.
 * Non-admins get roles without `permissions` (GET /org-roles/ is trimmed for
 * them); then it can't be told here, so it's left to the server to refuse.
 */
export const roleCanWorkReports = (role) =>
  !Array.isArray(role?.permissions) ||
  [PERM.reportReadAll, PERM.reportReadSubordinates, PERM.reportReadAssigned].some((p) => role.permissions.includes(p));

export function useOrgRoles({ activeOnly = true, enabled: wanted = true, source: wantedSource = 'visible' } = {}) {
  // Never from a reporter's page, or with nobody signed in.
  const isStaff = useAuthStore((state) => Boolean(state.user) && !state.user.is_anonymous && satisfies(getPermissions(state.user), ACCESS.roleNames));
  const isAdmin = useAuthStore((state) => getPermissions(state.user).includes(PERM.roleManage));
  const source = isAdmin ? 'all' : wantedSource;
  const enabled = wanted && isStaff;
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const notify = () => setVersion((v) => v + 1);
    listeners.add(notify);
    return () => listeners.delete(notify);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setLoading(true);
    load(source, activeOnly)
      .then((data) => {
        if (cancelled) return;
        setRoles(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, activeOnly, enabled, version]);

  // Every listed role, reporter included, so any code can be named.
  const byCode = useMemo(() => new Map(roles.map((role) => [role.code, role])), [roles]);
  // What pickers offer: staff roles only. A screen that may also make someone
  // a reporter adds that option itself.
  const staffRoles = useMemo(() => roles.filter(isStaffRole), [roles]);

  /** Display name for a role code, including reporter and codes not (or no longer) listed. */
  const nameFor = useCallback(
    (code) => {
      if (code === REPORTER_ROLE) return 'Reporter';
      return byCode.get(code)?.name || humanizeRoleCode(code);
    },
    [byCode],
  );

  const reload = useCallback(() => invalidateOrgRoles(), []);

  return { roles: staffRoles, allRoles: roles, byCode, nameFor, loading, error, reload };
}

export default useOrgRoles;
