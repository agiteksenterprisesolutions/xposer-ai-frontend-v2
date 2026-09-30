// src/utils/seo.js
// Shared configuration + helpers for the <SEO /> component and useSEO() hook.

export const SITE_NAME = 'Xposer AI';

// "%s" is replaced with the page title. Pages can opt out with titleTemplate={null}.
export const TITLE_TEMPLATE = `%s | ${SITE_NAME}`;

export const DEFAULT_SEO = {
  title: SITE_NAME,
  description:
    'Xposer AI is a secure whistleblowing and compliance platform for anonymous reporting, case management, and investigation workflows.',
  keywords: [],
  image: '/og-image.png',
  type: 'website',
  locale: 'en_US',
  twitterCard: 'summary_large_image',
};

// Titles longer than this get truncated by search engines anyway; descriptions too.
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

/** Collapse whitespace, strip markup/newlines, and clamp to `max` characters. */
export const cleanText = (value, max) => {
  if (value == null) return '';
  const text = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!max || text.length <= max) return text;

  // Cut on a word boundary so we don't end mid-word — unless doing so would
  // throw away most of the budget (one very long unbroken token), in which case
  // a hard cut keeps more meaning than a near-empty string.
  const hard = text.slice(0, max - 1);
  const onWord = hard.replace(/\s+\S*$/, '');
  return `${onWord.length > max * 0.6 ? onWord : hard}…`;
};

export const formatTitle = (title, template = TITLE_TEMPLATE) => {
  const clean = cleanText(title, TITLE_MAX);
  if (!clean) return DEFAULT_SEO.title;
  if (!template || !template.includes('%s')) return clean;
  // Avoid "Xposer AI | Xposer AI".
  if (clean === SITE_NAME) return clean;
  return template.replace('%s', clean);
};

export const formatDescription = (description) =>
  cleanText(description, DESCRIPTION_MAX) || DEFAULT_SEO.description;

/** Absolute URL for canonical/og tags, tolerant of paths, full URLs and SSR-less envs. */
export const absoluteUrl = (pathOrUrl) => {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (typeof window === 'undefined') return pathOrUrl;
  try {
    return new URL(pathOrUrl, window.location.origin).toString();
  } catch {
    return pathOrUrl;
  }
};

export const currentUrl = () =>
  typeof window === 'undefined' ? '' : `${window.location.origin}${window.location.pathname}`;

/**
 * Resolve a raw SEO config (props) into the final tag values.
 * Pure — safe to unit test and to call on every render.
 */
export const resolveSeo = (config = {}) => {
  const {
    title,
    titleTemplate = TITLE_TEMPLATE,
    description,
    keywords = DEFAULT_SEO.keywords,
    image = DEFAULT_SEO.image,
    canonical,
    type = DEFAULT_SEO.type,
    locale = DEFAULT_SEO.locale,
    twitterCard = DEFAULT_SEO.twitterCard,
    noIndex = false,
    noFollow = false,
    jsonLd = null,
    meta = [],
  } = config;

  const resolvedTitle = formatTitle(title, titleTemplate);
  const resolvedDescription = formatDescription(description);
  const resolvedCanonical = absoluteUrl(canonical || currentUrl());
  const resolvedImage = absoluteUrl(image);
  const keywordList = Array.isArray(keywords)
    ? keywords.filter(Boolean)
    : String(keywords).split(',').map((k) => k.trim()).filter(Boolean);

  const robots = [noIndex ? 'noindex' : 'index', noFollow ? 'nofollow' : 'follow'].join(', ');

  const metaTags = [
    { name: 'description', content: resolvedDescription },
    keywordList.length ? { name: 'keywords', content: keywordList.join(', ') } : null,
    { name: 'robots', content: robots },

    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:title', content: resolvedTitle },
    { property: 'og:description', content: resolvedDescription },
    { property: 'og:type', content: type },
    { property: 'og:locale', content: locale },
    resolvedCanonical ? { property: 'og:url', content: resolvedCanonical } : null,
    resolvedImage ? { property: 'og:image', content: resolvedImage } : null,

    { name: 'twitter:card', content: twitterCard },
    { name: 'twitter:title', content: resolvedTitle },
    { name: 'twitter:description', content: resolvedDescription },
    resolvedImage ? { name: 'twitter:image', content: resolvedImage } : null,

    // Caller-supplied extras win over the defaults above (deduped in the hook).
    ...meta,
  ].filter(Boolean);

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    canonical: resolvedCanonical,
    metaTags,
    jsonLd,
  };
};
