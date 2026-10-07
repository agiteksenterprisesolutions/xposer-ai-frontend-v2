// src/utils/usernames.js
//
// How the backend derives a login from a person: the Username given, else the
// email's local part — then prefixed with the organization's slug unless it
// already starts with it. Only the organization name is slugified; the
// username part passes through verbatim, so case and "+" survive into the
// login and sign-in must match them exactly. A preview catches that before an
// account is made.

/** "Acme Corp. (UK)" → "acme_corp_uk" */
export const orgUsernamePrefix = (organizationName = '') =>
  String(organizationName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** The login the backend will create, or '' when there's nothing to derive it from. */
export const deriveUsername = ({ username, email }, organizationName) => {
  const base = (username || '').trim() || String(email || '').split('@')[0].trim();
  if (!base) return '';
  const prefix = orgUsernamePrefix(organizationName);
  if (!prefix || base.startsWith(`${prefix}_`)) return base;
  return `${prefix}_${base}`;
};

/** True when the part after the prefix isn't plain lowercase — worth a nudge. */
export const usernameNeedsAttention = (derived, organizationName) => {
  const prefix = orgUsernamePrefix(organizationName);
  const tail = prefix && derived.startsWith(`${prefix}_`) ? derived.slice(prefix.length + 1) : derived;
  return Boolean(tail) && !/^[a-z0-9._-]+$/.test(tail);
};
