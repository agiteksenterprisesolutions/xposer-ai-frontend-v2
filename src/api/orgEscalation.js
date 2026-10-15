// src/api/orgEscalation.js
//
// The escalation policy: what happens when a report is about someone in the
// directory. Reading needs org_hierarchy:read; saving needs
// org_hierarchy:manage.
//
// The GET brings the settings (detect_named_people, exclude_direct_reports,
// senior_level, senior_route, senior_tier) with everything the page's selects
// need (available_levels, available_roles, tiers), `directory_size` and
// `problems`. A PUT sends only what changed and answers in the same shape.
// There are no rules any more: `rules`, `trigger_field`, `enabled` and
// `match_named_people` are ignored by the server and never sent.
import api from './axios';

const inline = { skipErrorToast: true };

export const orgEscalationAPI = {
  get: async () => {
    const response = await api.get('/org-escalation/');
    return response.data;
  },

  /**
   * Only the changed fields. `senior_level: null` clears the level (leaving it
   * out means unchanged). 400 unknown_level / unknown_role.
   */
  update: async (changes) => {
    const response = await api.put('/org-escalation/', changes, inline);
    return response.data;
  },

  /**
   * Where one real report (a report number or an id) would go under the SAVED
   * policy, without doing it: { outcome, reason, senior, needs_review,
   * oversight_gap, raise_tier_to, escalate_to_member, escalate_to_role,
   * subjects, exclusions, steps }.
   */
  preview: async (reportId) => {
    const response = await api.post(`/org-escalation/preview/${encodeURIComponent(reportId)}`, null, inline);
    return response.data;
  },
};

export default orgEscalationAPI;
