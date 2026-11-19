// src/api/entities.js
//
// Legal entities and tenant defaults (XPAI-222/223/225/232; docs: ENTITIES.md).
//
// A tenant may have legal entities: companies in its group with their own
// legal settings. Five settings are inheritable: default_language, currency,
// jurisdiction_pack_code, calendar_pack_code, retention_years. `null` on an
// entity means "inherit the tenant's"; every entity response carries
// `effective[field] = { value, source: 'entity' | 'tenant' }`.
//
// A case's entity is fixed by the portal address the reporter used: reporters
// are never asked, the AI doesn't set it, staff can't change it.
import api from './axios';

/** The inheritable fields, in form order. */
export const INHERITABLE_FIELDS = ['default_language', 'currency', 'jurisdiction_pack_code', 'calendar_pack_code', 'retention_years'];

export const entitiesAPI = {
  /** entity:read. An entity admin gets only their own entity. */
  list: async ({ includeInactive = false } = {}) => {
    const response = await api.get('/entities/', { params: { include_inactive: includeInactive }, skipErrorToast: true });
    return Array.isArray(response.data) ? response.data : response.data?.items || [];
  },
  get: async (id) => (await api.get(`/entities/${encodeURIComponent(id)}`, { skipErrorToast: true })).data,
  /**
   * Tenant admin. Both names required (422 name_ar_required); 409
   * identifier_taken; 400 unknown_regulator (with `allowed`), unknown_pack,
   * pack_wrong_region.
   */
  create: async (body) => (await api.post('/entities/', body, { skipErrorToast: true })).data,
  /** Tenant admin. Send only what changes; `code` can't change. */
  update: async (id, body) => (await api.put(`/entities/${encodeURIComponent(id)}`, body, { skipErrorToast: true })).data,
  /**
   * The inheritable fields only, `null` = back to the tenant's. Tenant admin,
   * or that entity's own admin.
   */
  updateSettings: async (id, body) =>
    (await api.put(`/entities/${encodeURIComponent(id)}/settings`, body, { skipErrorToast: true })).data,
  /** Tenant admin. There is no delete: filed cases point at the entity. */
  deactivate: async (id) => (await api.post(`/entities/${encodeURIComponent(id)}/deactivate`)).data,
  activate: async (id) => (await api.post(`/entities/${encodeURIComponent(id)}/activate`)).data,
};

/**
 * The tenant's defaults every entity inherits (tenant:manage):
 * default_language, default_currency, default_retention_years (required,
 * 0 = forever, never cleared), default_calendar_pack_code; `platform`
 * (region, default pack) is read-only; `missing` lists required settings not
 * set yet.
 */
export const tenantSettingsAPI = {
  get: async () => (await api.get('/tenant-settings/', { skipErrorToast: true })).data,
  /** Send only what changes. */
  update: async (body) => (await api.put('/tenant-settings/', body, { skipErrorToast: true })).data,
};
