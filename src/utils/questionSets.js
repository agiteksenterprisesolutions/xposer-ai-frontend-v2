// src/utils/questionSets.js
//
// Shared vocabulary for the voice agent's question set, plus a client-side
// mirror of the server's 422 rules so an admin sees a problem next to the
// offending field instead of as one toast after a rejected save.

/**
 * The type does not change how a question is asked — everything is asked
 * conversationally, in the caller's own language. It only decides what the
 * answer is normalized into for storage, which is what makes the dashboard
 * able to filter and chart it.
 */
export const QUESTION_TYPES = [
  { value: 'text', label: 'Text', hint: 'Free-form answer in the caller\'s own words' },
  { value: 'date', label: 'Date', hint: 'Stored as 2026-08-20' },
  { value: 'choice', label: 'Single choice', hint: 'Exactly one of the options' },
  { value: 'multi_choice', label: 'Multiple choice', hint: 'Any number of the options' },
  { value: 'boolean', label: 'Yes / No', hint: 'Stored as true or false' },
  { value: 'number', label: 'Number', hint: 'Stored as a number' },
];

/** Only these two carry options; the server rejects options on anything else. */
export const CHOICE_TYPES = ['choice', 'multi_choice'];

export const hasOptions = (type) => CHOICE_TYPES.includes(type);

export const getTypeLabel = (type) =>
  QUESTION_TYPES.find((entry) => entry.value === type)?.label || type;

/** Keys are the storage identity of an answer — letters, numbers, _ and -. */
const KEY_PATTERN = /^[A-Za-z0-9_-]+$/;

export const isValidQuestionKey = (key) => KEY_PATTERN.test(key || '');

/**
 * Derives a key from a label. Recomputed whenever the label changes — the
 * admin never types one and never sees one.
 *
 * Renaming is safe because a submitted report stores its own copy of the
 * questions it was asked, keys and labels together. Nothing done to the
 * current list can reach back into a report already filed.
 *
 * `taken` is the set of keys already in the set, so the suffix keeps them
 * unique without the server having to reject the save.
 */
export const toKey = (label = '', taken = new Set()) => {
  let base = label
    .toLowerCase()
    .replace(/['’]/g, '') // don't -> dont, rather than don_t
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    .replace(/_+$/, '');

  if (!base) base = 'question'; // the label was punctuation, or not yet typed

  let key = base;
  let n = 2;
  while (taken.has(key)) {
    key = `${base}_${n}`;
    n += 1;
  }
  return key;
};

/**
 * A stable client-side identity for a question row. React needs a key that
 * survives editing, and the question's own `key` changes with every keystroke
 * in the label — using it would remount the input mid-word.
 */
let idCounter = 0;
const newRowId = () => `q-${(idCounter += 1)}`;

export const createEmptyQuestion = () => ({
  id: newRowId(),
  key: '',
  label: '',
  required: true,
  help_text: '',
  type: 'text',
  options: [],
});

/**
 * Validation mirroring the backend's 422s, keyed by question index so each
 * message can be shown against its own field.
 *
 * Keys are derived rather than typed, so a key error here means a bug on our
 * side — it is still checked, because two questions sharing a key would file
 * their answers in one place.
 */
export const validateQuestionSet = (questions = []) => {
  const errors = {};
  const seenKeys = new Map();

  questions.forEach((question, index) => {
    const issues = {};
    const key = (question.key || '').trim();
    const label = (question.label || '').trim();

    if (!key) {
      issues.key = 'This question has no key — remove it and add it again';
    } else if (!isValidQuestionKey(key)) {
      issues.key = 'This question has an invalid key — remove it and add it again';
    } else if (seenKeys.has(key)) {
      issues.key = `Shares a key with question ${seenKeys.get(key) + 1}`;
    } else {
      seenKeys.set(key, index);
    }

    if (!label) issues.label = 'Label cannot be empty';

    if (hasOptions(question.type)) {
      const options = (question.options || []).map((option) => option.trim()).filter(Boolean);
      if (options.length < 2) {
        issues.options = `A '${question.type}' question needs at least two options`;
      } else {
        // The server compares case-insensitively: "High" and "high" collide.
        const seen = new Set(options.map((option) => option.toLowerCase()));
        if (seen.size !== options.length) issues.options = 'Options must be unique';
      }
    } else if ((question.options || []).length > 0) {
      issues.options = 'Options are only valid on choice or multi-choice questions';
    }

    if (Object.keys(issues).length > 0) errors[index] = issues;
  });

  return errors;
};

/** Strips client-only fields and normalizes before sending the whole list. */
export const serializeQuestions = (questions = []) =>
  questions.map((question) => ({
    key: question.key.trim(),
    label: question.label.trim(),
    required: question.required !== false,
    help_text: question.help_text?.trim() ? question.help_text.trim() : null,
    type: question.type || 'text',
    options: hasOptions(question.type)
      ? (question.options || []).map((option) => option.trim()).filter(Boolean)
      : [],
  }));

/** Adds the client-only flags to questions arriving from the API. */
export const hydrateQuestions = (questions = []) =>
  questions.map((question) => ({
    id: newRowId(),
    key: question.key || '',
    label: question.label || '',
    required: question.required !== false,
    help_text: question.help_text || '',
    type: question.type || 'text',
    options: question.options || [],
  }));

// ─── Rendering collected answers ──────────────────────────────────────────

/**
 * An answer is not always a string: multi_choice gives an array, boolean a
 * bool, number a number. Anything rendering these has to cope with all of it.
 */
export const formatVoiceAnswer = (answer) => {
  if (answer === null || answer === undefined || answer === '') return null;
  if (Array.isArray(answer)) {
    return answer.length > 0 ? answer.join(', ') : null;
  }
  if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
  return String(answer);
};

/** Reads the collected answers off a report, whatever shape it arrived in. */
export const getVoiceAnswers = (report) =>
  Array.isArray(report?.voice_answers) ? report.voice_answers : [];

/** The questions a report was asked, as captured when it was submitted. */
export const getCapturedQuestions = (report) =>
  Array.isArray(report?.question_set?.questions) ? report.question_set.questions : [];

/** Last-resort label for an answer whose question is nowhere to be found. */
export const humaniseKey = (key = '') => {
  const words = String(key).replace(/[_-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Question';
};

/**
 * Pairs each collected answer with the question it was asked, joining on key
 * inside the report's own document.
 *
 * The join never touches the live question set. A report filed in March shows
 * March's wording and March's type even after the question was reworded or
 * switched in July — reading the current config would attribute an answer to a
 * question that was never asked for it.
 *
 * Two steps, then a last resort: the captured block, then whatever the answer
 * carries inline (which is what reports filed before snapshots have), then the
 * key itself. An answer is never dropped for want of a label.
 */
export const buildVoiceAnswerRows = (report) => {
  const captured = getCapturedQuestions(report);
  const hasSnapshot = Boolean(report?.question_set);
  const byKey = new Map(captured.map((question) => [question.key, question]));

  return getVoiceAnswers(report).map((answer) => {
    const question = byKey.get(answer?.key);
    return {
      key: answer?.key,
      label: question?.label ?? answer?.question ?? humaniseKey(answer?.key),
      type: question?.type ?? answer?.type ?? 'text',
      options: question?.options ?? [],
      answer: answer?.answer,
      skipped: answer?.skipped === true,
      // Only meaningful against a snapshot: the question was removed from the
      // set after this call. The answer is no less real for it, so it renders
      // like any other.
      retired: hasSnapshot && !question,
    };
  });
};
