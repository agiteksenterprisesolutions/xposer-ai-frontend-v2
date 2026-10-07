// src/api/orgHierarchy.js
//
// The reporting hierarchy: the ladder that decides who a report escalates to.
// A report implicating a Finance Executive must reach someone above them — a
// Finance Manager — never their peers and never themselves.
//
//   levels    – the ladder. Any number; `rank` higher = more senior, with gaps
//               left on purpose so a tier can be slotted in later.
//   members   – the directory of people, from an HR sync and/or added by hand.
//               `level_code` and `manager_external_id` are the EFFECTIVE values
//               (a manual correction where one exists); `*_from_hr` are the raw
//               synced ones, for provenance only. Never compute the effective
//               value client-side.
//   coverage  – the "is it working" answer: unmapped job titles, vacant
//               levels, people with no manager on file.
//
// The writes skip the global error toast; screens render the structured
// problems ({row, field, message} for a bulk load) inline.
import api from './axios';

const inline = { skipErrorToast: true };

export const orgHierarchyAPI = {
  // ─── Levels ────────────────────────────────────────────────────────────
  /** Most senior first. */
  listLevels: async ({ activeOnly = true } = {}) => {
    const response = await api.get('/org-hierarchy/levels', { params: { active_only: activeOnly } });
    return response.data;
  },

  createLevel: async (level) => {
    const response = await api.post('/org-hierarchy/levels', level, inline);
    return response.data;
  },

  /** `code` is fixed at creation and not accepted here. */
  updateLevel: async (levelId, changes) => {
    const response = await api.put(`/org-hierarchy/levels/${levelId}`, changes, inline);
    return response.data;
  },

  deleteLevel: async (levelId) => {
    const response = await api.delete(`/org-hierarchy/levels/${levelId}`, inline);
    return response.data;
  },

  // ─── Directory ─────────────────────────────────────────────────────────
  listMembers: async ({ levelCode, activeOnly = true } = {}) => {
    const response = await api.get('/org-hierarchy/members', {
      params: { level_code: levelCode || undefined, active_only: activeOnly },
    });
    return response.data;
  },

  /** Add one person by hand. `external_id` is generated from the name if omitted. */
  createMember: async (member) => {
    const response = await api.post('/org-hierarchy/members', member, inline);
    return response.data;
  },

  /**
   * Correct one entry. `level_code` and `manager_external_id` are stored as
   * overrides, so they survive the next sync.
   */
  updateMember: async (memberId, changes) => {
    const response = await api.put(`/org-hierarchy/members/${memberId}`, changes, inline);
    return response.data;
  },

  /** A manual entry is removed; a synced one is only deactivated (a delete would be undone by the next sync). */
  deleteMember: async (memberId) => {
    const response = await api.delete(`/org-hierarchy/members/${memberId}`, inline);
    return response.data;
  },

  /**
   * Load many people at once. All-or-nothing: one bad row is a 400 with
   * `problems: [{ row, field, message }]` (row 1-indexed against `members`)
   * and nothing is written. `dryRun` validates without writing and answers
   * `{ would_create, external_ids }`.
   */
  bulkCreateMembers: async (members, { dryRun = false } = {}) => {
    const response = await api.post(
      '/org-hierarchy/members/bulk',
      { members },
      { ...inline, params: { dry_run: dryRun } },
    );
    return response.data;
  },

  // ─── HR sync ───────────────────────────────────────────────────────────
  /**
   * The HR connection, credential redacted (it reads back as "••••••••").
   * Resolves to null when none is configured yet, rather than a 404 toast.
   */
  getSyncConfig: async () => {
    try {
      const response = await api.get('/org-hierarchy/sync-config', inline);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  },

  /** Configure or replace the whole connection. */
  putSyncConfig: async (config) => {
    const response = await api.put('/org-hierarchy/sync-config', config, inline);
    return response.data;
  },

  /**
   * Change some fields. Leaving `credential` out keeps the stored one — the
   * credential is write-only, so an empty input means "unchanged".
   */
  patchSyncConfig: async (changes) => {
    const response = await api.patch('/org-hierarchy/sync-config', changes, inline);
    return response.data;
  },

  /**
   * Call the HR API through the saved mapping and report what would happen:
   * records_returned, would_upsert, would_skip_missing_id_or_name,
   * unmapped_designations, field_mapping_used and a sample of mapped rows.
   * Writes nothing.
   */
  previewSync: async ({ limit = 10 } = {}) => {
    const response = await api.post('/org-hierarchy/sync/preview', null, { ...inline, params: { limit } });
    return response.data;
  },

  /**
   * Pull now, over the live directory: { synced, matched_to_a_level,
   * unmatched_designations[], deactivated, synced_at }. An unreachable or
   * non-JSON HR API is a 502 and touches nothing already synced.
   */
  sync: async () => {
    const response = await api.post('/org-hierarchy/sync', null, inline);
    return response.data;
  },

  // ─── Org chart ─────────────────────────────────────────────────────────
  /**
   * Levels, most senior first, each with its role counts — one call, no
   * paging. A role chip drills into GET /users/?level_code=&role=. Read
   * `receives_escalations` (effective), not `can_receive_escalations` (stored).
   */
  chart: async () => {
    const response = await api.get('/org-hierarchy/chart');
    return response.data;
  },

  // ─── Sync approval queue ───────────────────────────────────────────────
  // People an HR sync found for the first time wait here until an admin sets
  // their level, role and whether they get a login. Oldest first.
  //   status: pending | approved | dismissed | all
  //   ready:  true → can be approved as they stand; false → still missing answers
  listPending: async ({ status = 'pending', search, ready } = {}) => {
    const params = { status_filter: status };
    if (search) params.search = search;
    if (ready !== undefined && ready !== null) params.ready = ready;
    const response = await api.get('/org-hierarchy/pending', { params });
    return response.data;
  },

  /** Saves answers on one person (id or external_id) without admitting them. */
  updatePending: async (id, decision) => {
    const response = await api.put(`/org-hierarchy/pending/${encodeURIComponent(id)}`, decision, inline);
    return response.data;
  },

  /** Same answer for many: `{ ids }` or `{ all_pending: true }`, plus `decision`. */
  bulkPending: async (body) => {
    const response = await api.post('/org-hierarchy/pending/bulk', body, inline);
    return response.data;
  },

  /**
   * Admits people. Per person, not all-or-nothing: a 200 carries `approved`
   * AND `problems`. `defaults` fill only what a person has not set.
   */
  approvePending: async ({ ids, defaults }) => {
    const response = await api.post('/org-hierarchy/pending/approve', { ids, defaults: defaults || null }, inline);
    return response.data;
  },

  /** Turned away, and skipped by later syncs. Reversible with restage. */
  dismissPending: async (id) => {
    const response = await api.post(`/org-hierarchy/pending/${encodeURIComponent(id)}/dismiss`, null, inline);
    return response.data;
  },

  restagePending: async (id) => {
    const response = await api.post(`/org-hierarchy/pending/${encodeURIComponent(id)}/restage`, null, inline);
    return response.data;
  },

  // ─── Health ────────────────────────────────────────────────────────────
  coverage: async () => {
    const response = await api.get('/org-hierarchy/coverage');
    return response.data;
  },

  /**
   * Who a report's free text escalates to. Both fields are top-level.
   * `matched: false` means nobody on file was named — a human decides — never
   * "nobody is implicated".
   */
  resolve: async ({ texts, department = null }) => {
    const response = await api.post('/org-hierarchy/resolve', { texts, department }, inline);
    return response.data;
  },
};
