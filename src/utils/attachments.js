// src/utils/attachments.js
//
// One evidence policy for the whole app. Every place a reporter attaches a file
// — the AI intake chat, the multi-step form, per-question uploads, the message
// composer — validates against this and nothing else.
//
// It exists because the rules had drifted into four different lists: the chat
// rejected spreadsheets, the main submit form accepted literally any file with
// no type check at all, two components carried picker-only `accept` strings
// that nothing enforced, and constants.js held a fifth list no one imported.
//
// Messages are translated when they're built (namespace `form`, key
// `attachments.*`). ATTACHMENT_TYPES_LABEL and ATTACHMENT_HINT stay as English
// constants for older callers; use attachmentTypesLabel() / attachmentHint()
// for text in the interface language.
import i18n from '../i18n';

/** Hard ceiling per file. */
export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
export const ATTACHMENT_MAX_SIZE_LABEL = '50 MB';

/** How many files may be attached in one go. */
export const ATTACHMENT_MAX_FILES = 10;

/**
 * MIME rules. Prefixes cover whole families (any image, video or audio codec);
 * exact types cover the specific documents and archives.
 *
 * Browsers are inconsistent about archive MIME types — the same .zip arrives as
 * application/zip, application/x-zip-compressed or occasionally octet-stream —
 * so the extension list below is what actually settles those cases.
 */
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'multipart/x-zip',
];

/**
 * Extensions accepted when the MIME type is missing or unhelpful. Windows in
 * particular reports an empty type for plenty of ordinary files, and rejecting
 * a reporter's evidence over a browser quirk is the worse failure here.
 */
const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.zip',
];

/** The `accept` attribute for every evidence file input. */
export const ATTACHMENT_ACCEPT = [
  'image/*',
  'video/*',
  'audio/*',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.zip',
].join(',');

/** Short human summary, for help text and error messages. */
export const ATTACHMENT_TYPES_LABEL =
  'Images, video, audio, PDF, Word, Excel and ZIP';

export const ATTACHMENT_HINT = `${ATTACHMENT_TYPES_LABEL} · up to ${ATTACHMENT_MAX_SIZE_LABEL} each · ${ATTACHMENT_MAX_FILES} files at a time`;

/** ATTACHMENT_TYPES_LABEL in the interface language. */
export const attachmentTypesLabel = () => i18n.t('form:attachments.types');

/** ATTACHMENT_HINT in the interface language. */
export const attachmentHint = () =>
  i18n.t('form:attachments.hint', {
    types: attachmentTypesLabel(),
    size: ATTACHMENT_MAX_SIZE_LABEL,
    count: ATTACHMENT_MAX_FILES,
  });

const extensionOf = (filename = '') => {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
};

/** True when the file is an accepted kind of evidence. */
export const isAllowedAttachment = (file) => {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();

  if (type && ALLOWED_MIME_PREFIXES.some((prefix) => type.startsWith(prefix))) {
    return true;
  }
  if (type && ALLOWED_MIME_TYPES.includes(type)) return true;

  // Fall back to the extension for empty or unrecognised MIME types.
  return ALLOWED_EXTENSIONS.includes(extensionOf(file.name));
};

export const isAllowedAttachmentSize = (file) =>
  Boolean(file) && file.size <= ATTACHMENT_MAX_BYTES && file.size > 0;

/**
 * Validates a batch. `existingCount` is how many are already attached, so the
 * ten-file ceiling applies to the total rather than to each pick.
 *
 * Returns `{ valid, rejected, errors }`: valid files can be kept even when
 * others fail, which beats discarding a good selection over one stray file.
 */
export const validateAttachments = (files = [], existingCount = 0) => {
  const valid = [];
  const rejected = [];
  const errors = [];

  const room = Math.max(ATTACHMENT_MAX_FILES - existingCount, 0);
  if (room === 0 && files.length > 0) {
    return {
      valid,
      rejected: [...files],
      errors: [i18n.t('form:attachments.tooMany', { count: ATTACHMENT_MAX_FILES })],
    };
  }

  files.forEach((file) => {
    if (!isAllowedAttachment(file)) {
      rejected.push(file);
      errors.push(i18n.t('form:attachments.unsupported', { name: file.name, types: attachmentTypesLabel() }));
      return;
    }
    if (file.size === 0) {
      rejected.push(file);
      errors.push(i18n.t('form:attachments.empty', { name: file.name }));
      return;
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      rejected.push(file);
      errors.push(i18n.t('form:attachments.tooLarge', { name: file.name, size: ATTACHMENT_MAX_SIZE_LABEL }));
      return;
    }
    valid.push(file);
  });

  if (valid.length > room) {
    const dropped = valid.splice(room);
    rejected.push(...dropped);
    errors.push(
      i18n.t('form:attachments.dropped', { max: ATTACHMENT_MAX_FILES, count: dropped.length }),
    );
  }

  return { valid, rejected, errors };
};
