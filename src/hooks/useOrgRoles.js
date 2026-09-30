// src/hooks/useOrgRoles.js
//
// The organization's role list, shared by every screen that needs it (role
// dropdowns, assignee pickers, the team list) so a page with several consumers
// makes one request. Call invalidateOrgRoles() after any role write.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { orgRolesAPI } from '../api/orgRoles';
import { PERM } from '../utils/permissions';

const cache = new Map(); // activeOnly → Promise<role[]>
const listeners = new Set();

const load = (activeOnly) => {
  if (!cache.has(activeOnly)) {
    const request = orgRolesAPI.list({ activeOnly }).catch((error) => {
      cache.delete(activeOnly); // let the next caller retry
      throw error;
    });
    cache.set(activeOnly, request);
  }
  return cache.get(activeOnly);
};

/** Drop the cached role lists; mounted consumers refetch. */
export const invalidateOrgRoles = () => {
  cache.clear();
  listeners.forEach((notify) => notify());
};

/** reporter is never in /org-roles/ — it is the self-service identity. */
export const REPORTER_ROLE = 'reporter';

/** finance_lead → Finance lead, for a code with no role record to name it. */
export const humanizeRoleCode = (code) =>
  code ? code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ') : '';

/** True when holders of `role` can open reports someone could hand them. */
export const roleCanWorkReports = (role) =>
  Boolean(role?.permissions?.includes(PERM.reportReadAll) || role?.permissions?.includes(PERM.reportReadAssigned));

export function useOrgRoles({ activeOnly = true, enabled = true } = {}) {
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
    load(activeOnly)
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
  }, [activeOnly, enabled, version]);

  const byCode = useMemo(() => new Map(roles.map((role) => [role.code, role])), [roles]);

  /** Display name for a role code, including reporter and codes not (or no longer) listed. */
  const nameFor = useCallback(
    (code) => {
      if (code === REPORTER_ROLE) return 'Reporter';
      return byCode.get(code)?.name || humanizeRoleCode(code);
    },
    [byCode],
  );

  const reload = useCallback(() => invalidateOrgRoles(), []);

  return { roles, byCode, nameFor, loading, error, reload };
}

export default useOrgRoles;
