// src/lib/authLog.js
//
// Tracing for the sign-in flows. Kept apart from src/lib/firebase.js so that
// code which only logs doesn't pull the Firebase SDK into the bundle every
// page loads (XPAI-228: no Google SDK on the public intake pages).
//
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
