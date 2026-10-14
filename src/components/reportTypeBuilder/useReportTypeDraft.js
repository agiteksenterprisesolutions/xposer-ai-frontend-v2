// src/components/reportTypeBuilder/useReportTypeDraft.js
//
// The report type being built, and every edit to it. State is replaced, never
// mutated, so React sees each change. Sections and questions are addressed by
// id rather than index: a selection stays put when things above it move.
//
// With the field catalogue loaded (setCatalog), standard questions are
// guarded here as well as in the UI: their field name never changes, the
// attributes in their `locked` list can't be edited, and one that can't be
// turned off can't be removed.
import { useCallback, useMemo, useState } from 'react';
import { GOVERNANCE_DEFAULTS, normalizeOption } from '../../utils/reportTypes';
import {
  fieldNameFrom,
  hasOptions,
  isCore,
  newQuestion,
  newSection,
  uniqueFieldName,
} from './model';
import { canTurnOff, entryFor, insertStandard, withCatalogFlags } from './catalog';

const initialForm = (data) => ({
  ...GOVERNANCE_DEFAULTS,
  approved_by: null,
  approved_at: null,
  name: '',
  description: '',
  sections: [],
  ...data,
});

const moveItem = (list, index, delta) => {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** Points every rule that looked at `from` at `to` instead. */
const renameReferences = (sections, from, to) => {
  if (!from || from === to) return sections;
  const fix = (logic) =>
    logic?.rules?.some((rule) => rule.when_question === from)
      ? { ...logic, rules: logic.rules.map((rule) => (rule.when_question === from ? { ...rule, when_question: to } : rule)) }
      : logic;
  return sections.map((section) => ({
    ...section,
    conditional_logic: fix(section.conditional_logic),
    questions: section.questions.map((question) => ({ ...question, conditional_logic: fix(question.conditional_logic) })),
  }));
};

const useReportTypeDraft = (initialData) => {
  const [form, setForm] = useState(() => initialForm(initialData));
  // What the right-hand panel edits: { sectionId, questionId? }.
  const [selection, setSelection] = useState(() => {
    const first = initialData?.sections?.[0];
    return first ? { sectionId: first.id, questionId: first.questions?.[0]?.id ?? null } : null;
  });
  const [dirty, setDirty] = useState(false);
  const [catalog, setCatalogState] = useState(null);

  /** The field catalogue arrived: mark core questions from it. Not an edit. */
  const setCatalog = useCallback((next) => {
    setCatalogState(next);
    if (next) setForm((prev) => ({ ...prev, sections: withCatalogFlags(prev.sections, next) }));
  }, []);
  const reserved = useMemo(() => (catalog ? [...catalog.byName.keys()] : []), [catalog]);

  const update = useCallback((fn) => {
    setForm(fn);
    setDirty(true);
  }, []);

  const setField = useCallback((field, value) => update((prev) => ({ ...prev, [field]: value })), [update]);

  const mapSections = useCallback(
    (fn) => update((prev) => ({ ...prev, sections: fn(prev.sections) })),
    [update],
  );

  const mapSection = useCallback(
    (sectionId, fn) => mapSections((sections) => sections.map((s) => (s.id === sectionId ? fn(s) : s))),
    [mapSections],
  );

  // ── Sections ──────────────────────────────────────────────────────────────

  const addSection = useCallback(
    (afterSectionId) => {
      const section = newSection({ title: '' });
      mapSections((sections) => {
        const index = sections.findIndex((s) => s.id === afterSectionId);
        if (index === -1) return [...sections, section];
        return [...sections.slice(0, index + 1), section, ...sections.slice(index + 1)];
      });
      setSelection({ sectionId: section.id, questionId: null });
      return section.id;
    },
    [mapSections],
  );

  const updateSection = useCallback(
    (sectionId, patch) => mapSection(sectionId, (section) => ({ ...section, ...patch })),
    [mapSection],
  );

  /** False when the section holds core questions, which must stay. */
  const removeSection = useCallback(
    (sectionId) => {
      const section = form.sections.find((s) => s.id === sectionId);
      if (!section || section.questions.some((q) => isCore(q) || !canTurnOff(entryFor(catalog, q)))) return false;
      const index = form.sections.indexOf(section);
      mapSections((sections) => sections.filter((s) => s.id !== sectionId));
      const neighbour = form.sections[index + 1] || form.sections[index - 1];
      setSelection(neighbour ? { sectionId: neighbour.id, questionId: null } : null);
      return true;
    },
    [form.sections, mapSections, catalog],
  );

  const moveSection = useCallback(
    (sectionId, delta) =>
      mapSections((sections) => moveItem(sections, sections.findIndex((s) => s.id === sectionId), delta)),
    [mapSections],
  );

  /** Drag and drop: puts a step at `index` of the list. */
  const moveSectionTo = useCallback(
    (sectionId, index) =>
      mapSections((sections) => {
        const from = sections.findIndex((s) => s.id === sectionId);
        if (from === -1) return sections;
        const next = sections.filter((s) => s.id !== sectionId);
        next.splice(Math.max(0, Math.min(index > from ? index - 1 : index, next.length)), 0, sections[from]);
        return next;
      }),
    [mapSections],
  );

  // ── Questions ─────────────────────────────────────────────────────────────

  const addQuestion = useCallback(
    (sectionId, type = 'text', afterQuestionId = null) => {
      // The organization's own question, whatever it ends up being called.
      const question = newQuestion(type, { _custom: true });
      mapSection(sectionId, (section) => {
        const index = section.questions.findIndex((q) => q.id === afterQuestionId);
        const questions =
          index === -1
            ? [...section.questions, question]
            : [...section.questions.slice(0, index + 1), question, ...section.questions.slice(index + 1)];
        return { ...section, questions };
      });
      setSelection({ sectionId, questionId: question.id });
      return question.id;
    },
    [mapSection],
  );

  const updateQuestion = useCallback(
    (sectionId, questionId, patch) =>
      update((prev) => {
        const section = prev.sections.find((s) => s.id === sectionId);
        const question = section?.questions.find((q) => q.id === questionId);
        if (!question) return prev;
        const next = { ...question, ...patch };

        // A core field's key and type are fixed.
        if (isCore(question)) {
          next.name = question.name;
          next.type = question.type;
          next.is_core_field = true;
        }
        // A standard question keeps its name, and whatever its entry locks.
        const entry = entryFor(catalog, question);
        if (entry) {
          next.name = question.name;
          (entry.locked || []).forEach((attribute) => {
            next[attribute] = question[attribute];
          });
        }
        const fixedType = isCore(question) || entry?.locked?.includes('type');

        if ('name' in patch && !isCore(question) && !entry) next._autoName = false;
        if ('label' in patch && question._autoName && !entry) {
          next.name = uniqueFieldName(fieldNameFrom(patch.label), prev.sections, questionId, reserved);
        }

        if ('type' in patch && patch.type !== question.type && !fixedType) {
          next.validation = {};
          if (!hasOptions(next)) next.options = [];
          else if (!question.options?.length) next.options = newQuestion(patch.type).options;
          if (patch.type !== 'currency' && typeof next.default_value === 'object') next.default_value = '';
        }

        let sections = prev.sections.map((s) =>
          s.id === sectionId ? { ...s, questions: s.questions.map((q) => (q.id === questionId ? next : q)) } : s,
        );
        // Rules refer to questions by field name; keep them pointing at this one.
        if (next.name !== question.name) sections = renameReferences(sections, question.name, next.name);
        return { ...prev, sections };
      }),
    [update, catalog, reserved],
  );

  /** False for a core question, which can't be removed. */
  const removeQuestion = useCallback(
    (sectionId, questionId) => {
      const section = form.sections.find((s) => s.id === sectionId);
      const index = section?.questions.findIndex((q) => q.id === questionId) ?? -1;
      if (index === -1 || isCore(section.questions[index]) || !canTurnOff(entryFor(catalog, section.questions[index]))) return false;
      mapSection(sectionId, (s) => ({ ...s, questions: s.questions.filter((q) => q.id !== questionId) }));
      const neighbour = section.questions[index + 1] || section.questions[index - 1];
      setSelection({ sectionId, questionId: neighbour?.id ?? null });
      return true;
    },
    [form.sections, mapSection, catalog],
  );

  // ── Standard questions ────────────────────────────────────────────────────

  /** Asks a standard question: its catalogue entry, inserted as given, in its place. */
  const turnOnStandard = useCallback(
    (name) => {
      const entry = catalog?.byName.get(name);
      if (!entry) return;
      const existing = form.sections
        .flatMap((s) => s.questions.map((q) => ({ s, q })))
        .find(({ q }) => entryFor(catalog, q)?.name === name);
      if (existing) {
        setSelection({ sectionId: existing.s.id, questionId: existing.q.id });
        return;
      }
      const placed = insertStandard(form.sections, entry, catalog);
      update((prev) => ({ ...prev, sections: placed.sections }));
      setSelection({ sectionId: placed.sectionId, questionId: placed.questionId });
    },
    [catalog, form.sections, update],
  );

  /** Stops asking a standard question. False for one that can't be turned off. */
  const turnOffStandard = useCallback(
    (name) => {
      const found = form.sections
        .flatMap((s) => s.questions.map((q) => ({ s, q })))
        .find(({ q }) => entryFor(catalog, q)?.name === name);
      if (!found) return true;
      return removeQuestion(found.s.id, found.q.id);
    },
    [catalog, form.sections, removeQuestion],
  );

  const moveQuestion = useCallback(
    (sectionId, questionId, delta) =>
      mapSection(sectionId, (section) => ({
        ...section,
        questions: moveItem(section.questions, section.questions.findIndex((q) => q.id === questionId), delta),
      })),
    [mapSection],
  );

  /** Moves a question to the end of another step. */
  const moveQuestionToSection = useCallback(
    (fromSectionId, questionId, toSectionId) => {
      if (fromSectionId === toSectionId) return;
      update((prev) => {
        const question = prev.sections.find((s) => s.id === fromSectionId)?.questions.find((q) => q.id === questionId);
        if (!question) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) => {
            if (s.id === fromSectionId) return { ...s, questions: s.questions.filter((q) => q.id !== questionId) };
            if (s.id === toSectionId) return { ...s, questions: [...s.questions, question] };
            return s;
          }),
        };
      });
      setSelection({ sectionId: toSectionId, questionId });
    },
    [update],
  );

  /** Drag and drop: puts a question at `index` of a step (the same one or another). */
  const moveQuestionTo = useCallback(
    (fromSectionId, questionId, toSectionId, index) => {
      update((prev) => {
        const from = prev.sections.find((s) => s.id === fromSectionId);
        const question = from?.questions.find((q) => q.id === questionId);
        if (!question) return prev;
        const fromIndex = from.questions.indexOf(question);
        const sections = prev.sections.map((s) =>
          s.id === fromSectionId ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) } : s,
        );
        return {
          ...prev,
          sections: sections.map((s) => {
            if (s.id !== toSectionId) return s;
            const at = fromSectionId === toSectionId && index > fromIndex ? index - 1 : index;
            const questions = [...s.questions];
            questions.splice(Math.max(0, Math.min(at, questions.length)), 0, question);
            return { ...s, questions };
          }),
        };
      });
      setSelection({ sectionId: toSectionId, questionId });
    },
    [update],
  );

  const duplicateQuestion = useCallback(
    (sectionId, questionId) => {
      const section = form.sections.find((s) => s.id === sectionId);
      const source = section?.questions.find((q) => q.id === questionId);
      if (!source) return;
      const copy = newQuestion(source.type, {
        ...source,
        id: undefined,
        label: `${source.label} (copy)`,
        // A copy is an ordinary question, even when copied from a core field.
        is_core_field: false,
        _custom: true,
        _autoName: false,
        name: uniqueFieldName(`${source.name || fieldNameFrom(source.label)}_copy`, form.sections, null, reserved),
      });
      copy.id = newQuestion().id;
      mapSection(sectionId, (s) => {
        const index = s.questions.findIndex((q) => q.id === questionId);
        return { ...s, questions: [...s.questions.slice(0, index + 1), copy, ...s.questions.slice(index + 1)] };
      });
      setSelection({ sectionId, questionId: copy.id });
    },
    [form.sections, mapSection, reserved],
  );

  // ── Options ───────────────────────────────────────────────────────────────

  const setOptions = useCallback(
    (sectionId, questionId, options) =>
      updateQuestion(sectionId, questionId, {
        options: options.map((option, index) => ({ ...normalizeOption(option, index), display_order: index })),
      }),
    [updateQuestion],
  );

  // ── Conditions ────────────────────────────────────────────────────────────

  /** Sets the show-when logic of a section (questionId null) or a question. */
  const setLogic = useCallback(
    (sectionId, questionId, logic) => {
      const cleaned = logic?.rules?.length ? logic : null;
      if (questionId) updateQuestion(sectionId, questionId, { conditional_logic: cleaned });
      else updateSection(sectionId, { conditional_logic: cleaned });
    },
    [updateQuestion, updateSection],
  );

  const selected = useMemo(() => {
    if (!selection) return null;
    const section = form.sections.find((s) => s.id === selection.sectionId);
    if (!section) return null;
    const question = selection.questionId ? section.questions.find((q) => q.id === selection.questionId) : null;
    return { section, question: question || null, sectionIndex: form.sections.indexOf(section) };
  }, [form.sections, selection]);

  return {
    form,
    dirty,
    catalog,
    setCatalog,
    turnOnStandard,
    turnOffStandard,
    moveSectionTo,
    moveQuestionTo,
    setDirty,
    selection,
    selected,
    select: setSelection,
    setField,
    addSection,
    updateSection,
    removeSection,
    moveSection,
    addQuestion,
    updateQuestion,
    removeQuestion,
    moveQuestion,
    moveQuestionToSection,
    duplicateQuestion,
    setOptions,
    setLogic,
  };
};

export default useReportTypeDraft;
