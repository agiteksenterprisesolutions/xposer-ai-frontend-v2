// src/utils/errors.js
//
// One reader for every error shape the API returns:
//
//   400  a business rule  → detail: { message, problems[], warnings? }
//   422  schema validation → detail: [{ loc, msg, type }]
//   403  missing permission → detail: string
//   409  a guard (duplicate, fixed role, still in use) → detail: string
//
// The 400 messages are complete sentences written for whoever is looking at
// the screen. Render them verbatim — rewording them to "Invalid input" throws
// away the part that tells the user what to do.

const FALLBACK = 'Something went wrong.';

/**
 * Normalise an error body into `{ summary, problems }`.
 *
 * Each problem is `{ message, code?, field?, row?, permission?, requires?,
 * stage?, capability? }` — whatever the backend attached is passed through, so
 * a screen can pin a problem to the row, field or stage that caused it.
 */
export function normaliseError(body) {
  const d = body?.detail;

  // 400 from a business rule — the useful case.
  if (d && typeof d === 'object' && !Array.isArray(d) && d.message) {
    return {
      summary: d.message,
      problems: Array.isArray(d.problems) ? d.problems : [],
      warnings: Array.isArray(d.warnings) ? d.warnings : [],
    };
  }

  // 422 from Pydantic.
  if (Array.isArray(d)) {
    return {
      summary: 'Some fields need fixing.',
      problems: d.map((e) => ({
        field: Array.isArray(e?.loc) ? e.loc.filter((x) => x !== 'body').join('.') : undefined,
        message: e?.msg ?? String(e),
        code: e?.type,
      })),
      warnings: [],
    };
  }

  // 403 / 409 / anything else with a string detail.
  if (typeof d === 'string') return { summary: d, problems: [], warnings: [] };
  if (typeof body?.message === 'string') return { summary: body.message, problems: [], warnings: [] };
  return { summary: FALLBACK, problems: [], warnings: [] };
}

/**
 * `normaliseError` for whatever a caller caught. The API modules rethrow either
 * the axios error itself or its `response.data`, so accept both, plus plain
 * Errors from code that never reached the network.
 */
export function describeError(error) {
  const status = error?.response?.status ?? error?.status ?? null;
  const body = error?.response ? error.response.data : error;
  const normalised = normaliseError(body);

  if (normalised.summary === FALLBACK && !error?.response && error?.message && !error?.detail) {
    normalised.summary = error.message;
  }
  return { status, ...normalised };
}

/** Just the sentence to show, for places that only have room for one line. */
export const errorSummary = (error) => describeError(error).summary;
