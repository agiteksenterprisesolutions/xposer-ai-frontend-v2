// src/utils/voiceProfile.js
//
// Limits and validation for the voice profile, mirroring the server so a save
// that is going to be rejected is caught next to the field that caused it.

export const VOICE_PROFILE_LIMITS = {
  display_name: 120,
  about: 2000,
  greeting: 400,
};

/** The one placeholder the greeting may contain. */
export const ORGANIZATION_PLACEHOLDER = '{organization}';

/** Length after the server's own trimming and whitespace collapsing. */
export const normaliseLength = (value) => (value || '').replace(/\s+/g, ' ').trim().length;

/** The language the page's single greeting is written in. */
export const GREETING_LANGUAGE = 'en';

/** The written greeting to edit: the English entry of `greetings`. */
export const greetingFrom = (profile) =>
  (profile?.greetings || []).find((entry) => entry.language === GREETING_LANGUAGE)?.text ?? profile?.greeting ?? '';

/** What callers hear when no greeting is saved. */
export const defaultGreeting = (name) =>
  `Hello, and welcome to the ${name} reporting line. I am here to help you make a report, safely and in confidence. What would you like to report?`;

/** The greeting as it will open the call, with the placeholder filled in. */
export const renderGreeting = (greeting, name) =>
  greeting.trim() ? greeting.trim().split(ORGANIZATION_PLACEHOLDER).join(name) : defaultGreeting(name);

/**
 * Client-side mirror of the server's rules. Returns { field: message } — empty
 * when the profile can be saved. Blank fields are always valid: they mean
 * "use the default".
 */
export const validateVoiceProfile = (values) => {
  const errors = {};

  Object.entries(VOICE_PROFILE_LIMITS).forEach(([field, max]) => {
    // Measured the way the server stores it — trimmed, whitespace collapsed —
    // so extra spaces never make the form refuse a save the server would take.
    if (normaliseLength(values[field]) > max) {
      errors[field] = `String should have at most ${max} characters`;
    }
  });

  if (!errors.greeting) {
    // Anything in braces other than {organization} is rejected, so a typo like
    // {org} fails here rather than being read out to a caller.
    const unknown = (values.greeting || '')
      .match(/\{[^{}]*\}/g)
      ?.find((token) => token !== ORGANIZATION_PLACEHOLDER);
    if (unknown) {
      errors.greeting = `greeting contains ${unknown}, which is not a known placeholder. Use ${ORGANIZATION_PLACEHOLDER} for the organization's name, or remove the braces.`;
    }
  }

  return errors;
};

/**
 * Turns a 422 into { field: message }. `detail` is an array whose `loc[1]` is
 * the field; the server prefixes custom rules with "Value error, ", which is
 * noise under a field label.
 */
export const parseVoiceProfileErrors = (error) => {
  const detail = error?.response?.data?.detail;
  if (!Array.isArray(detail)) return {};
  return detail.reduce((errors, item) => {
    // Greetings are a list; the page edits the one the admin writes, so any
    // error inside it belongs to that field.
    const raw = item?.loc?.[1];
    const field = raw === 'greetings' ? 'greeting' : raw;
    if (field && !errors[field]) {
      errors[field] = String(item.msg || 'Invalid value').replace(/^Value error, /, '');
    }
    return errors;
  }, {});
};

/** A string `detail`, which the spec says belongs in a toast. */
export const voiceProfileErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
};
