// src/utils/reports.js

/**
 * A report stays a draft until the reporter runs the final submit step.
 * The backend tracks that on `submission_status`; older records only carry
 * `status`, so both are checked.
 */
export const isDraftReport = (report) =>
  report?.status === 'draft' || report?.submission_status === 'draft';

/** Trimmed string, or '' — title and description are both optional. */
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * The report's title, or '' when it has none.
 *
 * Reports filed through the voice agent get a title written for them; ones
 * filed through the multi-step form may have none at all, and every view has
 * to cope with that rather than printing an empty heading or "N/A".
 *
 * The split is long-standing behaviour across the app: only the part before
 * the first hyphen has ever been shown. It is kept here so the whole app can
 * change its mind in one place.
 */
export const getReportTitle = (report) => {
  const title = text(report?.title);
  if (!title) return '';
  return text(title.split('-')[0]) || title;
};

/** The report's description, or '' when it has none. */
export const getReportDescription = (report) => text(report?.description);

/**
 * Every piece of free text a reporter gave — title, description, form answers
 * and voice answers — deduplicated. This is what an escalation lookup scans
 * for the names of people on the directory.
 */
export const getReportTexts = (report) => {
  const found = [];
  const collect = (value) => {
    if (typeof value === 'string') {
      const t = value.trim();
      if (t) found.push(t);
    } else if (Array.isArray(value)) {
      value.forEach(collect);
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(collect);
    }
  };
  collect(report?.title);
  collect(report?.description);
  collect(report?.form_data);
  (report?.voice_answers || []).forEach((entry) => collect(entry?.answer));
  return [...new Set(found)];
};

// Reports, users, and the other list endpoints all share one envelope, so the
// unwrapping lives in utils/pagination and is re-exported here for callers that
// only deal with reports.
export { DEFAULT_PAGE_SIZE, normalizeListResponse } from './pagination';
export { normalizeListResponse as normalizeReportsResponse } from './pagination';
