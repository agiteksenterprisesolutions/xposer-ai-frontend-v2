// src/utils/pagination.js

/** Page size the list endpoints default to. */
export const DEFAULT_PAGE_SIZE = 20;

/** Keys the API has used for the rows of a list response, newest first. */
const ITEM_KEYS = ['items', 'results', 'data', 'reports', 'users'];

/**
 * Unwrap a list response into a consistent shape.
 *
 * Paginated endpoints return an envelope
 * ({ items, page, page_size, total, total_pages, has_next, has_previous }),
 * while some still return a bare array, and older payloads used a resource
 * name (`reports`, `users`) for the rows. All are accepted so callers never
 * have to branch — and, importantly, so a shape change can't silently yield an
 * empty list.
 */
export const normalizeListResponse = (response) => {
  let items = [];
  if (Array.isArray(response)) {
    items = response;
  } else if (response && typeof response === 'object') {
    const key = ITEM_KEYS.find((candidate) => Array.isArray(response[candidate]));
    items = key ? response[key] : [];
  }

  const page = response?.page || 1;
  const pageSize = response?.page_size || response?.limit || DEFAULT_PAGE_SIZE;
  // A bare array is the whole result set, so its length is the total.
  const total = Number.isFinite(response?.total) ? response.total : items.length;
  const totalPages =
    response?.total_pages ||
    response?.pages ||
    Math.max(1, Math.ceil(total / (pageSize || DEFAULT_PAGE_SIZE)));

  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    hasNext: response?.has_next ?? page < totalPages,
    hasPrevious: response?.has_previous ?? page > 1,
  };
};
