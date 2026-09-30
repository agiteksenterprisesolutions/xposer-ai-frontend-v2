// src/components/tour/DashboardTour.jsx
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useThemeStore } from '../../store/themeStore';
import { useTourStore } from '../../store/tourStore';

/**
 * Joyride styles its tooltip with inline JS, so it can't consume Tailwind
 * classes. getPropertyValue() on a token returns the raw `var(--…)` chain
 * rather than a color, so we mount a throwaway element carrying the utility
 * and read the *computed* value back off it.
 */
const resolve = (className, prop, fallback) => {
  if (typeof document === 'undefined') return fallback;
  try {
    const el = document.createElement('div');
    el.className = className;
    el.style.position = 'absolute';
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
    const value = getComputedStyle(el)[prop];
    el.remove();
    return value || fallback;
  } catch {
    return fallback;
  }
};

/**
 * Reusable guided tour for dashboard pages (Sidebar + page content).
 * Auto-starts once per browser per `storageKey`, and can be replayed on
 * demand from the navbar's "Take a tour" button, which it registers with
 * while mounted (or via a ref: `tourRef.current.start()`).
 */
const DashboardTour = forwardRef(({ steps, storageKey }, ref) => {
  const [run, setRun] = useState(false);
  const [liveSteps, setLiveSteps] = useState([]);
  const theme = useThemeStore((s) => s.theme);

  // Sidebar entries and action buttons only render for users whose permissions
  // allow them, and Joyride stalls on a step whose target is missing — so the
  // tour is cut down to what is actually on screen when it starts.
  const start = () => {
    const present = steps.filter(
      (step) => typeof step.target !== 'string' || step.target === 'body' || document.querySelector(step.target),
    );
    if (!present.length) return;
    setLiveSteps(present);
    setRun(true);
  };

  useEffect(() => {
    if (!steps.length) return;
    const alreadySeen = localStorage.getItem(storageKey) === 'true';
    if (alreadySeen) return;
    const timer = setTimeout(start, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useImperativeHandle(ref, () => ({ start }));

  // The navbar button always runs the latest `start`, so a page whose steps
  // change while it is mounted (a multi-stage form) replays the right ones.
  const startRef = useRef(start);
  startRef.current = start;
  const hasSteps = steps.length > 0;
  useEffect(() => {
    if (!hasSteps) return undefined;
    const trigger = () => startRef.current();
    const { register, unregister } = useTourStore.getState();
    register(trigger);
    return () => unregister(trigger);
  }, [hasSteps]);

  const handleEvent = ({ status }) => {
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(storageKey, 'true');
      setRun(false);
    }
  };

  // Re-resolved whenever the theme flips. In react-joyride v3 these palette
  // keys live on the `options` prop; `styles` is a flat map of element rules
  // and has no `options` key of its own.
  const options = useMemo(() => {
    const surface = resolve('bg-surface', 'backgroundColor', '#111827');
    return {
      buttons: ['back', 'close', 'primary', 'skip'],
      showProgress: true,
      primaryColor: resolve('bg-accent', 'backgroundColor', '#3b82f6'),
      backgroundColor: surface,
      arrowColor: surface,
      textColor: resolve('text-ink', 'color', '#f0f4ff'),
      overlayColor: theme === 'dark' ? 'rgba(4, 7, 12, 0.72)' : 'rgba(8, 12, 20, 0.45)',
      spotlightRadius: 10,
      zIndex: 10000,
      width: 360,
    };
  }, [theme]);

  const styles = useMemo(() => ({
    tooltip: {
      border: `1px solid ${resolve('border-line', 'borderTopColor', 'rgba(255,255,255,.1)')}`,
      borderRadius: 12,
      padding: 20,
    },
    tooltipTitle: { fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' },
    tooltipContent: { fontSize: 14, lineHeight: 1.6, padding: '8px 0 0' },
    buttonPrimary: { borderRadius: 8, fontSize: 13.5, fontWeight: 600, padding: '8px 16px' },
    buttonBack: { fontSize: 13.5, fontWeight: 500 },
    buttonSkip: { fontSize: 13.5, fontWeight: 500 },
  }), [theme]);

  if (!steps.length) return null;

  return (
    <Joyride
      steps={liveSteps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      locale={{ last: 'Done' }}
      options={options}
      styles={styles}
    />
  );
});

DashboardTour.displayName = 'DashboardTour';

export default DashboardTour;
