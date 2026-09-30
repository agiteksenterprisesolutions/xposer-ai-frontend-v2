// src/utils/authProviders.js
// The backend keys every system user to a Firebase sign-in method. This is the
// single source of truth for what those values mean, so the UI never has to
// compare raw strings like 'google.com' in a dozen places.

export const AUTH_PROVIDERS = {
  PASSWORD: 'password',
  GOOGLE: 'google.com',
  MICROSOFT: 'microsoft.com',
};

/** Maps our short button/provider ids onto the backend's auth_provider values. */
export const PROVIDER_ID_TO_AUTH_PROVIDER = {
  google: AUTH_PROVIDERS.GOOGLE,
  microsoft: AUTH_PROVIDERS.MICROSOFT,
};

export const AUTH_PROVIDER_LABELS = {
  [AUTH_PROVIDERS.PASSWORD]: 'Password',
  [AUTH_PROVIDERS.GOOGLE]: 'Google',
  [AUTH_PROVIDERS.MICROSOFT]: 'Microsoft',
};

/** Options for the create/edit-user sign-in method selector. */
export const AUTH_PROVIDER_OPTIONS = [
  { value: AUTH_PROVIDERS.PASSWORD, label: 'Password' },
  { value: AUTH_PROVIDERS.GOOGLE, label: 'Google (SSO)' },
  { value: AUTH_PROVIDERS.MICROSOFT, label: 'Microsoft (SSO)' },
];

/**
 * True for accounts that own a password. Accounts created before the Firebase
 * migration have no auth_provider at all, and the backend defaults those to
 * 'password' — so a missing value must read as a password account, not SSO.
 */
export function isPasswordAccount(user) {
  const provider = user?.auth_provider;
  return !provider || provider === AUTH_PROVIDERS.PASSWORD;
}

/** True when sign-in goes through Google/Microsoft, so password UI must hide. */
export function isSSOAccount(user) {
  return !isPasswordAccount(user);
}

export function authProviderLabel(authProvider) {
  return AUTH_PROVIDER_LABELS[authProvider] || AUTH_PROVIDER_LABELS[AUTH_PROVIDERS.PASSWORD];
}
