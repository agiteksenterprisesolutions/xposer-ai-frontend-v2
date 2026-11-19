// src/i18n/index.js
//
// Interface languages (react-i18next). Text lives in src/locales/<lang>/<ns>.json,
// one namespace per area of the app. Every file in those folders is picked up
// on its own; add a namespace by adding the same file under each language.
//
//   const { t } = useTranslation('submit');
//   t('picker.title')                         // submit.json → picker.title
//   t('common:actions.cancel')                // another namespace
//   t('reports', { count })                   // plurals: reports_one, reports_other
//                                             // (Arabic also _zero, _two, _few, _many)
//
// Only interface text is translated here. Content an organization writes
// (report types, questions, packs) comes from the API in the language it was
// written in, until the backend stores translations.
//
// The choice is kept under `xposer-lang` in localStorage. index.html reads the
// same key before first paint, so an Arabic page never flashes left-to-right.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const LANGUAGES = [
  { code: 'en', native: 'English', dir: 'ltr' },
  { code: 'ar', native: 'العربية', dir: 'rtl' },
];
export const STORAGE_KEY = 'xposer-lang';
// Set when the visitor picks a language with the switcher. A portal's default
// language (usePortal) only applies until they do.
export const CHOSEN_KEY = 'xposer-lang-chosen';

const files = import.meta.glob('../locales/*/*.json', { eager: true, import: 'default' });
const resources = {};
for (const [path, messages] of Object.entries(files)) {
  const [, lang, ns] = path.match(/locales\/([^/]+)\/([^/]+)\.json$/);
  (resources[lang] ||= {})[ns] = messages;
}

export const dirFor = (lang) => (LANGUAGES.find((l) => l.code === lang)?.dir || 'ltr');

const applyToDocument = (lang) => {
  const root = document.documentElement;
  root.setAttribute('lang', lang);
  root.setAttribute('dir', dirFor(lang));
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true, // ar-AE, ar-SA → ar
    load: 'languageOnly',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: Object.keys(resources.en || {}),
    interpolation: { escapeValue: false }, // React escapes already
    returnNull: false,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

applyToDocument(i18n.resolvedLanguage || 'en');
i18n.on('languageChanged', (lang) => applyToDocument(i18n.resolvedLanguage || lang));

export default i18n;
