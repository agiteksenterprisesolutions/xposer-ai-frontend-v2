// src/hooks/useCan.js
import { useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { getPermissions, satisfies } from '../utils/permissions';

/**
 * The access check for components. Gate on capability, never on who someone is:
 *
 *   const can = useCan();
 *   {can(PERM.agentManage) && <Button>New agent</Button>}
 *
 * `can(...perms)` is true only when every permission is held. For "any of",
 * pass a rule from ACCESS (or `{ any: [...] }`) instead: `can(ACCESS.caseReports)`.
 */
export function useCan() {
  const user = useAuthStore((state) => state.user);
  const permissions = getPermissions(user);
  const held = useMemo(() => new Set(permissions), [permissions]);

  return useCallback(
    (...needed) => {
      if (needed.length === 1 && needed[0] && typeof needed[0] === 'object') {
        return satisfies(held, needed[0]);
      }
      return needed.every((p) => held.has(p));
    },
    [held],
  );
}

export default useCan;
