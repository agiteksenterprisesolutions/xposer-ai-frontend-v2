// src/store/portalStore.js
//
// Which reporter portal address this tab came in through (XPAI-226): the
// tenant ("acme") or one of its legal entities ("acme/insurance"). The
// address decides a report's entity, for good, so the path is sent as
// `portal_path` on POST /reports/init (api/reports.js).
//
// Kept in sessionStorage: it survives a reload mid-report (otherwise the
// report would quietly drop to tenant level) but not the tab. It holds only
// the public address, nothing about the reporter.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const usePortalStore = create(
  persist(
    (set) => ({
      tenant: null,
      entity: null,
      /** Arrived at a portal address; `entity` null for the tenant's own page. */
      enter: (tenant, entity = null) => set({ tenant, entity: entity || null }),
    }),
    {
      name: 'xposer-portal',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

/** "acme" or "acme/insurance". */
export const portalPathOf = ({ tenant, entity }) => (tenant ? (entity ? `${tenant}/${entity}` : tenant) : null);

/**
 * The portal_path for a report started under `orgSlug`: the address this tab
 * came in through when it belongs to that tenant, else the tenant's own.
 */
export const currentPortalPath = (orgSlug = null) => {
  const state = usePortalStore.getState();
  if (state.tenant && (!orgSlug || state.tenant === orgSlug)) return portalPathOf(state);
  return orgSlug || null;
};
