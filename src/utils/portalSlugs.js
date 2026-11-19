// src/utils/portalSlugs.js
//
// Rules for an entity's portal address slug (PORTAL.md §2): 3–40 characters,
// lowercase letters, digits and single hyphens.
//
// Two reserved lists. The backend refuses its own (422). This app also has
// pages directly under /:orgSlug (/acme/pricing, /acme/track-report…), and
// react-router matches those before /:orgSlug/:entitySlug, so an entity given
// one of these slugs would never reach its portal. Keep APP_RESERVED in step
// with the first-level routes under /:orgSlug in App.jsx (and ask the backend
// to reserve them too).
export const BACKEND_RESERVED = [
  'admin', 'api', 'www', 'app', 'login', 'logout', 'static', 'assets', 'help',
  'sso', 'callback', 'auth', 'public', 'portal', 'report', 'reports', 'track',
  'status', 'settings', 'dashboard', 'logo',
];

export const APP_RESERVED = [
  'pricing', 'privacy', 'terms', 'cookie-policy', 'compliance', 'security',
  'how-to-use', 'checkout', 'contact', 'forget-password', 'register',
  'submit-anonymous', 'track-report', 'report-details', 'edit-draft',
  'reporter', 'staff', 'reviewer', 'set-password',
];

const RESERVED = new Set([...BACKEND_RESERVED, ...APP_RESERVED]);

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Upper case folded to lower, surrounding space dropped (as the server does). */
export const normalizePortalSlug = (value = '') => value.trim().toLowerCase();

/**
 * Why a slug can't be used, or null when it can:
 * 'required' | 'length' | 'format' | 'reserved'.
 */
export const portalSlugProblem = (value) => {
  const slug = normalizePortalSlug(value);
  if (!slug) return 'required';
  if (slug.length < 3 || slug.length > 40) return 'length';
  if (!SLUG_PATTERN.test(slug)) return 'format';
  if (RESERVED.has(slug)) return 'reserved';
  return null;
};
