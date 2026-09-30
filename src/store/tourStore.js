// src/store/tourStore.js
import { create } from 'zustand';

/**
 * The guided tour of whichever page is on screen. A page's <DashboardTour>
 * registers its `start` here while it is mounted, and the navbar's
 * "Take a tour" button calls it — so one button always replays the tour of
 * the current page, and disappears on pages that have none.
 */
export const useTourStore = create((set, get) => ({
  start: null,

  register: (start) => set({ start }),

  // Only the tour that is still registered may clear the slot; on a route
  // change the next page's tour can register before the old one unmounts.
  unregister: (start) => {
    if (get().start === start) set({ start: null });
  },
}));
