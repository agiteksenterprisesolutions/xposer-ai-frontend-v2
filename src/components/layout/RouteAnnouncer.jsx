// src/components/layout/RouteAnnouncer.jsx
//
// Two things a single-page app loses compared with real page loads:
//
// 1. A page heading. Many screens show their title in a card or not at all.
//    When the main region has no <h1>, this renders a visually hidden one
//    from the page title (WCAG 1.3.1, 2.4.6), so heading navigation still
//    starts at the page's name.
// 2. The "new page" cue. On a route change (not the first load, and not a
//    query-string change such as a filter) focus moves to the page's <h1>,
//    so a screen reader reads where you are and Tab starts from the top of
//    the content (WCAG 2.4.3).
//
// Rendered as the first child of <main>.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_NAME } from '../../utils/seo';

const pageName = () => {
  const title = document.title || '';
  const suffix = ` | ${SITE_NAME}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
};

const RouteAnnouncer = () => {
  const { pathname } = useLocation();
  const ownRef = useRef(null);
  const first = useRef(true);
  const [name, setName] = useState('');
  const [needsOwn, setNeedsOwn] = useState(false);
  const [focusOwn, setFocusOwn] = useState(0);

  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    // Let the page render and set its title first.
    const timer = setTimeout(() => {
      const main = document.getElementById('main-content');
      const pageH1 = main && [...main.querySelectorAll('h1')].find((h) => h !== ownRef.current);
      setNeedsOwn(!pageH1);
      setName(pageName());
      if (isFirst) return;
      // A dialog that opened on arrival keeps focus.
      if (document.activeElement?.closest('[role="dialog"]')) return;
      if (pageH1) {
        if (!pageH1.hasAttribute('tabindex')) pageH1.setAttribute('tabindex', '-1');
        pageH1.focus({ preventScroll: true });
      } else {
        setFocusOwn((n) => n + 1); // focused once it has rendered, below
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (focusOwn) ownRef.current?.focus({ preventScroll: true });
  }, [focusOwn, needsOwn]);

  // The title can arrive after the timer (data loaded later); keep it in step.
  useEffect(() => {
    const el = document.querySelector('title');
    if (!el) return undefined;
    const observer = new MutationObserver(() => setName(pageName()));
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!needsOwn || !name) return null;
  return (
    <h1 ref={ownRef} tabIndex={-1} className="sr-only">
      {name}
    </h1>
  );
};

export default RouteAnnouncer;
