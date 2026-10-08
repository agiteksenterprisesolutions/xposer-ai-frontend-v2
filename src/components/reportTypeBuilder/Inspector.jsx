// src/components/reportTypeBuilder/Inspector.jsx
//
// The right-hand panel: settings for whatever is selected on the canvas — a
// question, or a step when no question is. Common settings are open; the
// rarely needed ones (answer limits, field name, placeholder) are folded away.
import { useState } from 'react';
import { ChevronDown, Lock, Plus, Trash2, X, GripVertical, Layers } from 'lucide-react';
import QuestionValidationEditor, { validationFieldsFor } from '../forms/QuestionValidationEditor';
import { CURRENCIES, DEFAULT_CURRENCY, SENSITIVE_DATA_CLASSES, normalizeOptions } from '../../utils/reportTypes';
import LogicEditor from './LogicEditor';
import { QUESTION_TYPES, fieldNameFrom, hasOptions, isCore, questionsBefore, typeInfo } from './model';

const inputClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted';

const Field = ({ label, hint, htmlFor, children, error }) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-secondary">
      {label}
      {hint && <span className="ml-1 font-normal text-ink-muted">{hint}</span>}
    </label>
    {children}
    {error && <p className="text-xs text-danger-fg">{error}</p>}
  </div>
);

const Group = ({ title, aside, children }) => (
  <section className="space-y-3 border-t border-line-subtle px-5 py-4">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

const Disclosure = ({ title, summary, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-line-subtle">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-hover"
      >
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
          {!open && summary && <span className="truncate">{summary}</span>}
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {open && <div className="space-y-4 px-5 pb-5">{children}</div>}
    </section>
  );
};

const Switch = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-active'}`}
  >
    <span className={`absolute top-1 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${checked ? 'left-6' : 'left-1'}`} />
  </button>
);

// ── Answers for dropdown / checkbox questions ─────────────────────────────────

const OptionsEditor = ({ question, onChange, error }) => {
  const [showValues, setShowValues] = useState(false);
  const options = normalizeOptions(question.options);

  // A value follows its label while it was generated (option_2, or the slug of
  // the old label); once someone sets it, or it's a meaningful code like a core
  // field's, it stays — stored answers and conditions refer to it.
  const setLabel = (index, label) => {
    const option = options[index];
    const generated = !option.value || /^option_\d+$/.test(option.value) || option.value === fieldNameFrom(option.label);
    const taken = new Set(options.filter((_, i) => i !== index).map((o) => o.value));
    let value = option.value;
    if (generated) {
      const base = fieldNameFrom(label) || `option_${index + 1}`;
      value = base;
      for (let n = 2; taken.has(value); n += 1) value = `${base}_${n}`;
    }
    onChange(options.map((o, i) => (i === index ? { ...o, label, value } : o)));
  };

  const add = () => {
    const taken = new Set(options.map((o) => o.value));
    let n = options.length + 1;
    while (taken.has(`option_${n}`)) n += 1;
    onChange([...options, { value: `option_${n}`, label: `Option ${n}` }]);
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {options.map((option, index) => (
          <li key={index} className="flex items-start gap-1.5">
            <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <input
                aria-label={`Answer ${index + 1}`}
                value={option.label}
                onChange={(e) => setLabel(index, e.target.value)}
                className={`${inputClass} h-9 py-1.5`}
              />
              {showValues && (
                <input
                  aria-label={`Stored value for answer ${index + 1}`}
                  value={option.value}
                  onChange={(e) => onChange(options.map((o, i) => (i === index ? { ...o, value: e.target.value } : o)))}
                  className={`${inputClass} mt-1 h-8 py-1 font-mono text-xs`}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => onChange(options.filter((_, i) => i !== index))}
              aria-label={`Remove ${option.label || `answer ${index + 1}`}`}
              className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-danger-soft hover:text-danger-fg"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-danger-fg">{error}</p>}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-link hover:bg-accent-soft"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add answer
        </button>
        <button type="button" onClick={() => setShowValues((v) => !v)} className="text-xs text-ink-muted hover:text-ink">
          {showValues ? 'Hide stored values' : 'Show stored values'}
        </button>
      </div>
    </div>
  );
};

// ── Question ──────────────────────────────────────────────────────────────────

const QuestionInspector = ({ draft, section, question, issuesFor }) => {
  const { form, updateQuestion, setOptions, setLogic, removeQuestion, moveQuestionToSection } = draft;
  const core = isCore(question);
  const info = typeInfo(question.type);
  const Icon = info.icon;
  const set = (patch) => updateQuestion(section.id, question.id, patch);
  const errors = issuesFor(question.id);
  const errorAbout = (word) => errors.find((m) => m.includes(word));
  const earlier = questionsBefore(form.sections, section.id, question.id);
  const sensitive = SENSITIVE_DATA_CLASSES.find((c) => c.value === (question.sensitive_data_class || 'none'));
  const limits = validationFieldsFor(question.type);
  const limitCount = Object.keys(question.validation || {}).filter((k) => limits.includes(k)).length;
  const typeSelectId = `${question.id}-type`;

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">Question settings</h2>
          <label htmlFor={typeSelectId} className="sr-only">
            Question type
          </label>
          <select
            id={typeSelectId}
            value={question.type}
            disabled={core}
            onChange={(e) => set({ type: e.target.value })}
            className="-ml-1 mt-0.5 max-w-full rounded border-0 bg-transparent px-1 py-0 text-xs text-ink-muted outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus disabled:hover:bg-transparent"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        {!core && (
          <button
            type="button"
            onClick={() => removeQuestion(section.id, question.id)}
            aria-label="Delete question"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger-fg"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {core && (
        <p className="mx-5 mb-4 flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
          <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
          One of the 10 questions every report needs. You can reword it, but not remove it or change its type.
        </p>
      )}

      <div className="space-y-4 px-5 pb-5">
        <Field label="Question" htmlFor={`${question.id}-label`} error={errorAbout('wording')}>
          <textarea
            id={`${question.id}-label`}
            rows={2}
            value={question.label}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="What do you want to ask?"
            className={`${inputClass} resize-none`}
          />
        </Field>
        <Field label="Hint for reporters" hint="optional" htmlFor={`${question.id}-help`}>
          <textarea
            id={`${question.id}-help`}
            rows={2}
            value={question.help_text || ''}
            onChange={(e) => set({ help_text: e.target.value })}
            placeholder="Shown under the question"
            className={`${inputClass} resize-none`}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-ink-secondary">Required</span>
            <span className="block text-xs text-ink-muted">Reporters must answer to continue</span>
          </span>
          <Switch checked={Boolean(question.required)} onChange={(required) => set({ required })} label="Required" />
        </div>
        {form.sections.length > 1 && (
          <Field label="Step" htmlFor={`${question.id}-step`}>
            <select
              id={`${question.id}-step`}
              value={section.id}
              onChange={(e) => moveQuestionToSection(section.id, question.id, e.target.value)}
              className={inputClass}
            >
              {form.sections.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i + 1}. {s.title || 'Untitled step'}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {hasOptions(question) && (
        <Group title="Answers" aside={<span className="text-xs text-ink-muted">{normalizeOptions(question.options).length}</span>}>
          <OptionsEditor
            question={question}
            onChange={(options) => setOptions(section.id, question.id, options)}
            error={errorAbout('answers to choose')}
          />
        </Group>
      )}

      <Group title="When to show it">
        <LogicEditor
          logic={question.conditional_logic}
          earlier={earlier}
          subject="question"
          onChange={(logic) => setLogic(section.id, question.id, logic)}
        />
        {errorAbout('condition') && <p className="text-xs text-danger-fg">{errorAbout('condition')}</p>}
      </Group>

      <Group title="Data protection">
        <div role="radiogroup" aria-label="How sensitive the answer is" className="grid grid-cols-2 gap-1.5">
          {SENSITIVE_DATA_CLASSES.map((option) => {
            const on = (question.sensitive_data_class || 'none') === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ sensitive_data_class: option.value })}
                className={`rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                  on
                    ? 'border-line-accent bg-accent-soft font-semibold text-accent-fg'
                    : 'border-line text-ink-secondary hover:border-line-strong'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-muted">
          {sensitive?.value === 'none'
            ? 'Stored and shown like any other answer.'
            : 'Encrypted when stored. Hidden from staff who lack the View sensitive answers permission, and every time it is shown, the view is logged.'}
        </p>
      </Group>

      {limits.length > 0 && (
        <Disclosure title="Answer limits" summary={limitCount ? `${limitCount} set` : 'none'}>
          <QuestionValidationEditor
            question={question}
            onChange={(key, value) => set({ validation: { ...question.validation, [key]: value } })}
          />
        </Disclosure>
      )}

      <Disclosure title="Advanced" summary={question.name || 'field name'} defaultOpen={Boolean(question.name && errorAbout('field name'))}>
        <Field
          label="Field name"
          hint={core ? 'fixed' : question._autoName ? 'follows the question' : undefined}
          htmlFor={`${question.id}-name`}
          error={errorAbout('field name')}
        >
          <div className="relative">
            <input
              id={`${question.id}-name`}
              value={question.name}
              readOnly={core}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. incident_location"
              className={`${inputClass} font-mono ${core ? 'pr-8' : ''}`}
            />
            {core && <Lock className="absolute right-3 top-2.5 h-4 w-4 text-ink-subtle" aria-hidden="true" />}
          </div>
          <p className="text-xs text-ink-muted">How the answer is stored and exported. Conditions refer to it.</p>
        </Field>
        {!['boolean', 'multiselect', 'file', 'date', 'datetime', 'time'].includes(question.type) && (
          <Field label="Placeholder" hint="optional" htmlFor={`${question.id}-placeholder`}>
            <input
              id={`${question.id}-placeholder`}
              value={question.placeholder || ''}
              onChange={(e) => set({ placeholder: e.target.value })}
              placeholder="Example text inside the empty field"
              className={inputClass}
            />
          </Field>
        )}
        {question.type === 'currency' && (
          <Field label="Default currency" htmlFor={`${question.id}-currency`}>
            <select
              id={`${question.id}-currency`}
              value={question.default_value?.currency || DEFAULT_CURRENCY}
              onChange={(e) => set({ default_value: { currency: e.target.value, amount_minor: null } })}
              className={inputClass}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-muted">Reporters can pick another.</p>
          </Field>
        )}
      </Disclosure>
    </>
  );
};

// ── Step ──────────────────────────────────────────────────────────────────────

const SectionInspector = ({ draft, section, sectionIndex, issuesFor }) => {
  const { form, updateSection, removeSection, setLogic } = draft;
  const holdsCore = section.questions.some(isCore);
  const errors = issuesFor(section.id);
  const earlier = questionsBefore(form.sections, section.id);

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
          <Layers className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">Step settings</h2>
          <p className="text-xs text-ink-muted">
            Step {sectionIndex + 1} of {form.sections.length} · {section.questions.length} question
            {section.questions.length === 1 ? '' : 's'}
          </p>
        </div>
        {!holdsCore && (
          <button
            type="button"
            onClick={() => {
              if (section.questions.length === 0 || window.confirm('Delete this step and its questions?')) removeSection(section.id);
            }}
            aria-label="Delete step"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger-fg"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-4 px-5 pb-5">
        <Field label="Title" htmlFor={`${section.id}-title`} error={errors.find((m) => m.includes('needs a title'))}>
          <input
            id={`${section.id}-title`}
            value={section.title}
            onChange={(e) => updateSection(section.id, { title: e.target.value })}
            placeholder="e.g. People involved"
            className={inputClass}
          />
        </Field>
        <Field label="Introduction" hint="optional" htmlFor={`${section.id}-description`}>
          <textarea
            id={`${section.id}-description`}
            rows={3}
            value={section.description || ''}
            onChange={(e) => updateSection(section.id, { description: e.target.value })}
            placeholder="A line telling reporters what this step covers"
            className={`${inputClass} resize-none`}
          />
        </Field>
        {holdsCore && (
          <p className="flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
            <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
            This step holds required questions, so it can't be deleted. Move them to another step first.
          </p>
        )}
      </div>

      <Group title="When to show this step">
        <LogicEditor
          logic={section.conditional_logic}
          earlier={earlier}
          subject="step"
          onChange={(logic) => setLogic(section.id, null, logic)}
        />
        {errors.find((m) => m.includes('condition')) && (
          <p className="text-xs text-danger-fg">{errors.find((m) => m.includes('condition'))}</p>
        )}
      </Group>
    </>
  );
};

const Inspector = ({ draft, issuesFor }) => {
  const { selected } = draft;
  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm font-medium text-ink">Nothing selected</p>
        <p className="text-sm text-ink-muted">Click a question or step on the form to change its settings.</p>
      </div>
    );
  }
  return selected.question ? (
    <QuestionInspector key={selected.question.id} draft={draft} section={selected.section} question={selected.question} issuesFor={issuesFor} />
  ) : (
    <SectionInspector
      key={selected.section.id}
      draft={draft}
      section={selected.section}
      sectionIndex={selected.sectionIndex}
      issuesFor={issuesFor}
    />
  );
};

export default Inspector;
