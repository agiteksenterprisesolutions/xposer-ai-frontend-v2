// src/utils/toastGuard.js
//
// One failure, one error toast.
//
// Two layers report a failed request: the axios interceptor (for every
// request that doesn't opt out with skipErrorToast) and, often, the screen's
// own catch block. Each was right on its own; together they stacked two toasts
// for one failure — and a page loading three things at once showed "Network
// error" three times.
//
// The interceptor reports through apiErrorToast(), which remembers what it
// just showed. A screen's toast.error() for the same failure, moments later,
// then resolves the pair to one:
//   - the interceptor showed the server's own sentence (a 400/409 detail, a
//     disabled-account 403) → keep it; the screen's restatement is dropped.
//   - the interceptor showed something generic ("Server error", "Network
//     error", "Resource not found") → the screen's message is more specific,
//     so it replaces the generic one.
// Identical messages are collapsed too (same toastId while one is on screen).
import { toast } from 'react-toastify';

// How long after an interceptor toast a screen's toast counts as the same failure.
const SAME_FAILURE_MS = 1500;

const showError = toast.error.bind(toast);
let lastApiToast = null; // { id, generic, at }

/** A toast's content must be renderable; an API `detail` object is not. */
const renderable = (content) => {
  if (content && typeof content === 'object' && !content.$$typeof && !Array.isArray(content)) {
    return typeof content.message === 'string' ? content.message : 'Something went wrong.';
  }
  return content;
};

const idFor = (content, prefix) => (typeof content === 'string' ? `${prefix}:${content}` : undefined);

/** For the axios interceptor only. `generic` — a fallback, not the server's own words. */
export const apiErrorToast = (message, { generic = false } = {}) => {
  const id = idFor(message, 'api');
  showError(message, { toastId: id });
  lastApiToast = { id, generic, at: Date.now() };
};

toast.error = (content, options = {}) => {
  const message = renderable(content);
  if (lastApiToast && Date.now() - lastApiToast.at < SAME_FAILURE_MS) {
    const recent = lastApiToast;
    lastApiToast = null;
    if (!recent.generic) return recent.id;
    if (recent.id) toast.dismiss(recent.id);
  }
  return showError(message, { ...options, toastId: options.toastId ?? idFor(message, 'msg') });
};
