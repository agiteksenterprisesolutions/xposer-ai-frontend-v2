// src/hooks/useSEO.js
// Keeps <title>, meta tags, canonical link and JSON-LD in sync with the mounted
// route. No dependency on react-helmet: React 18 has no built-in metadata
// hoisting, so we write to <head> imperatively.
//
// Several SEO consumers can be mounted at once (e.g. a layout sets defaults and
// a page overrides them). We keep a stack of registrations and always render the
// most recently mounted one, restoring the previous entry on unmount.

import { useEffect, useId, useRef } from 'react';
import { DEFAULT_SEO, resolveSeo } from '../utils/seo';

const MANAGED_ATTR = 'data-seo';

// Entries currently mounted, oldest first. The last one wins.
const stack = [];

const setMeta = ({ name, property, content }) => {
  if (!content) return;
  const key = property ? 'property' : 'name';
  const value = property || name;
  if (!value) return;

  let tag = document.head.querySelector(`meta[${key}="${CSS.escape(value)}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(key, value);
    document.head.appendChild(tag);
  }
  tag.setAttribute(MANAGED_ATTR, 'true');
  tag.setAttribute('content', content);
};

const clearManaged = () => {
  document.head
    .querySelectorAll(`meta[${MANAGED_ATTR}="true"], link[${MANAGED_ATTR}="true"], script[${MANAGED_ATTR}="true"]`)
    .forEach((el) => el.remove());
};

const setCanonical = (href) => {
  if (!href) return;
  const link = document.createElement('link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', href);
  link.setAttribute(MANAGED_ATTR, 'true');
  document.head.appendChild(link);
};

const setJsonLd = (data) => {
  if (!data) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute(MANAGED_ATTR, 'true');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
};

/** Apply the top of the stack (or the site defaults when nothing is mounted). */
const flush = () => {
  if (typeof document === 'undefined') return;

  // Topmost entry that is actually contributing (a disabled entry is skipped so
  // the layout/defaults underneath it stay visible).
  const active = [...stack].reverse().find((entry) => entry.active);
  const { title, canonical, metaTags, jsonLd } = resolveSeo(active ? active.config : {});

  clearManaged();
  document.title = title || DEFAULT_SEO.title;

  // Later entries with the same name/property overwrite earlier ones, so the
  // caller's `meta` prop can override our defaults.
  metaTags.forEach(setMeta);
  setCanonical(canonical);
  setJsonLd(jsonLd);
};

/**
 * Imperatively drive the document head.
 *
 * @param {object}  config
 * @param {string}  config.title            Page title (run through the title template).
 * @param {string}  [config.titleTemplate]  Pass `null` to use the title verbatim.
 * @param {string}  config.description
 * @param {string[]|string} [config.keywords]
 * @param {string}  [config.image]          OG/Twitter image (path or absolute URL).
 * @param {string}  [config.canonical]      Defaults to the current URL.
 * @param {string}  [config.type]           OG type: website, article, profile…
 * @param {boolean} [config.noIndex]        Keep private/authenticated pages out of search.
 * @param {boolean} [config.noFollow]
 * @param {object}  [config.jsonLd]         Structured data object.
 * @param {Array}   [config.meta]           Extra `{ name|property, content }` tags.
 * @param {boolean} [config.enabled=true]   Skip while data is still loading.
 */
export const useSEO = (config = {}) => {
  const id = useId();
  const entryRef = useRef(null);

  // Register/unregister once so the stack order matches mount order.
  useEffect(() => {
    const entry = { id, config: {}, active: false };
    entryRef.current = entry;
    stack.push(entry);
    return () => {
      const index = stack.indexOf(entry);
      if (index !== -1) stack.splice(index, 1);
      entryRef.current = null;
      flush();
    };
  }, [id]);

  // Re-apply whenever the resolved values change — this is what makes dynamic
  // titles work: pass state in and the head follows.
  const { enabled = true, ...rest } = config;
  const signature = JSON.stringify({ enabled, ...rest });

  useEffect(() => {
    const entry = entryRef.current;
    if (!entry) return;
    // While disabled (e.g. data still loading) the entry contributes nothing and
    // whatever is below it in the stack — usually the site defaults — stays.
    entry.config = rest;
    entry.active = enabled;
    flush();
    // `signature` is a deep-compare of the config; `rest`/`enabled` are read fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
};

export default useSEO;
