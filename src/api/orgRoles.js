// src/api/orgRoles.js
//
// The organization's own roles. Codes are organization-defined — only `admin`
// (fixed, root) is structural here, and `reporter` is never listed, being the
// public self-service identity rather than a staff role. Every role dropdown
// is populated from list(), never from a hardcoded set.
//
// The writes skip the global error toast: the roles editor renders the
// structured problems ({message, problems[]}) and the 403/409 guards inline,
// next to the thing that caused them. Read them off `error.normalised`.
//
// After any successful write, refresh the signed-in user's permissions
// (useAuthStore.getState().refreshUser()) and the cached role list
// (invalidateOrgRoles()): the server applies the change on the next request,
// but our cached copies do not know about it.
import api from './axios';

const inline = { skipErrorToast: true };

export const orgRolesAPI = {
  /**
   * All roles; `activeOnly` defaults to true, as on the server. The first
   * entry is the synthesised fixed admin role, whose id is the literal string
   * "admin" — ids here are not all ObjectIds.
   */
  list: async ({ activeOnly = true } = {}) => {
    const response = await api.get('/org-roles/', { params: { active_only: activeOnly } });
    return response.data;
  },

  /**
   * The permission catalog for the editor: `groups[]` of
   * `{ permission, granted, requires_any_of }`, plus `dependencies` and
   * `can_manage_roles`. `granted: false` means the caller does not hold that
   * permission and so cannot put it on a role.
   */
  catalog: async () => {
    const response = await api.get('/org-roles/permissions');
    return response.data;
  },

  /**
   * Dry-run a permission set: `{ valid, errors[], warnings[], not_grantable[] }`
   * — exactly what a save would say. Saves nothing.
   */
  validate: async (permissions) => {
    const response = await api.post('/org-roles/validate', { permissions }, inline);
    return response.data;
  },

  /** Create a role. The response carries a `warnings` array worth surfacing. */
  create: async ({ code, name, permissions }) => {
    const response = await api.post('/org-roles/', { code, name, permissions }, inline);
    return response.data;
  },

  /** Rename, re-permission or (de)activate. Fixed roles answer 409. */
  update: async (roleId, changes) => {
    const response = await api.put(`/org-roles/${encodeURIComponent(roleId)}`, changes, inline);
    return response.data;
  },

  /**
   * Delete. 409 when active users still hold the role, or when it is the last
   * role that can manage roles.
   */
  remove: async (roleId) => {
    const response = await api.delete(`/org-roles/${encodeURIComponent(roleId)}`, inline);
    return response.data;
  },
};
