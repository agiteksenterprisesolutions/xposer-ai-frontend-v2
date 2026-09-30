// src/utils/codes.js
//
// Codes are the stable slugs organization-defined things are referred to by —
// a role's code on a user, an agent's code in a workflow stage. Names change;
// codes never do.

export const CODE_PATTERN = /^[a-z][a-z0-9_]*$/;

export const CODE_HINT = 'Use lowercase letters, numbers and underscores, starting with a letter.';

/** "Finance Lead" → "finance_lead" — a suggestion the user can still edit. */
export const suggestCode = (name, prefix = 'x') =>
  (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, `${prefix}_$1`)
    .slice(0, 50);
