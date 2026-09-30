// src/store/themeStore.js
import { create } from 'zustand';

const STORAGE_KEY = 'xposer-theme';

const DEFAULT_THEME = 'light';

// The inline script in index.html has already resolved and painted a theme by
// the time this runs, so trust the attribute it set. Deriving the value
// independently here let the store disagree with the DOM on a first visit,
// which made the toggle need two clicks to take effect.
export const resolveInitialTheme = () => {
  if (typeof document === 'undefined') return DEFAULT_THEME;

  const painted = document.documentElement.getAttribute('data-theme');
  if (painted === 'light' || painted === 'dark') return painted;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage can throw in private mode — fall through to the default
  }
  return DEFAULT_THEME;
};

const applyTheme = (theme, { persist = true } = {}) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  if (!persist) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Persisting is best-effort; the in-memory value still drives this session
  }
};

const initialTheme = resolveInitialTheme();
// Covers the case where the inline script never ran (attribute absent); the
// value isn't persisted because the user hasn't chosen it yet.
applyTheme(initialTheme, { persist: false });

export const useThemeStore = create((set, get) => ({
  theme: initialTheme,

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    set({ theme: next });
  },
}));
