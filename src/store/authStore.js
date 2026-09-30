// src/store/authStore.js
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authAPI } from '../api';
import {
  signInWithPassword,
  signInWithProvider,
  completeRedirectSignIn,
  firebaseSignOut,
  describeFirebaseAuthError,
  AUTH_METHOD_PASSWORD,
  authLog,
  authError,
} from '../lib/firebase';
import { toast } from 'react-toastify';

// Firebase reports all of these as a flat "bad credential". The backend
// distinguishes them and returns a message written for the end user, so these
// codes are worth a second attempt against /auth/login rather than a guess.
const BACKEND_CAN_EXPLAIN = [
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-not-found',
];

// Shared by concurrent refreshUser() calls — module scope, never persisted.
let refreshInFlight = null;

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // ─── Auth State ──────────────────────────────────────────────
      user: null,
      token: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      fieldErrors: null,

      // Where the signed-in user's permissions stand. They live on
      // `user.permissions`, fetched from GET /users/me after every sign-in and
      // on every app start — the login responses do not promise to carry them.
      // 'idle' | 'loading' | 'ready' | 'error'
      permissionsStatus: 'idle',

      // ─── Login ───────────────────────────────────────────────────
      // Credentials live in Firebase, so an email address is verified by the
      // Firebase SDK and the resulting ID token goes to the same
      // /auth/firebase/login endpoint the Google and Microsoft buttons use.
      //
      // Usernames cannot take that path — Firebase has no username concept and
      // only the backend can resolve `acme_pat` to an email — so those fall
      // through to the form-encoded /auth/login, which verifies the password
      // against Firebase server-side. Same credentials, same result, one hop
      // further round.
      login: async (identifier, password) => {
        const trimmed = (identifier || '').trim();

        if (isEmailAddress(trimmed)) {
          authLog('login: identifier is an email — signing in through Firebase');
          set({ isLoading: true, error: null });

          let session;
          try {
            session = await signInWithPassword(trimmed, password);
          } catch (error) {
            // Firebase cannot tell "wrong password" apart from "this account
            // signs in with Google" — both surface as invalid-credential. The
            // backend can, and its message tells the user which button to
            // press instead, so a rejected credential is worth one more hop.
            if (BACKEND_CAN_EXPLAIN.includes(error?.code)) {
              authLog('login: Firebase rejected it — asking the backend for a specific reason');
              return get().passwordLoginViaBackend(trimmed, password);
            }

            const errorMessage = describeFirebaseAuthError(error, AUTH_METHOD_PASSWORD);
            authError('login: Firebase rejected the credentials:', errorMessage);
            set({ isLoading: false, error: errorMessage });
            return { success: false, error: errorMessage };
          }

          return get().exchangeFirebaseSession(session);
        }

        authLog('login: identifier is a username — using the backend /auth/login');
        return get().passwordLoginViaBackend(trimmed, password);
      },

      // ─── Username/password login through the backend ─────────────
      // The backend verifies the password with Firebase internally and returns
      // the same { access_token, user } envelope.
      passwordLoginViaBackend: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.login({ username, password });
          const { access_token, user } = response;

          set({
            user,
            token: access_token,
            role: user.role,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          const fullUser = await get().refreshUser();

          toast.success('Login successful!');
          return { success: true, user: fullUser || user };
        } catch (error) {
          const errorMessage = parseErrorMessage(error, 'Login failed');
          set({ isLoading: false, error: errorMessage });
          // toast.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // ─── Social Login (Firebase OAuth) ───────────────────────────
      // Two-step: Firebase proves who the user is, then the backend turns
      // that proof into our own JWT so the rest of the app is unchanged.
      // Returns { pending: true } when the popup was blocked and the browser
      // is mid-redirect — the caller should simply stop and let the page go.
      socialLogin: async (providerId = 'google', options = {}) => {
        set({ isLoading: true, error: null });
        authLog(`socialLogin(${providerId}) started`);
        let session;
        try {
          session = await signInWithProvider(providerId);
        } catch (error) {
          const errorMessage = describeFirebaseAuthError(error);
          if (errorMessage) {
            authError(`socialLogin(${providerId}) failed:`, errorMessage);
          } else {
            authLog(`socialLogin(${providerId}) cancelled by the user`);
          }
          set({ isLoading: false, error: errorMessage });
          // A null message means the user closed the popup themselves.
          return { success: false, cancelled: !errorMessage, error: errorMessage };
        }

        if (!session) {
          // Redirect flow took over; this page is on its way out.
          authLog(`socialLogin(${providerId}) handed off to the redirect flow`);
          return { success: false, pending: true };
        }

        return get().exchangeFirebaseSession(session, options);
      },

      // ─── Resume a redirect-based social login ────────────────────
      // Safe to call on every app start; resolves to null when there is no
      // pending redirect.
      resumeSocialLogin: async (options = {}) => {
        let session = null;
        try {
          session = await completeRedirectSignIn();
        } catch (error) {
          const errorMessage = describeFirebaseAuthError(error);
          if (errorMessage) set({ error: errorMessage });
          return null;
        }
        if (!session) return null;

        set({ isLoading: true, error: null });
        return get().exchangeFirebaseSession(session, options);
      },

      // ─── Firebase ID token → app JWT ─────────────────────────────
      exchangeFirebaseSession: async (session, options = {}) => {
        try {
          const response = await authAPI.firebaseLogin({
            id_token: session.idToken,
            provider: session.provider,
            profile: session.profile,
            organization_slug: options.organizationSlug,
          });
          const { access_token, user } = response;

          set({
            user,
            token: access_token,
            role: user?.role || null,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          const fullUser = await get().refreshUser();

          authLog('signed in as', { role: user?.role, org: user?.organization_slug });
          toast.success('Login successful!');
          return { success: true, user: fullUser || user };
        } catch (error) {
          // The app never got a session, so don't leave a half-signed-in
          // Firebase user behind to confuse the next attempt.
          firebaseSignOut().catch(() => { });
          authError('token exchange rejected by the backend', error);
          const errorMessage = parseErrorMessage(error, 'Login failed');
          set({ isLoading: false, error: errorMessage });
          return { success: false, error: errorMessage };
        }
      },

      // ─── Reporter Login ──────────────────────────────────────────
      reporterLogin: async (reportNumber, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.reporterLogin({
            report_number: reportNumber,
            password,
          });
          const { access_token, user } = response;

          set({
            user,
            token: access_token,
            role: user?.role || 'reporter',
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          toast.success('Login successful!');
          return { success: true, user };
        } catch (error) {
          const errorMessage = parseErrorMessage(error, 'Login failed');
          set({ isLoading: false, error: errorMessage });
          toast.error(errorMessage);
          return { success: false, error: errorMessage };
        }
      },

      // ─── Register ────────────────────────────────────────────────
      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.register(userData);

          set({ isLoading: false, error: null });

          if (response.access_token && response.user) {
            set({
              user: response.user,
              token: response.access_token,
              role: response.user.role,
              isAuthenticated: true,
            });
            const fullUser = await get().refreshUser();
            toast.success('Registration successful! You are now logged in.');
            return { success: true, data: { ...response, user: fullUser || response.user }, autoLoggedIn: true };
          }

          return { success: true, data: response, autoLoggedIn: false };
        } catch (error) {
          const { errorMessage, fieldErrors } = parseValidationError(error);
          set({ isLoading: false, error: errorMessage, fieldErrors });
          return { success: false, error: errorMessage, fieldErrors };
        }
      },

      // ─── Logout ──────────────────────────────────────────────────
      logout: () => {
        // Call backend logout (fire-and-forget)
        authAPI.logout().catch(() => { });
        // Drop the Firebase session too, otherwise the next social sign-in
        // silently reuses the old identity.
        firebaseSignOut().catch(() => { });

        set({
          user: null,
          token: null,
          role: null,
          isAuthenticated: false,
          error: null,
          fieldErrors: null,
          permissionsStatus: 'idle',
        });
        toast.success('Logged out successfully!');
      },

      // ─── Check Permission ──────────────────────────────────────────
      // True when the signed-in user holds a backend permission string, e.g.
      // hasPermission('report:read_all'). Components should prefer useCan().
      hasPermission: (permissionString) => {
        const permissions = get().user?.permissions;
        return Array.isArray(permissions) && permissions.includes(permissionString);
      },

      // ─── Setters ─────────────────────────────────────────────────
      setUser: (userData) => set({ user: userData }),
      setToken: (token) => set({ token }),
      clearError: () => set({ error: null }),
      clearFieldErrors: () => set({ fieldErrors: null }),

      getFieldError: (fieldName) => {
        const { fieldErrors } = get();
        return fieldErrors ? fieldErrors[fieldName] : null;
      },

      // ─── Refresh User ─────────────────────────────────────────────
      // Re-fetches /users/me, which carries the user's resolved permissions.
      // Call it after anything that could change them: a sign-in, a write to
      // /org-roles/, or a change to the signed-in user's own role. Concurrent
      // calls share one request. Resolves to the fresh user, or null.
      refreshUser: async () => {
        const { token, user } = get();
        // Anonymous tracking tokens belong to a report, not an account, and
        // have no /users/me to ask.
        if (!token || user?.is_anonymous) return null;
        if (refreshInFlight) return refreshInFlight;

        set({ permissionsStatus: 'loading' });
        refreshInFlight = (async () => {
          try {
            const userData = await authAPI.getCurrentUser();
            // Signed out while the request was in flight — don't resurrect it.
            if (get().token !== token) return null;
            const permissions = Array.isArray(userData?.permissions) ? userData.permissions : [];
            const merged = { ...get().user, ...userData, permissions };
            set({ user: merged, role: merged.role, permissionsStatus: 'ready' });
            return merged;
          } catch (error) {
            console.error('Failed to refresh user:', error);
            if (get().token === token) set({ permissionsStatus: 'error' });
            return null;
          } finally {
            refreshInFlight = null;
          }
        })();
        return refreshInFlight;
      },
    }),
    {
      name: 'xposerai-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
      // v3: permissions moved from a per-role matrix onto user.permissions.
      // Keep the session; the stale matrix is dropped and /users/me refetched.
      version: 3,
      migrate: (persisted) => {
        const { permissionMatrix: _dropped, ...rest } = persisted || {};
        return rest;
      },
    }
  )
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Good enough to decide which sign-in path to take. This is a routing
 * decision, not validation — if it guesses wrong the backend still gets the
 * final say, so a permissive check beats a strict one here.
 */
function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseErrorMessage(error, fallback = 'An error occurred') {
  if (error?.detail) {
    if (Array.isArray(error.detail)) {
      return error.detail.map((e) => e.msg).join(', ');
    }
    if (typeof error.detail === 'string') return error.detail;
  }
  return error?.message || fallback;
}

function parseValidationError(error) {
  let errorMessage = 'An error occurred';
  let fieldErrors = {};

  if (error?.detail) {
    if (Array.isArray(error.detail)) {
      error.detail.forEach((err) => {
        if (err.loc && err.loc.length >= 2) {
          fieldErrors[err.loc[1]] = err.msg;
        }
      });
      errorMessage =
        Object.keys(fieldErrors).length > 0
          ? Object.values(fieldErrors).join(', ')
          : error.detail.map((e) => e.msg).join(', ');
    } else if (typeof error.detail === 'string') {
      errorMessage = error.detail;
    }
  } else if (error?.message) {
    errorMessage = error.message;
  }

  return { errorMessage, fieldErrors };
}