// src/api/axios.js
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-toastify';
import { normaliseError } from '../utils/errors';
import { SET_PASSWORD_PATH } from '../utils/passwordPolicy';

const API_URL = import.meta.env.VITE_API_URL || 'https://demo.agiteks.com/wbbe';

// Endpoints whose failures are displayed inline by the sign-in forms.
const SIGN_IN_ENDPOINTS = ['/auth/login', '/auth/firebase/login', '/auth/register'];

// Endpoints where a 401 is about the *report's* credentials, not the user's
// session. Looking up someone's report number with the wrong password must not
// sign the person out of their account — which is exactly what happened when a
// signed-in reporter mistyped a password on the tracking form.
const REPORT_CREDENTIAL_ENDPOINTS = ['/reports/track'];

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// A request can opt out of the toasts below with `{ skipErrorToast: true }` in
// its config — for screens that render the structured problems inline (a
// role's permission errors, a bulk import's bad rows), where a toast would only
// repeat the summary above them.
//
// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const authHeader = error.config?.headers?.Authorization || error.config?.headers?.authorization;
      const hasAuthContext = Boolean(authHeader || useAuthStore.getState().token);
      // Sign-in attempts render the backend's message inline on the form, and
      // those messages are written for end users ("No account exists for this
      // email…"). A toast here would either duplicate them or, worse, replace
      // them with something generic.
      const isSignInAttempt = SIGN_IN_ENDPOINTS.some((path) => error.config?.url?.includes(path));
      const isReportCredentialCheck = REPORT_CREDENTIAL_ENDPOINTS.some((path) =>
        error.config?.url?.includes(path),
      );
      const quiet = isSignInAttempt || Boolean(error.config?.skipErrorToast);
      // Every shape — the 400 {message, problems}, the 422 list, the 403/409
      // string — read one way. Attached so callers need not re-parse it.
      error.normalised = normaliseError(data);

      // Handle specific error cases
      switch (status) {
        case 401:
          if (hasAuthContext && !isSignInAttempt && !isReportCredentialCheck) {
            useAuthStore.getState().logout();
            if (!window.location.pathname.includes('/login')) {
              toast.error('Session expired. Please login again.');
              window.location.href = '/login';
            }
          }
          break;
        case 403:
          // The account is still on its default password. Not an access
          // problem — send the person to set one, and say nothing else.
          if (data?.detail?.code === 'password_change_required') {
            useAuthStore.getState().markPasswordChangeRequired();
            if (!window.location.pathname.startsWith(SET_PASSWORD_PATH)) window.location.assign(SET_PASSWORD_PATH);
            break;
          }
          if (!quiet) {
            // Prefer the backend's wording — 403 also covers "This account has
            // been disabled" and expired organisation subscriptions, which the
            // generic permission message would hide.
            toast.error(typeof data?.detail === 'string' ? data.detail : 'You do not have permission to perform this action.');
          }
          // Permissions resolve per request on the server, so a 403 usually
          // means ours are stale — a role was edited since we last asked.
          // Refetch so the UI stops offering what the server now refuses.
          if (hasAuthContext && !error.config?.url?.includes('/users/me')) {
            useAuthStore.getState().refreshUser();
          }
          break;
        case 429:
          if (!quiet) {
            toast.error(typeof data?.detail === 'string' ? data.detail : 'Too many requests. Please try again later.');
          }
          break;
        case 404:
          if (!quiet) toast.error('Resource not found.');
          break;
        case 422:
          // Validation errors handled by forms
          break;
        case 500:
          if (!quiet) toast.error('Server error. Please try again later.');
          break;
        default:
          // 400 business rules, 409 guards, 502 upstream failures, … — the
          // normalised summary is always a string, where `detail` may be an
          // object that would crash the toast.
          if (quiet) break;
          if (data?.detail || data?.message) toast.error(error.normalised.summary);
      }
    } else if (error.request) {
      toast.error('Network error. Please check your connection.');
    } else {
      console.error('Error:', error.message);
    }

    return Promise.reject(error);
  }
);

export default api;
