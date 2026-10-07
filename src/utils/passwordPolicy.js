// src/utils/passwordPolicy.js
//
// The password rules a new password must meet. The backend only refuses the
// shared default password (and Firebase's 6-character floor), so this client
// check is the only strength policy there is — keep every password form on it.
import { z } from 'zod';

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'upper', label: 'An uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { id: 'lower', label: 'A lowercase letter', test: (v) => /[a-z]/.test(v) },
  { id: 'number', label: 'A number', test: (v) => /[0-9]/.test(v) },
  { id: 'symbol', label: 'A symbol, like ! or #', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export const passwordMeetsPolicy = (value = '') => PASSWORD_RULES.every((rule) => rule.test(value));

/** current / new / confirm, with the policy on the new one. */
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().refine(passwordMeetsPolicy, "The new password doesn't meet every rule below"),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'The passwords don’t match',
    path: ['confirm_password'],
  })
  .refine((data) => data.new_password !== data.current_password, {
    message: 'Choose a password different from the current one',
    path: ['new_password'],
  });

/** True while the account is still on the password it was created with. */
export const mustChangePassword = (user) => Boolean(user?.must_change_password);

/** Where a flagged account is sent; outside every layout so nothing else loads. */
export const SET_PASSWORD_PATH = '/set-password';
