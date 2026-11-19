// src/hooks/useOrgPublic.js
//
// GET /organizations/by-slug/{slug}: the organization's public record. Among
// other things it says whether reporters can sign in with their company
// account (`sso`: { enabled, email_sign_in, buttons }, SSO.md §2.1).
//
// One request per slug per page load, shared by every caller.
import { useEffect, useState } from 'react';
import api from '../api/axios';

const cache = new Map();

const load = (slug) => {
  if (!cache.has(slug)) {
    cache.set(
      slug,
      api
        .get(`/organizations/by-slug/${encodeURIComponent(slug)}`, { skipErrorToast: true })
        .then((r) => r.data)
        .catch((error) => {
          cache.delete(slug);
          throw error;
        }),
    );
  }
  return cache.get(slug);
};

const NO_SSO = { enabled: false, email_sign_in: false, buttons: [] };

export function useOrgPublic(slug) {
  const [state, setState] = useState({ org: null, loading: Boolean(slug) });
  useEffect(() => {
    if (!slug) return undefined;
    let cancelled = false;
    load(slug)
      .then((org) => !cancelled && setState({ org, loading: false }))
      .catch(() => !cancelled && setState({ org: null, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return { ...state, sso: state.org?.sso || NO_SSO };
}

export default useOrgPublic;
