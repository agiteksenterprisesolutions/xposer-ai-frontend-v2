// src/api/auth.js
import { toast } from 'react-toastify';
import api from './axios';
import { authLog, authError } from '../lib/firebase';

export const authAPI = {
  // User login - FastAPI OAuth2 format
  login: async (data) => {
    try {
      const params = new URLSearchParams();
      params.append('username', data.username);
      params.append('password', data.password);

      const response = await api.post('/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // Exchange a Firebase ID token for an app JWT.
  // The backend verifies the token with the Firebase Admin SDK and returns
  // the same { access_token, user } envelope as /auth/login.
  firebaseLogin: async (data) => {
    const endpoint = import.meta.env.VITE_FIREBASE_AUTH_ENDPOINT || '/auth/firebase/login';
    try {
      authLog(`exchanging ID token at ${import.meta.env.VITE_API_URL || ''}${endpoint}`, {
        provider: data.provider,
        email: data.profile?.email,
      });
      const response = await api.post(endpoint, {
        id_token: data.id_token,
        provider: data.provider || 'google',
        // Profile fields let the backend provision a user on first sign-in
        // without a second round-trip to the identity provider.
        email: data.profile?.email,
        full_name: data.profile?.full_name,
        photo_url: data.profile?.photo_url,
        organization_slug: data.organization_slug,
      });
      authLog('backend accepted the ID token', response.data);
      return response.data;
    } catch (error) {
      // The most common local failure is the endpoint not existing yet, so
      // name that case instead of surfacing a bare 404.
      const status = error.response?.status;
      authError(
        `POST ${endpoint} failed` +
        (status ? ` [${status}]` : ' (no response — backend unreachable or blocked by CORS)'),
        error.response?.data || error.message
      );
      if (status === 404 || status === 405) {
        authError(
          `${endpoint} is not implemented on the backend yet. It must verify the ` +
          'Firebase ID token with the Admin SDK and return { access_token, user }.'
        );
      }
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // Reporter login using report number + password
  reporterLogin: async (data) => {
    try {
      const response = await api.post('/auth/reporter/login', {
        report_number: data.report_number,
        password: data.password,
      });
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // Register - for public reporter accounts
  register: async (data) => {
    try {
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) =>
          value !== '' && value !== null && value !== undefined
        )
      );

      const response = await api.post('/auth/register', cleanedData);

      if (response.data) {
        toast.success('Registration successful! Please login.');
      }

      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // Logout (client-side only; JWT invalidation is handled client-side)
  logout: async () => {
    return true;
  },

  // Get current authenticated user profile + role (GET /users/me)
  getCurrentUser: async () => {
    try {
      const response = await api.get('/users/me');
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // Fetch the full role-permissions matrix from backend (GET /admin/roles-permissions)
  getRolesPermissions: async () => {
    try {
      const response = await api.get('/admin/roles-permissions');
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // Change password
  changePassword: async (data) => {
    try {
      const response = await api.post('/users/change-password', data);
      toast.success('Password changed successfully!');
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // Forgot password
  forgotPassword: async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      toast.success('Password reset instructions sent to your email.');
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  },

  // Reset password
  resetPassword: async (data) => {
    try {
      const response = await api.post('/auth/reset-password', data);
      toast.success('Password reset successfully!');
      return response.data;
    } catch (error) {
      if (error.response?.data) {
        throw error.response.data;
      }
      throw error;
    }
  }
};
