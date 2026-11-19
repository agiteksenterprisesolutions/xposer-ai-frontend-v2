// src/utils/agents.js
//
// Shared vocabulary for the AI agent surfaces: knowledge-base document limits
// and statuses, and the way an agent run is labelled. The limits mirror the
// backend's own validation so a doomed upload is rejected before it is sent —
// the server validates the whole batch up front, so one bad file rejects all
// of them and nothing is stored.
//
// Labels are getters (or functions) that read the current interface language
// each time, so the exported shapes stay the same for every caller.
import i18n from '../i18n';

const tr = (key, options) => i18n.t(key, { ns: 'agents', ...options });

/** Extensions the backend will accept. Binary formats are parsed server-side. */
export const KB_ACCEPTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.rtf', '.txt', '.md', '.markdown', '.csv', '.json',
];

/** `accept` attribute for the file input — extensions are enough here. */
export const KB_ACCEPT_ATTR = KB_ACCEPTED_EXTENSIONS.join(',');

export const KB_MAX_FILES_PER_REQUEST = 10;
export const KB_MAX_DOCUMENTS_PER_ORG = 50;
export const KB_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Ingestion states, in the order they occur. `spinner` marks the unsettled
 * ones — while any document is in one of those, the list must keep polling.
 */
const kbStatus = (key, variant, spinner) => ({
  variant,
  spinner,
  get label() {
    return tr(`kb.status.${key}`);
  },
});

export const KB_STATUS = {
  pending: kbStatus('pending', 'default', true),
  parsing: kbStatus('parsing', 'info', true),
  embedding: kbStatus('embedding', 'info', true),
  ready: kbStatus('ready', 'success', false),
  failed: kbStatus('failed', 'danger', false),
};

export const getKbStatus = (status) =>
  KB_STATUS[status] || { label: status || tr('kb.status.unknown'), variant: 'default', spinner: false };

/** True while at least one document is still being parsed or indexed. */
export const hasUnsettledDocuments = (documents = []) =>
  documents.some((doc) => getKbStatus(doc.status).spinner);

const extensionOf = (filename = '') => {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
};

/**
 * Client-side mirror of the server's batch validation.
 * Returns an array of human-readable problems; empty means the batch is fine.
 */
export const validateKbUpload = (files, existingCount = 0) => {
  const errors = [];

  if (files.length === 0) return [tr('kb.upload.none')];

  if (files.length > KB_MAX_FILES_PER_REQUEST) {
    errors.push(tr('kb.upload.tooMany', { max: KB_MAX_FILES_PER_REQUEST }));
  }

  if (existingCount + files.length > KB_MAX_DOCUMENTS_PER_ORG) {
    errors.push(tr('kb.upload.orgLimit', { count: existingCount, max: KB_MAX_DOCUMENTS_PER_ORG }));
  }

  files.forEach((file) => {
    if (file.size === 0) {
      errors.push(tr('kb.upload.empty', { name: file.name }));
    } else if (file.size > KB_MAX_FILE_SIZE) {
      errors.push(tr('kb.upload.tooLarge', { name: file.name }));
    }

    if (!KB_ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
      errors.push(tr('kb.upload.badType', { name: file.name, allowed: KB_ACCEPTED_EXTENSIONS.join(' ') }));
    }
  });

  return errors;
};

/**
 * Agents, in the order they run. The summarizer is missing from the knowledge
 * base role list on purpose — it works from the report's own attachments
 * rather than organization policy — so KB role selectors come from the API,
 * not from this list.
 */
export const AGENT_TYPES = ['summarizer', 'manager', 'officer', 'reviewer'];

export const AGENT_LABELS = Object.defineProperties({}, Object.fromEntries(
  AGENT_TYPES.map((type) => [type, { enumerable: true, get: () => tr(`agentTypes.${type}`) }]),
));

export const formatRoleLabel = (role) =>
  role
    ? tr(`agentTypes.${role}`, { defaultValue: role.charAt(0).toUpperCase() + role.slice(1) })
    : '';

/**
 * What each organization-defined agent kind is for. The list of kinds itself
 * comes from GET /org-agents/capabilities; this only describes them.
 */
const described = (prefix) => ({
  get label() {
    return tr(`${prefix}.label`);
  },
  get description() {
    return tr(`${prefix}.description`);
  },
});

export const AGENT_KIND_INFO = {
  analyst: described('kinds.analyst'),
  summarizer: described('kinds.summarizer'),
};

/**
 * One line per agent capability. Which capabilities exist, and the permission
 * each needs, come from GET /org-agents/capabilities; a capability missing here
 * still renders, under its code.
 */
export const CAPABILITY_INFO = Object.fromEntries(
  [
    'message_reporter',
    'internal_note',
    'update_report',
    'assign_report',
    // Filenames, sizes and types are part of the report and visible to any
    // agent that can read it; this gates downloading the file contents.
    'read_attachments',
    'consult_kb',
    'resolve_escalation',
  ].map((code) => [code, described(`capabilities.${code}`)]),
);

export const SUMMARIZER_KIND = 'summarizer';

/**
 * The only capabilities a summarizer may hold. The rest are refused at save
 * (GET /org-agents/capabilities lists them with reasons), so the summarizer's
 * form offers just these.
 */
export const SUMMARIZER_CAPABILITIES = ['read_attachments', 'internal_note', 'consult_kb'];

/**
 * A summarizer's fixed permissions — it has no role to borrow them from
 * (role_source "intrinsic", role_code null).
 */
export const SUMMARIZER_PERMISSIONS = ['report:read_all', 'message:read_internal', 'agent:kb_read'];

export const isSummarizer = (agent) => agent?.kind === SUMMARIZER_KIND;

export const capabilityLabel = (capability) =>
  CAPABILITY_INFO[capability]?.label || capability?.replace(/_/g, ' ') || '';

/** Verdicts suggested when an analyst has none yet — any slug is allowed. */
export const SUGGESTED_DECISIONS = ['assign', 'ask_info', 'escalate', 'handle_locally'];

/** Manager triage verdict. May be absent on older runs. */
export const DECISION_LABELS = {
  assign: { variant: 'success', get label() { return tr('decisions.assign'); } },
  ask_info: { variant: 'warning', get label() { return tr('decisions.ask_info'); } },
};

/** A step routed to a human by the org's orchestration mode. */
export const MANUAL_ACTION = 'MANUAL ACTION REQUIRED';

export const isManualAction = (action) =>
  typeof action === 'string' && action.trim().toUpperCase() === MANUAL_ACTION;

/**
 * How a policy citation should be presented. The booleans are the whole point
 * of the feature: an unverified citation is almost always a paraphrase dressed
 * as a quote, and reads identically to a real one unless it is flagged.
 */
export const citationVerdict = (citation = {}) => {
  const verdict = (variant, key) => ({
    variant,
    label: tr(`citations.${key}.label`),
    note: tr(`citations.${key}.note`),
  });
  if (citation.verified === false) return verdict('danger', 'unverified');
  if (citation.verified && citation.source_matches === false) return verdict('warning', 'wrongDocument');
  return verdict('success', 'verified');
};

/**
 * The agent surfaces are org-scoped, so a super admin (who has no
 * organization) gets a 400 that looks exactly like a bug. Detect it up front
 * and explain it instead.
 */
export const AGENT_ORG_REQUIRED_MESSAGE =
  'These settings belong to an organization. Sign in with an organization admin account to manage them.';

/** AGENT_ORG_REQUIRED_MESSAGE in the interface language. */
export const agentOrgRequiredMessage = () => tr('orgRequired');

/** Pulls the readable reason out of a FastAPI {"detail": "..."} error. */
export const agentErrorMessage = (error, fallback = tr('errors.fallback')) => {
  // A run on a case this person can't open is a plain 404, like the case
  // itself; nothing may hint that it exists.
  if (error?.response?.status === 404) return tr('errors.notFound');
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') return detail.message;
  return error?.message || fallback;
};

/** 503 means the feature is switched off server-side, not that it crashed. */
export const isServiceUnavailable = (error) => error?.response?.status === 503;
