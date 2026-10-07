// src/api/users.js
import api from './axios';
import { toast } from 'react-toastify';
import { blobDownload } from '../utils/download';

export const usersAPI = {
  // Get all users
  getAllUsers: async (params = {}) => {
    try {
      const response = await api.get('/users/', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create user
  createUser: async (data) => {
    try {
      const response = await api.post('/users/', data);
      toast.success('User created successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user by ID
  getUser: async (id) => {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update user
  updateUser: async (id, data) => {
    try {
      const response = await api.put(`/users/${id}`, data);
      toast.success('User updated successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Change a user's sign-in method (PATCH, unlike the full-record PUT above).
  // Switching to 'password' requires a new password in the same call; switching
  // to an SSO provider removes the stored password.
  updateAuthProvider: async (id, data) => {
    try {
      const response = await api.patch(`/users/${id}`, data);
      toast.success('Sign-in method updated successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Give a user another role (a role code from GET /org-roles/, or 'reporter').
  // Needs user:update plus user:manage_roles. Errors are left to the caller,
  // which shows the backend's sentence next to the picker.
  changeRole: async (id, role) => {
    const response = await api.put(`/users/${id}`, { role }, { skipErrorToast: true });
    return response.data;
  },

  // Change password
  changePassword: async (id, data) => {
    try {
      const response = await api.post(`/users/${id}/change-password`, data);
      toast.success('Password changed successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete user (deactivate)
  deleteUser: async (id) => {
    try {
      const response = await api.delete(`/users/${id}`);
      toast.success('User deactivated successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Activate user
  activateUser: async (id) => {
    try {
      const response = await api.post(`/users/${id}/activate`);
      toast.success('User activated successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user activity logs (if implemented)
  getUserActivity: async (userId, params = {}) => {
    try {
      const response = await api.get(`/users/${userId}/activity`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get user statistics
  getUserStats: async () => {
    try {
      const response = await api.get('/users/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Admin endpoints
  createSuperAdmin: async () => {
    try {
      const response = await api.post('/admin/create-super-admin');
      toast.success('Super admin created successfully!');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update password by admin
  updatePasswordByAdmin: async (id, data) => {
    try {
      const response = await api.post(`/users/${id}/reset-password`, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        withCredentials: true
      });
      // The new password reaches the person only by email; say so plainly
      // when it didn't go.
      if (response.data?.email_sent === false) {
        toast.warning('Password reset, but the email with it was not delivered — they still can’t sign in.');
      } else {
        toast.success('Password reset and sent to the user.');
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getAdminStats: async () => {
    try {
      const response = await api.get('/admin/stats');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Link an account to its directory entry (org_hierarchy_members.external_id),
   * or unlink it with "". The link is what report:read_subordinates resolves
   * from: an unlinked holder sees only their own caseload.
   */
  linkDirectoryEntry: async (id, hierarchyMemberId) => {
    const response = await api.put(`/users/${id}`, { hierarchy_member_id: hierarchyMemberId ?? '' }, { skipErrorToast: true });
    return response.data;
  },

  /**
   * Add one person: a directory entry, and a login when `create_login` is
   * true (then `role` is required). Replaces POST /users, which can create an
   * account with no directory entry. The account starts on the default
   * password and must change it at first sign-in.
   */
  createPerson: async (person) => {
    const response = await api.post('/users/person', person, { skipErrorToast: true });
    return response.data;
  },

  /** The blank people workbook, with a four-person example that imports as is. */
  downloadImportTemplate: async () => {
    const response = await api.get('/users/import/template', { responseType: 'blob' });
    return blobDownload(response, 'users_import_template.xlsx');
  },

  /**
   * One row → a login account, a directory entry and the link between them.
   * All-or-nothing; `dryRun` validates and stops. Problems come back together,
   * each with `sheet, row, column, value, code, message`.
   */
  importUsers: async (file, { dryRun = false } = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/users/import', formData, {
      params: { dry_run: dryRun },
      headers: { 'Content-Type': 'multipart/form-data' },
      skipErrorToast: true,
    });
    return response.data;
  },

  // Get system logs (if implemented)
  getSystemLogs: async (params = {}) => {
    try {
      const response = await api.get('/admin/logs', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};