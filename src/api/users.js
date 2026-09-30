// src/api/users.js
import api from './axios';
import { toast } from 'react-toastify';

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
      toast.success('Password updated successfully!');
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