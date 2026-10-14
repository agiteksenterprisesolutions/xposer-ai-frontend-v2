// src/hooks/useMemberNames.js
//
// Directory entries for a handful of employee ids — a page's managers, the
// accounts on a page of users — without loading the whole directory.
// Lookups are shared and cached (orgHierarchyAPI.membersByExternalId).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { orgHierarchyAPI } from '../api/orgHierarchy';

export function useMemberNames(ids, { enabled = true } = {}) {
  const key = useMemo(() => [...new Set((ids || []).filter(Boolean))].sort().join('\u0000'), [ids]);
  const [found, setFound] = useState(() => new Map());
  const [pending, setPending] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !key) {
      setPending(false);
      return undefined;
    }
    let live = true;
    setPending(true);
    orgHierarchyAPI
      .membersByExternalId(key.split('\u0000'))
      .then((map) => live && setFound((prev) => new Map([...prev, ...map])))
      .finally(() => live && setPending(false));
    return () => {
      live = false;
    };
  }, [key, enabled, tick]);

  const memberOf = useCallback((id) => (id ? found.get(id) || null : null), [found]);
  const nameOf = useCallback((id) => memberOf(id)?.name || null, [memberOf]);
  /** After a write: forget what was found and ask again. */
  const refresh = useCallback(() => {
    setFound(new Map());
    setTick((t) => t + 1);
  }, []);

  return { memberOf, nameOf, refresh, lookup: { pending } };
}
