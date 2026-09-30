// src/api/orgAgents.js
//
// The organization's own AI agents. There are no hard-coded agents any more:
// an organization defines as many as it wants, each drawing its permissions
// from one of its roles (role_source "org_role") or an inline set ("custom").
//
// An agent's `capabilities` are what someone ticked; `effective_capabilities`
// are what will actually happen once intersected with the permissions its role
// carries, and `disabled_capabilities` explains the difference. That is
// resolved live, so a role edit can switch a capability off with no change to
// the agent — refetch agents after any role write.
//
// The writes skip the global error toast; the editor shows the structured
// problems inline. Read them off `error.normalised`.
import api from './axios';

const inline = { skipErrorToast: true };
const agentPath = (idOrCode) => `/org-agents/${encodeURIComponent(idOrCode)}`;

export const orgAgentsAPI = {
  /**
   * Kinds, role sources, the capability catalog (`{ capability, requires }`)
   * and `summarizer_forbidden_capabilities` (`{ capability, reason }`). The
   * editor is driven off this, never a hardcoded list.
   */
  capabilities: async () => {
    const response = await api.get('/org-agents/capabilities');
    return response.data;
  },

  /** Every agent; the server's default includes inactive ones. */
  list: async ({ activeOnly = false } = {}) => {
    const response = await api.get('/org-agents/', { params: { active_only: activeOnly } });
    return response.data;
  },

  /** One agent, by id or by code. */
  get: async (idOrCode) => {
    const response = await api.get(agentPath(idOrCode));
    return response.data;
  },

  create: async (agent) => {
    const response = await api.post('/org-agents/', agent, inline);
    return response.data;
  },

  /** `kind` and `code` are fixed at creation and not accepted here. */
  update: async (idOrCode, changes) => {
    const response = await api.put(agentPath(idOrCode), changes, inline);
    return response.data;
  },

  /** 409 while a workflow stage still runs the agent. */
  remove: async (idOrCode) => {
    const response = await api.delete(agentPath(idOrCode), inline);
    return response.data;
  },

  /**
   * Mint or rotate the agent's credential: `{ agent_code, token, note }`. The
   * token is shown once — only its hash is stored — and rotating invalidates
   * the previous one immediately.
   */
  mintToken: async (idOrCode) => {
    const response = await api.post(`${agentPath(idOrCode)}/token`, null, inline);
    return response.data;
  },

  revokeToken: async (idOrCode) => {
    const response = await api.delete(`${agentPath(idOrCode)}/token`, inline);
    return response.data;
  },

  /**
   * The organization's summarizer switch. `enabled` is what was asked for;
   * `active` is whether it will actually run, and `problems` says why when the
   * two disagree. Also: `resolved_agent`, `available_agents`,
   * `affected_stages`, and `access` — a read-only mirror of which roles hold
   * agent:summary_read.
   */
  getSummarizer: async () => {
    const response = await api.get('/org-agents/summarizer');
    return response.data;
  },

  /**
   * Any of `{ enabled, agent_code, include_attachments, max_words }`.
   * Switching off skips summarizer stages on the next run; it does not edit
   * the workflow, the agent or any role. max_words is 50–4000 (else 422); an
   * agent_code that isn't a summarizer-kind agent is a 400.
   */
  updateSummarizer: async (changes) => {
    const response = await api.put('/org-agents/summarizer', changes, inline);
    return response.data;
  },
};
