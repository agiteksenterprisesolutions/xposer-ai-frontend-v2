// src/components/sso-admin/ssoUtils.js
//
// Helpers for the "Sign-in for named reporters" admin screen (SSO.md §3).
//
// A connection is one place employees sign in: a Microsoft Entra directory,
// a Google Workspace, or "Email & password" (a work email confirmed by an
// emailed code). Microsoft and Google need the tenant's own app; Email &
// password has no app, secret or redirect URL, and sending those fields for
// it is a 422.

export const PROVIDERS = ['microsoft', 'google', 'password'];

/** Providers that sign in through the customer's own OAuth app. */
export const usesApp = (provider) => provider === 'microsoft' || provider === 'google';

// A domain like acmebank.sa: labels of letters, digits and hyphens.
const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

// Personal mailboxes: anyone can sign up, so they can't prove who works where.
// The server refuses these too (422); this only says so before saving.
export const PUBLIC_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'yahoo.com', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
  'proton.me', 'protonmail.com', 'gmx.com', 'mail.com', 'zoho.com', 'yandex.com',
]);

/** Lower case, no spaces, no leading "@" or "http(s)://". */
export const normalizeDomain = (text) =>
  text.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^@/, '').replace(/\/.*$/, '');

/** Why a domain can't be used: 'format' | 'public' | null. */
export const domainProblem = (domain) => {
  if (!DOMAIN.test(domain)) return 'format';
  if (PUBLIC_MAIL_DOMAINS.has(domain)) return 'public';
  return null;
};

export const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The form state for a connection (or a new one). The secret is never pre-filled. */
export const toForm = (c) => ({
  provider: c?.provider || 'microsoft',
  name: c?.name || '',
  entity_code: c?.entity_code || '',
  domains: c?.domains || [],
  ms_tenant_id: c?.ms_tenant_id || '',
  client_id: c?.client_id || '',
  client_secret: '',
  show_button: Boolean(c?.show_button),
  button_label: c?.button_label || '',
  enabled: c ? c.enabled !== false : true,
});

/**
 * The request body: everything for a new connection, only what changed for an
 * existing one. Email & password never sends the app fields; the secret only
 * goes when one was typed.
 */
export const toBody = (form, original = null) => {
  const app = usesApp(form.provider);
  const full = {
    name: form.name.trim(),
    entity_code: form.entity_code || null,
    domains: form.domains,
    show_button: form.show_button,
    button_label: form.show_button ? form.button_label.trim() || null : form.button_label.trim() || null,
    enabled: form.enabled,
  };
  if (app) {
    full.client_id = form.client_id.trim() || null;
    if (form.provider === 'microsoft') full.ms_tenant_id = form.ms_tenant_id.trim() || null;
  }
  if (!original) {
    const body = { ...full, provider: form.provider };
    if (app && form.client_secret) body.client_secret = form.client_secret;
    return body;
  }
  const before = toBody(toForm(original), null);
  const body = {};
  Object.keys(full).forEach((key) => {
    if (JSON.stringify(full[key]) !== JSON.stringify(before[key])) body[key] = full[key];
  });
  if (app && form.client_secret) body.client_secret = form.client_secret;
  return body;
};

/** The form field a problem or 422 error belongs to (`domains.taken` → domains). */
export const problemField = (field) => {
  const head = String(field || '').split('.')[0];
  return ['name', 'entity_code', 'domains', 'ms_tenant_id', 'client_id', 'client_secret', 'button_label', 'provider'].includes(head)
    ? head
    : null;
};

/** Split problems into those shown on a field and the rest. */
export const groupProblems = (problems = []) => {
  const byField = {};
  const general = [];
  problems.forEach((p) => {
    const field = problemField(p.field || p.code);
    if (field) (byField[field] ||= []).push(p);
    else general.push(p);
  });
  return { byField, general };
};
