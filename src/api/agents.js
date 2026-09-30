import axios from 'axios';
import api from './axios';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL;

const getAuthHeaders = () => {
  const token = useAuthStore.getState().token;
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const agentsAPI = {
  /**
   * Fetch the agent configuration for the current user's organization.
   * This includes orchestration mode and specific agent prompt instructions.
   */
  getConfig: async () => {
    const response = await axios.get(`${API_URL}/agent-config/`, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },

  /**
   * Update the agent configuration for the current user's organization.
   */
  updateConfig: async (data) => {
    const response = await axios.put(`${API_URL}/agent-config/`, data, {
      headers: getAuthHeaders(),
    });
    return response.data;
  },
};

/**
 * Agent knowledge base — organization-wide policy documents the agents may
 * quote. Everything is org-scoped from the JWT, so `organization_id` is never
 * sent; the backend ignores it by design.
 *
 * These calls go through the shared axios client so the token, the 401 logout
 * and the "detail" error toasts behave like the rest of the app.
 */
export const agentKbAPI = {
  /**
   * The agents a document can be assigned to: `{ agents: [{ code, name, kind,
   * role_code, role_source }], roles: [codes], all_agents_sentinel: "*" }`.
   * Only active agents carrying consult_kb appear, so refetch after any agent
   * or role change. Use `agents`; `roles` is the older shape.
   */
  listRoles: async () => {
    const response = await api.get('/agent-kb/roles');
    return response.data;
  },

  /**
   * Drop assignments pointing at agents that can no longer read them. A
   * document left with none is reassigned to every consulting agent
   * (`reassigned_to_all`). `dryRun` reports `{ changed, unchanged, changes[] }`
   * without writing. Nothing is re-parsed or re-embedded.
   */
  reconcile: async ({ dryRun = false } = {}) => {
    const response = await api.post('/agent-kb/reconcile', null, {
      params: { dry_run: dryRun },
      skipErrorToast: true,
    });
    return response.data;
  },

  /**
   * Upload one or more documents.
   *
   * Note the asymmetry with updateDocumentRoles: upload takes `roles` as a
   * single comma-separated form field, not JSON. Omitting it means all roles.
   * Returns 202 with every document at status "pending" — poll listDocuments.
   */
  uploadDocuments: async (files, roles = []) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    // Omitting `roles` means every consulting agent — stored as the "*"
    // sentinel — so "all agents" is sent as nothing at all.
    const specific = roles.filter((role) => role !== '*');
    if (specific.length > 0 && !roles.includes('*')) form.append('roles', specific.join(','));

    // The page shows the reason inline (including the "no agent can consult
    // the knowledge base" empty state), so no toast on top of it.
    const response = await api.post('/agent-kb/documents', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      skipErrorToast: true,
    });
    return response.data;
  },

  /** All documents for the organization, newest first. */
  listDocuments: async () => {
    const response = await api.get('/agent-kb/documents');
    return response.data;
  },

  /**
   * Change which agents may use a document. `roles` is a JSON array here —
   * unlike the comma-separated form field on upload. Nothing is re-embedded,
   * so this is cheap enough to wire straight to a checkbox.
   */
  updateDocumentRoles: async (documentId, roles) => {
    const response = await api.patch(`/agent-kb/documents/${documentId}`, { roles });
    return response.data;
  },

  /** Removes the document, its stored file and every vector from it. */
  deleteDocument: async (documentId) => {
    const response = await api.delete(`/agent-kb/documents/${documentId}`);
    return response.data;
  },
};

/**
 * Agent runs — a reduced, org-scoped view of what the AI did on each report.
 * Raw backend call logs and the officer's confidential note are deliberately
 * not exposed by the API.
 */
export const agentRunsAPI = {
  /** Run summaries, newest first. `limit` is 1–200 and defaults to 50. */
  listRuns: async (limit = 50) => {
    const response = await api.get('/agent-runs/', { params: { limit } });
    return response.data;
  },

  /** Full run detail, keyed by report_id (not report_number). */
  getRun: async (reportId) => {
    const response = await api.get(`/agent-runs/${reportId}`);
    return response.data;
  },

  /**
   * The summarizer's digest for one report — gated on agent:summary_read, not
   * agent:read, so the people working a case can read it without seeing every
   * agent's prompts and reasoning.
   *
   * "No digest" is a 200 with `available: false` and a `reason` (summarizer
   * switched off, no attachments…), which is normal. Only a report outside the
   * organization is a 404. No toast either way: the panel says it quietly.
   */
  getSummary: async (reportId) => {
    const response = await api.get(`/agent-runs/${reportId}/summary`, { skipErrorToast: true });
    return response.data;
  },
};
