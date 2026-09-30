// src/components/ui/ThemeToggle.jsx
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

/**
 * Switches the whole app between the light and dark token sets by flipping
 * data-theme on <html>. Every color in the UI resolves through App.css, so
 * nothing else has to know the theme changed.
 */
const ThemeToggle = ({ className = '', variant = 'nav' }) => {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  const variants = {
    // Sits in the dark navbar, which keeps its own fixed palette
    nav: 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent',
    // Sits on themed surfaces (sidebar, settings panes)
    surface: 'text-ink-muted hover:text-ink hover:bg-hover border border-line',
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200 ${variants[variant] || variants.nav} ${className}`}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
};

export default ThemeToggle;
