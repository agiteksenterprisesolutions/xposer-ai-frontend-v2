// src/utils/posterLang.js
//
// Which language(s) a QR poster is printed in: 'en', 'ar' or 'both'. The
// poster record keeps both languages; this narrows one render response
// (GET /posters/{id}/render) before it is drawn, so the preview, the PDF and
// the preview's text alternative all show the same thing.
//
// A text missing in the chosen language falls back to the other one, so a
// heading written only in Arabic still appears on an English poster.

export const POSTER_LANGS = ['en', 'ar', 'both'];

/** The default choice for an app language. */
export const defaultPosterLang = (appLang) => (appLang === 'ar' ? 'ar' : 'en');

const text = (value) => (typeof value === 'string' && value.trim() ? value : null);

/** One { en, ar } pair narrowed to `lang`, falling back to the other language. */
const pick = (pair, lang) => {
  const en = text(pair?.en);
  const ar = text(pair?.ar);
  if (lang === 'en') return { en: en || null, ar: en ? null : ar };
  if (lang === 'ar') return { en: ar ? null : en, ar: ar || null };
  return { en, ar };
};

/** The render response with every bilingual text narrowed to `lang`. */
export const renderForLang = (render, lang = 'both') => {
  if (!render || lang === 'both') return render;
  const poster = render.poster || {};
  return {
    ...render,
    branding: render.branding && { ...render.branding, display_name: pick(render.branding.display_name, lang) },
    poster: {
      ...poster,
      heading: pick(poster.heading, lang),
      instructions: (poster.instructions || []).map((line) => pick(line, lang)),
      footer: pick(poster.footer, lang),
    },
  };
};

/**
 * The language choices a saved poster offers, from the text the admin wrote
 * (heading, instruction lines, footer; the organization's name doesn't
 * count): ['en', 'ar', 'both'] when it has both, otherwise just the one it
 * has, so there's nothing to ask.
 */
export const availablePosterLangs = (poster) => {
  const pairs = [poster?.heading, ...(poster?.instructions || []), poster?.footer];
  const hasEn = pairs.some((p) => text(p?.en));
  const hasAr = pairs.some((p) => text(p?.ar));
  if (hasEn && hasAr) return POSTER_LANGS;
  if (hasAr) return ['ar'];
  if (hasEn) return ['en'];
  return ['both'];
};

/** The preselected choice: the app's language when offered, else the first. */
export const initialPosterLang = (options, appLang) => {
  const preferred = defaultPosterLang(appLang);
  return options.includes(preferred) ? preferred : options[0];
};
