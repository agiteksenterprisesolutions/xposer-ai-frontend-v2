// src/store/reportAckStore.js
//
// The "Before you report" acknowledgement (XPAI-114). The reporter reads the
// page and ticks "I have read and understood this"; the page's
// `content_hash` is kept here and sent as `ack_content_hash` on the next
// POST /reports/init.
//
// Page memory only, on purpose: no localStorage, no cookie. A reload or a new
// tab shows the page again, and each hash is used for one report, so the
// reporter reads the page before every report.
import { create } from 'zustand';

export const useReportAckStore = create((set) => ({
  hash: null,
  /** The organization the page was read for; a hash is only sent there. */
  slug: null,
  acknowledge: (hash, slug = null) => set({ hash, slug }),
  clear: () => set({ hash: null, slug: null }),
}));

/** The hash to send for a report started under `slug`, or null. */
export const currentAckHash = (slug = null) => {
  const { hash, slug: ackSlug } = useReportAckStore.getState();
  if (!hash) return null;
  if (slug && ackSlug && slug !== ackSlug) return null;
  return hash;
};
