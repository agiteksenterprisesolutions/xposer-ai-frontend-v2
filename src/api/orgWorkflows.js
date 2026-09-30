// src/api/orgWorkflows.js
//
// Workflows: the ordered stages a report runs through. Each stage names an
// executor — one of the organization's agents, or one of its human roles —
// and optionally where to go for each verdict. "Fully automated" and "fully
// human" are no longer modes; they are just which executor each stage has.
//
// A stage with no rule for the verdict it returned falls through to the next
// stage. Backward jumps are allowed; `max_stage_visits` (1–20) bounds them.
// Only one workflow is active at a time — activating one stands the others
// down.
//
// Writes skip the global toast; the builder pins problems to stage cards.
import api from './axios';

const inline = { skipErrorToast: true };

export const orgWorkflowsAPI = {
  list: async () => {
    const response = await api.get('/org-workflows/');
    return response.data;
  },

  /** The workflow a report submitted now would run. */
  active: async () => {
    const response = await api.get('/org-workflows/active', inline);
    return response.data;
  },

  get: async (workflowId) => {
    const response = await api.get(`/org-workflows/${workflowId}`);
    return response.data;
  },

  /**
   * Dry-run a stage list: `{ problems: [{ code, stage, message }] }` — every
   * problem at once. Empty problems means it would save and run. Saves nothing.
   */
  validate: async (stages) => {
    const response = await api.post('/org-workflows/validate', { stages }, inline);
    return response.data;
  },

  create: async (workflow) => {
    const response = await api.post('/org-workflows/', workflow, inline);
    return response.data;
  },

  /** Changing the stages bumps `version`; runs in flight keep the shape they started with. */
  update: async (workflowId, changes) => {
    const response = await api.put(`/org-workflows/${workflowId}`, changes, inline);
    return response.data;
  },

  /** 409 when it is the organization's only workflow. */
  remove: async (workflowId) => {
    const response = await api.delete(`/org-workflows/${workflowId}`, inline);
    return response.data;
  },
};
