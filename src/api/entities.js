// src/api/entities.js
//
// Legal entities and tenant defaults (XPAI-222/223/224/225/232; docs:
// ENTITIES.md, PACK_HISTORY.md).
//
// A tenant may have legal entities: companies in its group with their own
// legal settings. Five settings are inheritable: default_language, currency,
// jurisdiction_pack_code, calendar_pack_code, retention_years. `null` on an
// entity means "inherit the tenant's"; every entity response carries
// `effective[field] = { value, source: 'entity' | 'tenant' }`.
//
// The two packs (jurisdiction, calendar) are dated (XPAI-224): they can be
// chosen when an entity is created, and afterwards only changed from a date
// through the pack history (packHistoryAPI). A new pack sent to PUT returns
// 422 use_pack_assignments, so edit forms never send them. The values on
// GET are the packs in force today.
//
// A case's entity is fixed by the portal address the reporter used: reporters
// are never asked, the AI doesn't set it, staff can't change it.
import api from './axios';

/** The inheritable fields, in form order. */
export const INHERITABLE_FIELDS = ['default_language', 'currency', 'jurisdiction_pack_code', 'calendar_pack_code', 'retention_years'];

/** The dated ones: set on create, then changed from a date (PACK_HISTORY.md). */
export const PACK_FIELDS = ['jurisdiction_pack_code', 'calendar_pack_code'];

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
 * 0 = forever, never cleared). default_jurisdiction_pack_code and
 * default_calendar_pack_code are read-only here: the packs in force today,
 * changed from a date through packHistoryAPI (tenant scope). `platform.region`
 * is set by the platform; `missing` lists required settings not set yet.
 */
export const tenantSettingsAPI = {
  get: async () => (await api.get('/tenant-settings/', { skipErrorToast: true })).data,
  /** Send only what changes. */
  update: async (body) => (await api.put('/tenant-settings/', body, { skipErrorToast: true })).data,
};

/**
 * Dated pack history (XPAI-224, PACK_HISTORY.md), for one entity or for the
 * tenant (what entities without their own pack follow).
 *
 *   scope: { entityId } for an entity, or null for the tenant.
 *
 * list → entries newest first, both kinds (jurisdiction first) unless `kind`:
 *   { id, kind, pack_code, pack_name, valid_from, valid_to, state:
 *     'current' | 'past' | 'scheduled', created_by: { username } | null, … }
 *   `pack_code` null: an entity follows the tenant; the tenant's calendar
 *   follows each case's own pack. `valid_to` is exclusive; null = open.
 *
 * add { kind, pack_code, valid_from: 'YYYY-MM-DD' } → the new entry. 409
 * pack_assignment_overlap (last_valid_from), before_latest_case
 * (latest_case_filed_at), no_change, concurrent_change; 400 unknown_pack,
 * pack_wrong_region; 422 pack_required (tenant jurisdiction).
 *
 * cancel: only the newest entry, only while scheduled. 409 already_started,
 * not_latest.
 *
 * Reading: entity:read (an entity admin only their own entity). Changing:
 * tenant admin only.
 */
const historyBase = (scope) =>
  scope?.entityId ? `/entities/${encodeURIComponent(scope.entityId)}/pack-assignments` : '/tenant-settings/pack-assignments';

export const packHistoryAPI = {
  list: async (scope, { kind } = {}) => {
    const response = await api.get(historyBase(scope), { params: kind ? { kind } : undefined, skipErrorToast: true });
    return Array.isArray(response.data) ? response.data : response.data?.items || [];
  },
  add: async (scope, body) => (await api.post(historyBase(scope), body, { skipErrorToast: true })).data,
  cancel: async (scope, assignmentId) =>
    (await api.delete(`${historyBase(scope)}/${encodeURIComponent(assignmentId)}`, { skipErrorToast: true })).data,
};
