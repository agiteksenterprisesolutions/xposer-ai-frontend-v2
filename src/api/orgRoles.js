// src/api/orgRoles.js
//
// The organization's own roles. Codes are organization-defined — only `admin`
// (fixed, root) is structural here, and `reporter` is never listed, being the
// public self-service identity rather than a staff role. Every role dropdown
// is populated from list(), never from a hardcoded set.
//
// Reading is staff-only (reporters get 403 staff_only); writing is admin-only.
// Each role carries `viewable_roles`: the role codes whose holders it can see
// on the users screen. `admin` can never be in it — admin accounts are seen
// by admins alone.
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
  list: async ({ activeOnly = true, quiet = false } = {}) => {
    const response = await api.get('/org-roles/', { params: { active_only: activeOnly }, skipErrorToast: quiet });
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

  /**
   * Create a role. `level_code` — the hierarchy level its holders sit at — is
   * required once the organization has any level (400 level_required, which
   * carries `available_levels`). The response carries `warnings` worth surfacing.
   */
  create: async ({ code, name, permissions, level_code: levelCode, viewable_roles: viewableRoles }) => {
    const response = await api.post(
      '/org-roles/',
      { code, name, permissions, level_code: levelCode ?? null, ...(viewableRoles ? { viewable_roles: viewableRoles } : {}) },
      inline,
    );
    return response.data;
  },

  /**
   * Who can see whom: `{ roles: [{ role, name, is_fixed, viewable_roles,
   * can_manage_users, can_manage_roles, targets: [{ role, name, can_view,
   * can_manage }] }] }`. Staff only.
   */
  accessMatrix: async () => {
    const response = await api.get('/org-roles/access-matrix', inline);
    return response.data;
  },

  /**
   * Rename, re-permission, move to another level or (de)activate. On the fixed
   * roles (admin, reporter) only `level_code` may change; anything else is 409.
   * A level move that would put someone at or above their manager is 409
   * level_move_inverts_chain, with `conflicts`.
   */
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
