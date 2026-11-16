// src/utils/passwordPolicy.js
//
// The password rules a new password must meet. The backend only refuses the
// shared default password (and Firebase's 6-character floor), so this client
// check is the only strength policy there is — keep every password form on it.
import { z } from 'zod';
import i18n from '../i18n';

// `label` is a getter so it reads in the current interface language.
const rule = (id, test) => ({
  id,
  test,
  get label() {
    return i18n.t(`password.rules.${id}`, { ns: 'common' });
  },
});

export const PASSWORD_RULES = [
  rule('length', (v) => v.length >= 8),
  rule('upper', (v) => /[A-Z]/.test(v)),
  rule('lower', (v) => /[a-z]/.test(v)),
  rule('number', (v) => /[0-9]/.test(v)),
  rule('symbol', (v) => /[^A-Za-z0-9]/.test(v)),
];

export const passwordMeetsPolicy = (value = '') => PASSWORD_RULES.every((rule) => rule.test(value));

// Messages are functions so they're translated when validation runs, not
// when this module loads.
const msg = (key) => () => ({ message: i18n.t(`password.errors.${key}`, { ns: 'common' }) });

/** current / new / confirm, with the policy on the new one. */
export const changePasswordSchema = z
  .object({
    current_password: z.string().refine((v) => v.length >= 1, msg('currentRequired')),
    new_password: z.string().refine(passwordMeetsPolicy, msg('policy')),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, () => ({
    ...msg('mismatch')(),
    path: ['confirm_password'],
  }))
  .refine((data) => data.new_password !== data.current_password, () => ({
    ...msg('sameAsCurrent')(),
    path: ['new_password'],
  }));

/** True while the account is still on the password it was created with. */
export const mustChangePassword = (user) => Boolean(user?.must_change_password);

/** Where a flagged account is sent; outside every layout so nothing else loads. */
export const SET_PASSWORD_PATH = '/set-password';
