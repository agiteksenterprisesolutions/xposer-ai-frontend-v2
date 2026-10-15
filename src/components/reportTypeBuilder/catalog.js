// src/components/reportTypeBuilder/catalog.js
//
// The standard questions (GET /report-types/field-catalog): question names
// the platform knows the meaning of, so an answer can be counted across
// report types. One tier is core — the platform reads its answer by name, so
// a live type must ask it; the rest are recommended (on by default) or
// optional (off by default).
//
// For a standard question the admin decides whether to ask it, in what order
// and in which step — never its wording or type (the attributes in `locked`).
// Turning one on inserts the catalogue entry as given: restating a label here
// would produce a question that differs from what an Excel import produces
// for the same name, and the backend would correct it on save.
//
// A question whose name isn't in the catalogue is entirely the organization's.
import { normalizeOptions, normalizeValidation } from '../../utils/reportTypes';
import { newQuestion, newSection } from './model';

// What a catalogue entry says about the question, as opposed to the question itself.
const META = ['tier', 'can_disable', 'default_on', 'locked', 'drives', 'why', 'if_disabled', 'section'];

// A step created to hold standard questions, before the admin renames it.
const SECTION_TITLES = {
  sec_basics: 'Report basics',
  sec_governance: 'About you and this report',
};

/**
 * The catalogue as the builder uses it: entries in `baseline_order` (the
 * order a reporter meets them), then any others; by name; and each one's
 * position, for placing it among the others.
 */
export const buildCatalog = (raw) => {
  if (!raw) return null;
  const entries = [...(raw.core || []), ...(raw.recommended || []), ...(raw.optional || [])];
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const baseline = (raw.baseline_order || []).filter((name) => byName.has(name));
  const ordered = [
    ...baseline.map((name) => byName.get(name)),
    ...entries.filter((entry) => !baseline.includes(entry.name)),
  ];
  const rank = new Map(ordered.map((entry, i) => [entry.name, i]));
  // The steps standard questions belong in, in the order a reporter meets them.
  const sectionKeys = [...new Set(ordered.map((entry) => entry.section).filter(Boolean))];
  return { entries: ordered, byName, rank, sectionKeys };
};

/**
 * The catalogue entry a question is, or null for the organization's own. A
 * question someone added and then gave a standard name (`_custom`) is still
 * theirs — that's a name clash, flagged on save, not a standard question.
 */
export const entryFor = (catalog, question) =>
  (question && !question._custom && catalog?.byName.get(question.name)) || null;

export const isLocked = (catalog, question, attribute) => Boolean(entryFor(catalog, question)?.locked?.includes(attribute));

export const canTurnOff = (entry) => entry?.can_disable !== false;

/** The entry as a question, verbatim. */
export const questionFromEntry = (entry) => {
  const fields = Object.fromEntries(Object.entries(entry).filter(([key]) => !META.includes(key)));
  return newQuestion(entry.type, {
    ...fields,
    required: Boolean(entry.required),
    options: normalizeOptions(entry.options || []),
    validation: normalizeValidation(entry.validation),
    is_core_field: entry.tier === 'core',
    _autoName: false,
  });
};

const sectionRank = (catalog, key) => {
  const i = catalog.sectionKeys.indexOf(key);
  return i === -1 ? null : i;
};

/**
 * Puts a standard question where it belongs: in the step for its `section`
 * (made if there isn't one), among the other standard questions in the order
 * a reporter meets them. Returns { sections, sectionId, questionId }.
 */
export const insertStandard = (sections, entry, catalog) => {
  const question = questionFromEntry(entry);
  let next = [...sections];
  let index = next.findIndex((s) => s.section_key === entry.section);

  if (index === -1) {
    const section = newSection({
      section_key: entry.section || null,
      title: SECTION_TITLES[entry.section] || 'Standard questions',
      is_shared: true,
    });
    const own = sectionRank(catalog, entry.section);
    const known = next.map((s) => sectionRank(catalog, s.section_key));
    let at;
    if (own === null) at = next.length;
    else if (known.every((r) => r === null)) at = own === 0 ? 0 : next.length;
    else {
      const later = known.findIndex((r) => r !== null && r > own);
      at = later === -1 ? next.length : later;
    }
    next = [...next.slice(0, at), section, ...next.slice(at)];
    index = at;
  }

  const section = next[index];
  const own = catalog.rank.get(entry.name);
  const before = section.questions.findIndex((q) => {
    const r = entryFor(catalog, q) ? catalog.rank.get(q.name) : undefined;
    return r !== undefined && r > own;
  });
  const questions =
    before === -1
      ? [...section.questions, question]
      : [...section.questions.slice(0, before), question, ...section.questions.slice(before)];
  next[index] = { ...section, questions };
  return { sections: next, sectionId: section.id, questionId: question.id };
};

/** A brand-new type: every standard question that is on by default, in place. */
export const seedSections = (catalog) =>
  catalog.entries
    .filter((entry) => entry.default_on)
    .reduce((sections, entry) => insertStandard(sections, entry, catalog).sections, []);

/** Standard questions the form asks, by name. */
export const askedNames = (sections) => new Set(sections.flatMap((s) => s.questions).filter((q) => !q._custom).map((q) => q.name));

/** Core questions a live type must ask and this one doesn't. */
export const missingCore = (form, catalog) => {
  if (!catalog) return [];
  const asked = askedNames(form.sections || []);
  return catalog.entries.filter((entry) => !canTurnOff(entry) && !asked.has(entry.name));
};

/**
 * `is_core_field` from the catalogue: a question is core when its entry is,
 * and the organization's own questions never are. Older types flagged all ten
 * standard questions as core; only the catalogue's core tier is.
 */
export const withCatalogFlags = (sections, catalog) =>
  sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => {
      const core = entryFor(catalog, question)?.tier === 'core';
      return Boolean(question.is_core_field) === core ? question : { ...question, is_core_field: core };
    }),
  }));
