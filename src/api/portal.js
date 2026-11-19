// src/api/portal.js
//
// Reporter portal addresses, branding and QR posters (XPAI-226, XPAI-227;
// docs: PORTAL.md).
//
//   Public (no sign-in):  GET /public/portal/{tenant}[/{entity}]
//                         GET /public/portal-logo/{tenant}[/{entity}]
//   Tenant admin:         /portal/addresses*            (portal:manage)
//   Tenant admin, or an   /portal/branding*  ?entity_code=…
//   entity admin for      /posters/*
//   their own entity
//
// Trailing slashes matter: /posters/ is the collection.
import api from './axios';

const enc = encodeURIComponent;
const entityParams = (entityCode) => (entityCode ? { params: { entity_code: entityCode } } : {});

/** "acme" or "acme/insurance" → the public path segment. */
const publicPath = (tenant, entity) => (entity ? `${enc(tenant)}/${enc(entity)}` : enc(tenant));

export const portalAPI = {
  // ── Public ──────────────────────────────────────────────────────────────
  /**
   * The public portal page. 404 (always `{"detail":"Not found"}`) for unknown,
   * switched-off, deactivated or expired addresses; 429 past 30 lookups a minute.
   */
  getPublicPortal: async (tenant, entity = null) => {
    const response = await api.get(`/public/portal/${publicPath(tenant, entity)}`, { skipErrorToast: true });
    return response.data;
  },

  /** Absolute URL of the portal logo, for an <img>. `logoUrl` comes from getPublicPortal. */
  logoSrc: (logoUrl, version = null) => {
    if (!logoUrl) return null;
    // logo_url is "/v2/public/portal-logo/…"; the API base already ends at the
    // version (…/v2, or another deployment's prefix), so join on what follows.
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
    const url = /^https?:/.test(logoUrl) ? logoUrl : `${base}${logoUrl.replace(/^\/v\d+(?=\/)/, '')}`;
    return version ? `${url}?v=${enc(version)}` : url;
  },

  // ── Addresses (tenant admin) ────────────────────────────────────────────
  getAddresses: async () => (await api.get('/portal/addresses')).data,

  /** `{ slug, is_active }`. 409 slug_taken, 422 reserved/invalid; may return `warnings`. */
  setAddress: async (entityCode, data) =>
    (await api.put(`/portal/addresses/${enc(entityCode)}`, data, { skipErrorToast: true })).data,

  removeAddress: async (entityCode) => (await api.delete(`/portal/addresses/${enc(entityCode)}`)).data,

  // ── Branding (tenant level, or one entity with entityCode) ─────────────
  /** `{ entity_code, own, effective, updated_at }`. */
  getBranding: async (entityCode = null) => (await api.get('/portal/branding', entityParams(entityCode))).data,

  /** Send only what changes; `null` clears a field (an entity then inherits). */
  updateBranding: async (data, entityCode = null) =>
    (await api.put('/portal/branding', data, { ...entityParams(entityCode), skipErrorToast: true })).data,

  /** PNG or JPEG, ≤ 512 KB. 413 logo_too_large, 415 logo_type, 400 logo_empty. */
  uploadLogo: async (file, entityCode = null) => {
    const form = new FormData();
    form.append('file', file);
    return (await api.put('/portal/branding/logo', form, {
      ...entityParams(entityCode),
      headers: { 'Content-Type': 'multipart/form-data' },
      skipErrorToast: true,
    })).data;
  },

  deleteLogo: async (entityCode = null) => (await api.delete('/portal/branding/logo', entityParams(entityCode))).data,

  /** The logo set at this level, as a Blob (404 when none). */
  getLogoBlob: async (entityCode = null) =>
    (await api.get('/portal/branding/logo', { ...entityParams(entityCode), responseType: 'blob', skipErrorToast: true })).data,

  // ── Posters ─────────────────────────────────────────────────────────────
  /** `{ items, total }`; each item has url, downloadable, not_downloadable_reason/_message. */
  getPosters: async () => (await api.get('/posters/')).data,
  getPoster: async (id) => (await api.get(`/posters/${enc(id)}`)).data,
  createPoster: async (data) => (await api.post('/posters/', data, { skipErrorToast: true })).data,
  /** Send only what changes. */
  updatePoster: async (id, data) => (await api.put(`/posters/${enc(id)}`, data, { skipErrorToast: true })).data,
  deletePoster: async (id) => (await api.delete(`/posters/${enc(id)}`)).data,
  /**
   * Everything needed to draw the poster: `{ poster, qr, branding }` with the
   * logo inlined as a data URL. 409 when there is no address to encode.
   */
  renderPoster: async (id) => (await api.get(`/posters/${enc(id)}/render`, { skipErrorToast: true })).data,
};

export default portalAPI;
