// src/hooks/useOrgJurisdiction.js
//
// The signed-in user's organization (region, default pack and currency) and
// its default jurisdiction pack. `pack` is the active version, or the latest
// when none is active yet; `active` says which. A tenant with no pack, or a
// pack with no active version, behaves exactly as before.
import { useEffect, useState } from 'react';
import { jurisdictionAPI, organizationAPI } from '../api/jurisdiction';
import { useAuthStore } from '../store/authStore';

export function useOrgJurisdiction({ enabled = true } = {}) {
  const orgId = useAuthStore((s) => s.user?.organization_id);
  const [state, setState] = useState({ loading: true, organization: null, pack: null, versions: [], active: false, error: null });

  useEffect(() => {
    if (!enabled || !orgId) {
      setState((s) => ({ ...s, loading: false }));
      return undefined;
    }
    let live = true;
    (async () => {
      try {
        const organization = await organizationAPI.get(orgId);
        const code = organization?.default_jurisdiction_pack_code;
        let pack = null;
        let versions = [];
        if (code) {
          const result = await jurisdictionAPI.get(code).catch(() => null);
          pack = result?.pack || null;
          versions = result?.versions || [];
        }
        const active = Boolean(pack && versions.some((v) => v.version === pack.version && v.status === 'active'));
        if (live) setState({ loading: false, organization, pack, versions, active, error: null });
      } catch (error) {
        if (live) setState({ loading: false, organization: null, pack: null, versions: [], active: false, error });
      }
    })();
    return () => {
      live = false;
    };
  }, [orgId, enabled]);

  return state;
}
