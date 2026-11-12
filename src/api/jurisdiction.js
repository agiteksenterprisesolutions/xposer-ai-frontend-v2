// src/api/jurisdiction.js
//
// The organization record and its jurisdiction packs (epic XPAI-65), read-only
// for tenants. Packs are created and activated by the super admin; here a
// tenant only reads them. Every text field in a pack is { en, ar }.
import api from './axios';

// Packs change rarely; each response is fetched once per session.
const cache = new Map();
const once = (key, load) => {
  if (!cache.has(key)) {
    cache.set(
      key,
      load().catch((error) => {
        cache.delete(key);
        throw error;
      }),
    );
  }
  return cache.get(key);
};

export const organizationAPI = {
  /** { id, name, slug, region, region_pinned_at, default_jurisdiction_pack_code, default_currency, … }. */
  get: (id) => once(`org:${id}`, () => api.get(`/organizations/${id}`, { skipErrorToast: true }).then((r) => r.data)),
  /** Public: what a reporter's form needs (region, default_currency) before anyone signs in. */
  bySlug: (slug) =>
    once(`org-slug:${slug}`, () => api.get(`/organizations/by-slug/${encodeURIComponent(slug)}`, { skipErrorToast: true }).then((r) => r.data)),
};

export const jurisdictionAPI = {
  /** [{ code, name, region, latest_version, latest_status, active_version, latest_legal_review }]. */
  list: () => once('packs', () => api.get('/jurisdiction-packs/', { skipErrorToast: true }).then((r) => r.data || [])),
  /** { pack: active version (or latest), versions: [{ version, status, legal_review, created_at }] }. */
  get: (code) =>
    once(`pack:${code}`, () => api.get(`/jurisdiction-packs/${encodeURIComponent(code)}`, { skipErrorToast: true }).then((r) => r.data)),
  version: (code, version) =>
    once(`pack:${code}:${version}`, () =>
      api.get(`/jurisdiction-packs/${encodeURIComponent(code)}/versions/${version}`, { skipErrorToast: true }).then((r) => r.data),
    ),
  /** { code, weekend_days, timezone, holidays: [{ date, name }], calendar_version, updated_at }. */
  calendar: (code) =>
    once(`cal:${code}`, () =>
      api.get(`/jurisdiction-packs/${encodeURIComponent(code)}/calendar`, { skipErrorToast: true }).then((r) => r.data),
    ),
};

/** A `{ en, ar }` text in the UI's language (English here), falling back to the other. */
export const localized = (text) => {
  if (text === null || text === undefined) return '';
  if (typeof text === 'string') return text;
  return text.en || text.ar || '';
};
