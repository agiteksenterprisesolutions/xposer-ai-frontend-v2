// src/utils/locale.js
//
// Formatting that follows the interface language. Arabic uses Western digits
// (`-u-nu-latn`): case numbers, amounts and dates stay readable next to
// English text and match what reporters type. Change ARABIC_DIGITS to
// 'arab' for Arabic-Indic digits (٠١٢٣).
import { enUS, ar } from 'date-fns/locale';
import i18n from '../i18n';

const ARABIC_DIGITS = 'latn';

/** The active interface language: 'en' or 'ar'. */
export const currentLanguage = () => i18n.resolvedLanguage || i18n.language || 'en';

/** A BCP 47 tag for Intl (toLocaleString, NumberFormat, DateTimeFormat). */
export const intlLocale = (lang = currentLanguage()) =>
  lang === 'ar' ? `ar-u-nu-${ARABIC_DIGITS}` : 'en-US';

/** The date-fns locale, for `format(date, pattern, { locale })`. */
// `ar`, not `arSA`: it has the full Gregorian month names (نوفمبر). Arabic
// doesn't abbreviate months, and arSA's short forms (نوفـ) read oddly.
export const dateFnsLocale = (lang = currentLanguage()) => (lang === 'ar' ? ar : enUS);

/**
 * English date patterns put the month first ("Nov 16, 2026"); Arabic puts
 * the day first and spells the month out ("16 نوفمبر 2026"). Numeric
 * patterns (yyyy-MM-dd, for the API) are returned unchanged.
 */
export const localizeDatePattern = (pattern, lang = currentLanguage()) => {
  if (lang !== 'ar' || !pattern.includes('MMM')) return pattern;
  return pattern
    .replace(/MMMM? d{1,2}, yyyy/, 'd MMMM yyyy')
    .replace(/MMMM? d{1,2}(?!\w)/, 'd MMMM')
    .replace(/(?<!M)MMM(?!M)/, 'MMMM');
};

export const isRtl = (lang = currentLanguage()) => lang === 'ar';
