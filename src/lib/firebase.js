// src/lib/firebase.js
// Firebase app + auth singleton. Only the Auth product is wired up — the
// app's data still lives behind the FastAPI backend, so Firebase is used
// purely as an identity provider (Google OAuth today, more providers later).
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  browserPopupRedirectResolver,
} from 'firebase/auth';

// Dev-only tracing for the OAuth handshake. Auth failures are hard to debug
// blind — the popup, the provider and the backend exchange each fail
// differently — so every step announces itself in development. Set
// VITE_AUTH_DEBUG=true to keep these on in a production build.
const AUTH_DEBUG = import.meta.env.DEV || import.meta.env.VITE_AUTH_DEBUG === 'true';

export function authLog(message, ...details) {
  if (AUTH_DEBUG) console.log(`[auth] ${message}`, ...details);
}

export function authError(message, ...details) {
  // Errors are never silenced: a broken sign-in in production needs a trail.
  console.error(`[auth] ${message}`, ...details);
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Lets the UI hide the social buttons entirely on a deployment that has no
// Firebase project configured, instead of rendering a button that throws.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId
);

if (!isFirebaseConfigured) {
  authError(
    'Firebase config incomplete — social sign-in is disabled. Missing:',
    Object.entries(firebaseConfig)
      .filter(([, value]) => !value)
      .map(([key]) => key)
      .join(', ') || '(none — but apiKey/authDomain/projectId are required)',
    '\nVite only reads .env at startup: restart `npm run dev` after editing it.'
  );
} else {
  authLog('config loaded', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    origin: window.location.origin,
  });
}

// getApps() guard keeps Vite HMR from re-initialising on every hot reload.
const app = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseAuth = app ? getAuth(app) : null;

const googleProvider = new GoogleAuthProvider();
// Always show the chooser: users on shared machines otherwise get silently
// signed back in as whoever used the browser last.
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Microsoft (Entra ID + personal accounts) rides Firebase's generic OIDC
// provider rather than a dedicated class.
const microsoftProvider = new OAuthProvider('microsoft.com');
microsoftProvider.setCustomParameters({
  prompt: 'select_account',
  // 'common' accepts both work/school and personal accounts. Set
  // VITE_MICROSOFT_TENANT_ID to a directory ID to lock sign-in to one tenant.
  tenant: import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common',
});
// Without these the token carries no email, and the backend has nothing to
// match an existing account against.
microsoftProvider.addScope('openid');
microsoftProvider.addScope('email');
microsoftProvider.addScope('profile');

const PROVIDERS = {
  google: googleProvider,
  microsoft: microsoftProvider,
};

/** Display names, used in log lines and button labels. */
export const PROVIDER_LABELS = {
  google: 'Google',
  microsoft: 'Microsoft',
};

function requireAuth() {
  if (!firebaseAuth) {
    authError('requireAuth: no Firebase Auth instance — config was incomplete at startup', firebaseConfig);
    throw new Error('Firebase is not configured. Set the VITE_FIREBASE_* environment variables.');
  }
  return firebaseAuth;
}

const POPUP_FALLBACK_CODES = [
  'auth/popup-blocked',
  'auth/operation-not-supported-in-this-environment',
  'auth/web-storage-unsupported',
];

/**
 * Runs the OAuth popup for the given provider and returns the Firebase ID
 * token (a signed JWT the backend verifies with the Firebase Admin SDK)
 * alongside the basic profile, so callers never touch the Firebase user object.
 *
 * Browsers that block third-party storage kill the popup flow, so those cases
 * fall back to a full-page redirect; `completeRedirectSignIn` picks it up on
 * the way back.
 */
export async function signInWithProvider(providerId = 'google') {
  const auth = requireAuth();
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unsupported auth provider: ${providerId}`);

  try {
    authLog(`opening ${providerId} popup…`);
    const credential = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    authLog('popup succeeded for', credential.user?.email);
    return await toSession(credential.user, providerId);
  } catch (error) {
    if (POPUP_FALLBACK_CODES.includes(error?.code)) {
      authLog(`popup unavailable (${error.code}) — falling back to full-page redirect`);
      // Hands control to the browser; the page unloads here and the result is
      // read back by completeRedirectSignIn() after the round-trip.
      await signInWithRedirect(auth, provider);
      return null;
    }
    authError(`popup failed [${error?.code || 'no-code'}]`, error);
    throw error;
  }
}

/**
 * Signs in with an email and password against Firebase and returns the same
 * session shape as signInWithProvider, so the caller can hand the ID token to
 * the identical backend exchange.
 *
 * Firebase keys accounts by email only — a username has no meaning here.
 * Callers must resolve a username to an email (or fall back to the backend's
 * form-encoded /auth/login) before calling this.
 */
export async function signInWithPassword(email, password) {
  const auth = requireAuth();
  authLog('signing in with email + password…');
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return toSession(credential.user, AUTH_METHOD_PASSWORD);
}

/** Provider id Firebase reports for password accounts. */
export const AUTH_METHOD_PASSWORD = 'password';

/**
 * Resolves the pending redirect sign-in, if there is one. Returns null on a
 * normal page load, so it is safe to call unconditionally at app start.
 */
export async function completeRedirectSignIn() {
  if (!firebaseAuth) return null;
  const credential = await getRedirectResult(firebaseAuth);
  if (!credential?.user) return null;
  authLog('redirect sign-in returned for', credential.user.email);
  return toSession(credential.user, credential.providerId || 'google');
}

export async function firebaseSignOut() {
  if (!firebaseAuth) return;
  await signOut(firebaseAuth);
}

async function toSession(user, providerId) {
  const idToken = await user.getIdToken();
  // The token is a bearer credential — log only enough to confirm one was
  // actually minted, never the whole thing.
  authLog(`ID token acquired (${idToken.length} chars) for ${user.email || user.uid}`);
  // Microsoft accounts frequently arrive with a null displayName/email on the
  // top-level user, so fall back to the provider-specific record.
  const providerProfile = user.providerData?.find((p) => p.providerId === providerId) || {};

  return {
    idToken,
    provider: providerId,
    profile: {
      uid: user.uid,
      email: user.email || providerProfile.email,
      full_name: user.displayName || providerProfile.displayName,
      photo_url: user.photoURL || providerProfile.photoURL,
      email_verified: user.emailVerified,
    },
  };
}

/**
 * Maps Firebase's error codes onto messages that make sense to an end user.
 *
 * `method` matters: several codes mean completely different things depending
 * on the flow. auth/invalid-credential is a misconfigured OAuth app during a
 * popup, but simply a wrong password during an email sign-in — showing the
 * console-configuration message to someone who fat-fingered their password
 * would be nonsense.
 */
export function describeFirebaseAuthError(error, method = 'oauth') {
  authLog(`mapping ${method} error [${error?.code || 'no-code'}]`, error?.message);

  const isPasswordFlow = method === AUTH_METHOD_PASSWORD;

  switch (error?.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // User backed out on purpose — not worth an error banner.
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      // Deliberately identical for all three: telling an attacker which half
      // was wrong turns the form into an account-enumeration oracle. Matches
      // the backend's own wording for the same case.
      if (isPasswordFlow) return 'Incorrect email or password';
      // Usually a provider that is enabled in Firebase but missing its
      // client ID / secret — common with Microsoft and its Entra app.
      return 'The sign-in provider is not configured correctly. Check its client ID and secret in the Firebase console.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      // Firebase's own rate limiter, mirroring the backend's 429 text.
      return 'Too many failed sign-in attempts. Please try again later.';
    case 'auth/operation-not-allowed':
      return isPasswordFlow
        ? 'Email and password sign-in is not enabled for this project.'
        : 'This sign-in provider is not enabled for the project. Enable it under Firebase Authentication → Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised for sign-in. Add it under Firebase Authentication → Settings → Authorized domains.';
    case 'auth/network-request-failed':
      return 'Network error while contacting the sign-in provider. Please try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    default:
      return error?.message || 'Sign-in failed. Please try again.';
  }
}
