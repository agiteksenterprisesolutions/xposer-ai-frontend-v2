// src/api/entities.js
//
// Legal entities (XPAI-83/84): the companies a tenant is made of, such as an
// insurer, a bank and a DIFC branch. Reporters are never asked which one a
// report is about; the AI agents infer it after submission, and staff can
// correct it on the case (PUT /reports/{id} with entity_code).
import api from './axios';

export const entitiesAPI = {
  /** Sorted by code. entity:read. */
  list: async ({ includeInactive = false } = {}) => {
    const response = await api.get('/entities/', { params: { include_inactive: includeInactive }, skipErrorToast: true });
    return Array.isArray(response.data) ? response.data : response.data?.items || [];
  },
  /** entity:manage. 409 when the code exists; 400 when the pack is from the other region. */
  create: async (body) => (await api.post('/entities/', body, { skipErrorToast: true })).data,
  /** Only the fields to change; `code` can't change (422). */
  update: async (id, body) => (await api.put(`/entities/${id}`, body, { skipErrorToast: true })).data,
  /** There is no delete: filed cases point at the entity. */
  deactivate: async (id) => (await api.post(`/entities/${id}/deactivate`)).data,
  activate: async (id) => (await api.post(`/entities/${id}/activate`)).data,
};
