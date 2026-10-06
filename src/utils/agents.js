// src/utils/agents.js
//
// Shared vocabulary for the AI agent surfaces: knowledge-base document limits
// and statuses, and the way an agent run is labelled. The limits mirror the
// backend's own validation so a doomed upload is rejected before it is sent —
// the server validates the whole batch up front, so one bad file rejects all
// of them and nothing is stored.

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
export const KB_STATUS = {
  pending: { label: 'Queued', variant: 'default', spinner: true },
  parsing: { label: 'Reading document', variant: 'info', spinner: true },
  embedding: { label: 'Indexing', variant: 'info', spinner: true },
  ready: { label: 'Ready', variant: 'success', spinner: false },
  failed: { label: 'Failed', variant: 'danger', spinner: false },
};

export const getKbStatus = (status) =>
  KB_STATUS[status] || { label: status || 'Unknown', variant: 'default', spinner: false };

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

  if (files.length === 0) return ['Choose at least one file to upload.'];

  if (files.length > KB_MAX_FILES_PER_REQUEST) {
    errors.push(`Too many files in one request (max ${KB_MAX_FILES_PER_REQUEST}).`);
  }

  if (existingCount + files.length > KB_MAX_DOCUMENTS_PER_ORG) {
    errors.push(
      `Your organization already has ${existingCount} document(s); the limit is ${KB_MAX_DOCUMENTS_PER_ORG}.`
    );
  }

  files.forEach((file) => {
    if (file.size === 0) {
      errors.push(`'${file.name}' is empty.`);
    } else if (file.size > KB_MAX_FILE_SIZE) {
      errors.push(`'${file.name}' is larger than the 10 MB limit.`);
    }

    if (!KB_ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
      errors.push(
        `'${file.name}' has an unsupported type. Allowed: ${KB_ACCEPTED_EXTENSIONS.join(' ')}`
      );
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

export const AGENT_LABELS = {
  summarizer: 'Summarizer',
  manager: 'Manager',
  officer: 'Officer',
  reviewer: 'Reviewer',
};

export const formatRoleLabel = (role) =>
  role ? role.charAt(0).toUpperCase() + role.slice(1) : '';

/**
 * What each organization-defined agent kind is for. The list of kinds itself
 * comes from GET /org-agents/capabilities; this only describes them.
 */
export const AGENT_KIND_INFO = {
  analyst: {
    label: 'Analyst',
    description: 'Reads a report and reaches a decision that the workflow can branch on.',
  },
  summarizer: {
    label: 'Summarizer',
    description: 'Writes a factual digest of the evidence. It reaches no decision and never contacts the reporter.',
  },
};

/**
 * One line per agent capability. Which capabilities exist, and the permission
 * each needs, come from GET /org-agents/capabilities; a capability missing here
 * still renders, under its code.
 */
export const CAPABILITY_INFO = {
  message_reporter: { label: 'Message the reporter', description: 'Send messages the reporter can read.' },
  internal_note: { label: 'Write internal notes', description: 'Leave notes only staff can see.' },
  update_report: { label: 'Update the report', description: 'Change status, priority and details.' },
  assign_report: { label: 'Assign the report', description: 'Hand the report to a member of staff.' },
  // Filenames, sizes and types are part of the report and visible to any agent
  // that can read it; this gates downloading the file contents.
  read_attachments: {
    label: 'Download evidence files',
    description: 'Open and read the contents of attached files. File names are visible either way.',
  },
  consult_kb: { label: 'Consult the knowledge base', description: "Quote the organization's policy documents." },
  resolve_escalation: {
    label: 'Resolve escalation',
    description: 'Use the reporting hierarchy to work out who a report escalates to.',
  },
};

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
  assign: { label: 'Assigned', variant: 'success' },
  ask_info: { label: 'More info requested', variant: 'warning' },
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
  if (citation.verified === false) {
    return {
      variant: 'danger',
      label: 'Unverified',
      note: 'This wording was not found in the cited document.',
    };
  }
  if (citation.verified && citation.source_matches === false) {
    return {
      variant: 'warning',
      label: 'Wrong document',
      note: 'The quote is real, but it comes from a different document.',
    };
  }
  return {
    variant: 'success',
    label: 'Verified',
    note: 'Found verbatim in the named document.',
  };
};

/**
 * The agent surfaces are org-scoped, so a super admin (who has no
 * organization) gets a 400 that looks exactly like a bug. Detect it up front
 * and explain it instead.
 */
export const AGENT_ORG_REQUIRED_MESSAGE =
  'These settings belong to an organization. Sign in with an organization admin account to manage them.';

/** Pulls the readable reason out of a FastAPI {"detail": "..."} error. */
export const agentErrorMessage = (error, fallback = 'Something went wrong.') =>
  error?.response?.data?.detail || error?.message || fallback;

/** 503 means the feature is switched off server-side, not that it crashed. */
export const isServiceUnavailable = (error) => error?.response?.status === 503;
