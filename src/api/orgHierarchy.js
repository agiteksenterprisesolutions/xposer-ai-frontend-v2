// src/api/orgHierarchy.js
//
// The reporting hierarchy: the ladder that decides who a report escalates to.
// A report implicating a Finance Executive must reach someone above them — a
// Finance Manager — never their peers and never themselves.
//
//   levels    – the ladder. Any number; `rank` higher = more senior, with gaps
//               left on purpose so a tier can be slotted in later. A level's
//               `roles` are derived from the roles that sit at it (read-only).
//   members   – the directory of people, from an HR sync and/or added by hand.
//               A person is placed by their ROLE: each role sits at one level
//               (org_roles.level_code), so `member.level_code` is resolved
//               from `role_code` and can't be written. `level_from` is "role",
//               or "legacy" for an entry not yet given a role.
//               `manager_external_id` is the effective manager (a manual
//               correction where one exists), `manager_external_id_from_hr`
//               the synced one.
//   coverage  – the "is it working" answer: unmapped job titles, vacant
//               levels, people with no manager on file.
//
// The writes skip the global error toast; screens render the structured
// problems ({row, field, message} for a bulk load) inline.
import api from './axios';

const inline = { skipErrorToast: true };

// Directory entries seen in any response, by employee id — so a manager
// named on one page can be labelled without loading the whole directory.
// Writes clear it.
const memberCache = new Map();
const rememberMember = (member) => member?.external_id && memberCache.set(member.external_id, member);
export const forgetMembers = () => memberCache.clear();

export const orgHierarchyAPI = {
  // ─── Levels ────────────────────────────────────────────────────────────
  /** Most senior first. */
  listLevels: async ({ activeOnly = true, quiet = false } = {}) => {
    const response = await api.get('/org-hierarchy/levels', { params: { active_only: activeOnly }, skipErrorToast: quiet });
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
  /**
   * One page of the directory: { items, page, page_size, total, total_pages,
   * has_next, has_previous }. `search` matches name, email, job title,
   * department and employee id (literal, case-insensitive); `levelCode` is a
   * LEVEL code, not a role. Filters combine with AND and `total` counts the
   * matches. page_size max 200.
   */
  listMembers: async ({ page = 1, pageSize = 50, search, levelCode, activeOnly = true, quiet = false } = {}) => {
    const response = await api.get('/org-hierarchy/members', {
      params: {
        page,
        page_size: pageSize,
        search: search?.trim() || undefined,
        level_code: levelCode || undefined,
        active_only: activeOnly,
      },
      skipErrorToast: quiet,
    });
    const data = response.data;
    if (Array.isArray(data)) {
      // An older backend answered with the whole directory.
      return { items: data, page: 1, page_size: data.length, total: data.length, total_pages: 1, has_next: false, has_previous: false };
    }
    data.items.forEach(rememberMember);
    return data;
  },

  /**
   * The directory entries for these employee ids — for labelling a manager or
   * a linked account without loading the whole directory. Answers a Map;
   * an id that isn't on file is absent. Cached per id for the session.
   */
  membersByExternalId: async (ids) => {
    const wanted = [...new Set(ids.filter(Boolean))];
    await Promise.all(
      wanted
        .filter((id) => !memberCache.has(id))
        .map(async (id) => {
          try {
            // `search` is a substring match, so keep only the exact id.
            const { items } = await orgHierarchyAPI.listMembers({ search: id, pageSize: 20, activeOnly: false, quiet: true });
            memberCache.set(id, items.find((m) => m.external_id === id) || null);
          } catch {
            // Unknown, not missing: ask again next time.
          }
        }),
    );
    return new Map(wanted.filter((id) => memberCache.get(id)).map((id) => [id, memberCache.get(id)]));
  },

  /** Add one person by hand. `external_id` is generated from the name if omitted. */
  createMember: async (member) => {
    forgetMembers();
    const response = await api.post('/org-hierarchy/members', member, inline);
    return response.data;
  },

  /**
   * Correct one entry: `role_code` (which places them, and also updates every
   * linked account's role) and `manager_external_id`, kept as an override so
   * it survives the next sync. 400 manager_not_above / role_has_no_level.
   */
  updateMember: async (memberId, changes) => {
    forgetMembers();
    const response = await api.put(`/org-hierarchy/members/${memberId}`, changes, inline);
    return response.data;
  },

  /** A manual entry is removed; a synced one is only deactivated (a delete would be undone by the next sync). */
  deleteMember: async (memberId) => {
    forgetMembers();
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
    if (!dryRun) forgetMembers();
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
    forgetMembers();
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

  /**
   * The org chart by person, one node at a time:
   *   { root, ancestors, children, page, page_size, total, total_pages, has_next, has_previous }
   * Without `root` you're above the top: `root` is null and `children` are
   * everyone with no manager on file (several, and anyone whose manager was
   * deleted). Every node carries `direct_report_count`, so an expand arrow
   * needs no fetch. `ancestors` (nearest manager first, capped at 20) are
   * breadcrumbs only — no account fields, no counts. 404: `root` isn't in
   * this organization.
   */
  peopleChart: async ({ root, page = 1, pageSize = 50, quiet = false } = {}) => {
    const response = await api.get('/org-hierarchy/chart/people', {
      params: { root: root || undefined, page, page_size: pageSize },
      skipErrorToast: quiet,
    });
    const data = response.data;
    rememberMember(data.root);
    data.children?.forEach(rememberMember);
    return data;
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
    forgetMembers();
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
