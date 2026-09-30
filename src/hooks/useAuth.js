// src/hooks/useAuth.js
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCan } from './useCan';
import { getHomePath } from '../utils/navigation';

/**
 * Authentication helpers for components.
 *
 * Access is decided by permission, never by role: roles are organization-
 * defined, so a role code says nothing reliable about what its holder may do.
 * Use `can` (see useCan) — `can(PERM.reportManage)` or `can(ACCESS.caseReports)`.
 */
export const useAuth = () => {
  const authStore = useAuthStore();
  const can = useCan();
  const { orgSlug } = useParams();
  const navigate = useNavigate();

  /** Login a system user by username or email */
  const login = async (username, password) => {
    const result = await authStore.login(username, password);
    if (result.success) return result;
    throw new Error(result.error);
  };

  /** Login a reporter using report number + password */
  const reporterLogin = async (reportNumber, password) => {
    const result = await authStore.reporterLogin(reportNumber, password);
    if (result.success) return result;
    throw new Error(result.error);
  };

  /** Register a new reporter account */
  const register = async (userData) => {
    const result = await authStore.register(userData);
    if (result.success) return result;
    throw new Error(result.error);
  };

  /** Logout and navigate to the login screen */
  const logout = () => {
    authStore.logout();
    navigate(`/${orgSlug}/login`);
  };

  /**
   * If already authenticated, go to the user's home page.
   * Returns true if a redirect occurred.
   */
  const redirectIfAuthenticated = () => {
    const home = authStore.isAuthenticated && getHomePath(authStore.user);
    if (!home) return false;
    navigate(home);
    return true;
  };

  /** Get display name: full_name first, then username */
  const getDisplayName = () => {
    if (authStore.user?.full_name) return authStore.user.full_name;
    return authStore.user?.username || 'User';
  };

  return {
    // State
    user: authStore.user,
    token: authStore.token,
    isAuthenticated: authStore.isAuthenticated,
    isLoading: authStore.isLoading,
    error: authStore.error,
    permissions: authStore.user?.permissions ?? [],

    // Actions
    login,
    reporterLogin,
    register,
    logout,
    refreshPermissions: authStore.refreshUser,

    // Access
    can,
    hasPermission: authStore.hasPermission,
    getDisplayName,

    // Route helpers
    redirectIfAuthenticated,

    // Error helpers
    clearError: authStore.clearError,
  };
};
