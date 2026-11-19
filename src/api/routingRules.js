// src/api/routingRules.js
//
// Routing rules (XPAI-106; docs: ROUTING_RULES.md). Where a case goes and
// which flags it carries, set by the organization's admin (routing:manage).
// Active rules run in `priority` order (lower first) at submission: the first
// matching rule with an owner_role overrides the type's owner; flags add up;
// the tier only goes up. The conflict-of-interest policy always wins.
//
// Every rule comes back with `problems`: [{ code, severity: 'error' |
// 'warning', field, message }]. Errors block a save (400 with
// detail.problems); warnings are saved and shown.
import api from './axios';

const enc = encodeURIComponent;

export const routingRulesAPI = {
  /** `{ items, total }`, in the order they run. */
  list: async () => (await api.get('/routing-rules/')).data,
  get: async (id) => (await api.get(`/routing-rules/${enc(id)}`)).data,
  /** 201 with the rule and its problems. */
  create: async (rule) => (await api.post('/routing-rules/', rule, { skipErrorToast: true })).data,
  /** Send only what changes; `match` and `actions` are replaced whole. */
  update: async (id, changes) => (await api.put(`/routing-rules/${enc(id)}`, changes, { skipErrorToast: true })).data,
  remove: async (id) => (await api.delete(`/routing-rules/${enc(id)}`)).data,
  /** Every rule id once; priorities become 10, 20, 30…. Returns the list. */
  reorder: async (ruleIds) => (await api.put('/routing-rules/order', { rule_ids: ruleIds }, { skipErrorToast: true })).data,
  /**
   * Where a case would go; writes nothing.
   * `{ report_type_id, answers, entity_code }` → owner_role, flags, tier,
   * rules_applied, assignee, steps. 404 unknown type, 400 unknown entity.
   */
  preview: async (body) => (await api.post('/routing-rules/preview', body, { skipErrorToast: true })).data,
};

export default routingRulesAPI;
