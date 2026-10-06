// src/api/orgEscalation.js
//
// Where a report goes when it implicates someone — configuration, not code.
// Reading needs org_hierarchy:read; saving needs org_hierarchy:manage.
//
// The settings come back with `available_levels` and `available_roles` (what
// a rule may target) and `problems` (empty_directory, unknown_level,
// unknown_role). A rule pointing at something missing is reported, not
// refused, because the level may be created next.
//
// `raise_tier_to` is a floor: applying a rule can raise a case's tier, never
// lower it. Switching `enabled` off keeps every rule.
import api from './axios';

const inline = { skipErrorToast: true };

export const orgEscalationAPI = {
  get: async () => {
    const response = await api.get('/org-escalation/');
    return response.data;
  },

  /** Any of `{ enabled, trigger_field, match_named_people, rules }`. */
  update: async (changes) => {
    const response = await api.put('/org-escalation/', changes, inline);
    return response.data;
  },

  /**
   * What the saved rules would do to one real report, without doing it:
   * `{ matched, reason, … }` plus the rule that matched.
   */
  preview: async (reportId) => {
    const response = await api.post(`/org-escalation/preview/${encodeURIComponent(reportId)}`, null, inline);
    return response.data;
  },
};

export default orgEscalationAPI;
