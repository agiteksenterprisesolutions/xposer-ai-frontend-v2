// src/api/sso.js
//
// Company sign-in for named reporters (XPAI-108; docs: SSO.md).
//
// Reporters who report under their name sign in with their own company's
// Microsoft or Google (through the tenant's own app), or with a work email and
// password confirmed by an emailed code. The backend runs the whole sign-in;
// the frontend never sees a client id, secret or tenant id. Staff sign-in
// (Firebase) is unchanged, and the anonymous path never touches any of this.
//
// Errors carry detail.code and detail.message: show the message, use the code
// for behaviour (see SSO.md §2.9).
import api from './axios';

const enc = encodeURIComponent;
const quiet = { skipErrorToast: true };

export const ssoAPI = {
  // ── Reporter sign-in (public) ──────────────────────────────────────────
  /** Work email → `{ connection_id, provider: microsoft|google|password, label }`. */
  discover: async (slug, email) => (await api.post(`/auth/sso/${enc(slug)}/discover`, { email }, quiet)).data,
  /** → `{ authorization_url, expires_in }`; then window.location.assign(url). */
  start: async (slug, { connectionId, email = null, returnPath }) =>
    (await api.post(`/auth/sso/${enc(slug)}/start`, { connection_id: connectionId, email, return_path: returnPath }, quiet)).data,
  /** Once per state. → the same shape as POST /auth/login, plus `return_path`. */
  callback: async ({ connectionId, code, state }) =>
    (await api.post('/auth/sso/callback', { connection_id: connectionId, code, state }, quiet)).data,
  /** Email & password connections. */
  passwordLogin: async (slug, { email, password, returnPath }) =>
    (await api.post(`/auth/sso/${enc(slug)}/password/login`, { email, password, return_path: returnPath }, quiet)).data,
  /** Always 200: `{ sent, expires_in, resend_after, message }`, the same whether or not the email can sign in. */
  passwordCode: async (slug, email) => (await api.post(`/auth/sso/${enc(slug)}/password/code`, { email }, quiet)).data,
  passwordSet: async (slug, { email, code, password, returnPath }) =>
    (await api.post(`/auth/sso/${enc(slug)}/password/set`, { email, code, password, return_path: returnPath }, quiet)).data,

  // ── Admin: connections (sso:manage) ────────────────────────────────────
  listConnections: async () => (await api.get('/sso-connections/')).data,
  getConnection: async (id) => (await api.get(`/sso-connections/${enc(id)}`)).data,
  /** 201. 400 with detail.problems (nothing saved); 422 field errors. */
  createConnection: async (body) => (await api.post('/sso-connections/', body, quiet)).data,
  /** Send only what changes. `client_secret` replaces the stored one. */
  updateConnection: async (id, body) => (await api.put(`/sso-connections/${enc(id)}`, body, quiet)).data,
  deleteConnection: async (id) => (await api.delete(`/sso-connections/${enc(id)}`)).data,
  /** → `{ ok, checks: [{ check, ok, message }], connection }`. */
  testConnection: async (id) => (await api.post(`/sso-connections/${enc(id)}/test`, {}, quiet)).data,
};

/** The code and message of an SSO error. */
export const ssoError = (error) => {
  const detail = error?.response?.data?.detail;
  return {
    status: error?.response?.status ?? null,
    code: (detail && typeof detail === 'object' && detail.code) || null,
    message: (detail && typeof detail === 'object' && detail.message) || (typeof detail === 'string' ? detail : null),
  };
};

export default ssoAPI;
