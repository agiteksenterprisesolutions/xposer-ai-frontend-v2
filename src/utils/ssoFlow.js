// src/utils/ssoFlow.js
//
// The few things the company sign-in flow (SSO.md §2) carries across the
// round trip to Microsoft/Google, which leaves the app entirely.
//
// The backend keeps the real return_path (it is handed back by the
// callback); this tab only remembers the organization, so the callback page
// can offer "start again" when the reporter cancels or something fails before
// the backend answers. sessionStorage: this tab, nothing personal.
import { usePortalStore } from '../store/portalStore';

const KEY = 'xposer-sso-pending';

export const savePendingSso = ({ slug, returnPath }) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ slug, returnPath }));
  } catch {
    /* private mode: the callback falls back to the home page */
  }
};

export const readPendingSso = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};

export const clearPendingSso = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

/** Only a path on our own site: one leading "/", no "//host", no scheme. */
export const safeReturnPath = (path) =>
  typeof path === 'string' && /^\/(?!\/)/.test(path) && !/^\/\\/.test(path) ? path : null;

/**
 * Where to go once signed in. The return path is the portal page the reporter
 * started on (/acme or /acme/insurance): it is put back in the portal store,
 * so the report is filed under that address, and the reporter goes straight
 * on to the report form, which starts with "Before you report".
 */
export const afterSsoSignIn = (response, user, fallbackSlug) => {
  clearPendingSso();
  const slug = user?.organization_slug || response?.user?.organization_slug || fallbackSlug;
  const back = safeReturnPath(response?.return_path);
  if (back) {
    const [tenant, entity] = back.split(/[?#]/)[0].split('/').filter(Boolean);
    if (tenant && tenant === slug) usePortalStore.getState().enter(tenant, entity || null);
  }
  return slug ? `/${slug}/reporter/submit` : back || '/';
};
