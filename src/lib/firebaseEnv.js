// src/lib/firebaseEnv.js
//
// The Firebase project settings, read from the environment, without loading
// the Firebase SDK. The SDK itself (src/lib/firebase.js) is only imported
// on demand, when someone signs in with a password, Google or Microsoft, so
// the public intake pages never download or start it (XPAI-228).
//
//   const { signInWithProvider } = await loadFirebase();
export const firebaseConfig = {
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

/** Provider id Firebase reports for password accounts. */
export const AUTH_METHOD_PASSWORD = 'password';

/** The Firebase SDK and our wrappers around it, loaded on first use. */
export const loadFirebase = () => import('./firebase');
