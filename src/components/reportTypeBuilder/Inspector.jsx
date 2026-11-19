// src/components/reportTypeBuilder/Inspector.jsx
//
// The right-hand panel: settings for whatever is selected on the canvas — a
// question, or a step when no question is. Common settings are open; the
// rarely needed ones (answer limits, field name, placeholder) are folded away.
//
// A standard question (one in the field catalogue) shows what its answer
// feeds and why it exists, and renders the attributes its entry locks —
// wording and type, and for the core question its answers too — read-only,
// so nobody types an edit the server would undo on save. Its field name is
// its identity and never changes.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Lock, Plus, Trash2, X, GripVertical, Layers } from 'lucide-react';
import QuestionValidationEditor, { validationFieldsFor } from '../forms/QuestionValidationEditor';
import { CURRENCIES, DEFAULT_CURRENCY, SENSITIVE_DATA_CLASSES, normalizeOptions } from '../../utils/reportTypes';
import LogicEditor from './LogicEditor';
import { QUESTION_TYPES, fieldNameFrom, hasOptions, isCore, questionsBefore, typeInfo } from './model';
import { canTurnOff, entryFor } from './catalog';
import { StandardDetails } from './StandardQuestions';

const inputClass =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted';

const Field = ({ label, hint, htmlFor, children, error }) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-secondary">
      {label}
      {hint && <span className="ms-1 font-normal text-ink-muted">{hint}</span>}
    </label>
    {children}
    {error && <p className="text-xs text-danger-fg">{error}</p>}
  </div>
);

const Group = ({ title, aside, children }) => (
  <section className="flex flex-col gap-3 border-t border-line-subtle px-5 py-4">
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
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-start hover:bg-hover"
      >
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted">
          {!open && summary && <span className="truncate">{summary}</span>}
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </span>
      </button>
      {open && <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>}
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
    <span className={`absolute top-1 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${checked ? 'start-6' : 'start-1'}`} />
  </button>
);

// ── Answers for dropdown / checkbox questions ─────────────────────────────────

const OptionsEditor = ({ question, onChange, error }) => {
  const { t } = useTranslation('builder');
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
    // The default label is stored data (like a new question's), so it stays as-is.
    onChange([...options, { value: `option_${n}`, label: `Option ${n}` }]);
  };

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {options.map((option, index) => (
          <li key={index} className="flex items-start gap-1.5">
            <GripVertical className="mt-2.5 h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <input
                aria-label={t('inspector.answerN', { n: index + 1 })}
                value={option.label}
                onChange={(e) => setLabel(index, e.target.value)}
                className={`${inputClass} h-9 py-1.5`}
              />
              {showValues && (
                <input
                  aria-label={t('inspector.storedValueN', { n: index + 1 })}
                  value={option.value}
                  onChange={(e) => onChange(options.map((o, i) => (i === index ? { ...o, value: e.target.value } : o)))}
                  className={`${inputClass} mt-1 h-8 py-1 font-mono text-xs`}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => onChange(options.filter((_, i) => i !== index))}
              aria-label={t('inspector.removeAnswer', { answer: option.label || t('inspector.answerN', { n: index + 1 }) })}
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
          {t('inspector.addAnswer')}
        </button>
        <button type="button" onClick={() => setShowValues((v) => !v)} className="text-xs text-ink-muted hover:text-ink">
          {showValues ? t('inspector.hideValues') : t('inspector.showValues')}
        </button>
      </div>
    </div>
  );
};

/** Answers that can't be changed: routing reads their stored values. */
const LockedOptions = ({ question }) => {
  const { t } = useTranslation('builder');
  return (
  <div className="flex flex-col gap-2">
    <ul className="flex flex-col gap-1">
      {normalizeOptions(question.options).map((option) => (
        <li key={option.value} className="flex items-center gap-2 rounded-lg bg-subtle px-3 py-1.5 text-sm text-ink-secondary">
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          <span className="shrink-0 font-mono text-[11px] text-ink-subtle">{option.value}</span>
        </li>
      ))}
    </ul>
    <p className="flex gap-1.5 text-xs text-ink-muted">
      <Lock className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
      {t('inspector.lockedOptions')}
    </p>
  </div>
  );
};

// ── Question ──────────────────────────────────────────────────────────────────

const QuestionInspector = ({ draft, section, question, issueAbout, onRemove }) => {
  const { t } = useTranslation('builder');
  const { form, updateQuestion, setOptions, setLogic, moveQuestionToSection, catalog } = draft;
  const core = isCore(question);
  const entry = entryFor(catalog, question);
  const locked = new Set(entry?.locked || []);
  const labelLocked = locked.has('label');
  const typeLocked = core || locked.has('type');
  const optionsLocked = locked.has('options');
  // A type saved before the catalogue may differ; the server corrects it on save.
  const drift = entry
    ? [
        labelLocked && question.label !== entry.label && t('inspector.driftWording', { label: entry.label }),
        typeLocked && question.type !== entry.type && t('inspector.driftType', { type: typeInfo(entry.type).label }),
      ].filter(Boolean)
    : [];
  const info = typeInfo(question.type);
  const Icon = info.icon;
  const set = (patch) => updateQuestion(section.id, question.id, patch);
  const errorAbout = (about) => issueAbout?.(question.id, about);
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
          <h2 className="text-sm font-semibold text-ink">{t('inspector.questionSettings')}</h2>
          <label htmlFor={typeSelectId} className="sr-only">
            {t('inspector.questionType')}
          </label>
          <select
            id={typeSelectId}
            value={question.type}
            disabled={typeLocked}
            onChange={(e) => set({ type: e.target.value })}
            className="-ms-1 mt-0.5 max-w-full rounded border-0 bg-transparent px-1 py-0 text-xs text-ink-muted outline-none hover:bg-hover focus-visible:outline-2 focus-visible:outline-focus disabled:hover:bg-transparent"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        {!core && canTurnOff(entry) && (
          <button
            type="button"
            onClick={() => onRemove(section, question)}
            aria-label={entry ? t('inspector.turnOffQuestion') : t('inspector.deleteQuestion')}
            title={entry ? t('inspector.turnOffShort') : t('common:actions.delete')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger-fg"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {entry ? (
        <div className="mx-5 mb-4 flex flex-col gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
          <p className="flex gap-2">
            <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
            <span>
              <span className="font-semibold text-ink">
                {core || !canTurnOff(entry) ? t('inspector.coreAlwaysOn') : t('inspector.standardQuestion')}
              </span>{' '}
              {canTurnOff(entry) ? t('inspector.standardFixedCanTurnOff') : t('inspector.standardFixed')}
            </span>
          </p>
          {entry.drives && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted">{entry.drives}</p>
          )}
          <StandardDetails entry={entry} />
          {drift.length > 0 && (
            <p className="text-warning-fg">{t('inspector.drift', { changes: drift.join(t('inspector.driftJoin')) })}</p>
          )}
        </div>
      ) : (
        core && (
          <p className="mx-5 mb-4 flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
            <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
            {t('inspector.coreNote')}
          </p>
        )
      )}

      <div className="flex flex-col gap-4 px-5 pb-5">
        <Field
          label={t('inspector.question')}
          hint={labelLocked ? t('inspector.standardWording') : undefined}
          htmlFor={`${question.id}-label`}
          error={errorAbout('wording')}
        >
          <div className="relative">
            <textarea
              id={`${question.id}-label`}
              rows={2}
              value={question.label}
              readOnly={labelLocked}
              onChange={(e) => set({ label: e.target.value })}
              placeholder={t('inspector.questionPlaceholder')}
              className={`${inputClass} resize-none ${labelLocked ? 'bg-subtle pe-8 text-ink-secondary' : ''}`}
            />
            {labelLocked && <Lock className="absolute end-3 top-2.5 h-4 w-4 text-ink-subtle" aria-hidden="true" />}
          </div>
        </Field>
        <Field label={t('inspector.hint')} hint={t('common:form.optional')} htmlFor={`${question.id}-help`}>
          <textarea
            id={`${question.id}-help`}
            rows={2}
            value={question.help_text || ''}
            onChange={(e) => set({ help_text: e.target.value })}
            placeholder={t('inspector.hintPlaceholder')}
            className={`${inputClass} resize-none`}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-ink-secondary">{t('inspector.required')}</span>
            <span className="block text-xs text-ink-muted">{t('inspector.requiredHint')}</span>
          </span>
          <Switch checked={Boolean(question.required)} onChange={(required) => set({ required })} label={t('inspector.required')} />
        </div>
        {form.sections.length > 1 && (
          <Field label={t('inspector.step')} htmlFor={`${question.id}-step`}>
            <select
              id={`${question.id}-step`}
              value={section.id}
              onChange={(e) => moveQuestionToSection(section.id, question.id, e.target.value)}
              className={inputClass}
            >
              {form.sections.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i + 1}. {s.title || t('preview.untitledStep')}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {hasOptions(question) && (
        <Group title={t('inspector.answers')} aside={<span className="text-xs text-ink-muted">{normalizeOptions(question.options).length}</span>}>
          {optionsLocked ? (
            <LockedOptions question={question} />
          ) : (
            <OptionsEditor
              question={question}
              onChange={(options) => setOptions(section.id, question.id, options)}
              error={errorAbout('options')}
            />
          )}
        </Group>
      )}

      <Group title={t('inspector.whenToShow')}>
        <LogicEditor
          logic={question.conditional_logic}
          earlier={earlier}
          subject="question"
          onChange={(logic) => setLogic(section.id, question.id, logic)}
        />
        {errorAbout('condition') && <p className="text-xs text-danger-fg">{errorAbout('condition')}</p>}
      </Group>

      <Group title={t('inspector.dataProtection')}>
        <div role="radiogroup" aria-label={t('inspector.sensitivity')} className="grid grid-cols-2 gap-1.5">
          {SENSITIVE_DATA_CLASSES.map((option) => {
            const on = (question.sensitive_data_class || 'none') === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ sensitive_data_class: option.value })}
                className={`rounded-lg border px-2.5 py-2 text-start text-xs transition-colors ${
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
            ? t('inspector.notSensitiveHint')
            : t('inspector.sensitiveHint')}
        </p>
      </Group>

      {limits.length > 0 && (
        <Disclosure title={t('inspector.answerLimits')} summary={limitCount ? t('inspector.limitsSet', { count: limitCount }) : t('inspector.none')}>
          <QuestionValidationEditor
            question={question}
            onChange={(key, value) => set({ validation: { ...question.validation, [key]: value } })}
          />
        </Disclosure>
      )}

      <Disclosure
        title={t('inspector.advanced')}
        summary={question.name || t('inspector.fieldNameLower')}
        defaultOpen={Boolean(question.name && errorAbout('fieldName'))}
      >
        <Field
          label={t('inspector.fieldName')}
          hint={core || entry ? t('handling.fixed') : question._autoName ? t('inspector.followsQuestion') : undefined}
          htmlFor={`${question.id}-name`}
          error={errorAbout('fieldName')}
        >
          <div className="relative">
            <input
              id={`${question.id}-name`}
              value={question.name}
              readOnly={core || Boolean(entry)}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. incident_location"
              className={`${inputClass} font-mono ${core || entry ? 'pe-8' : ''}`}
            />
            {(core || entry) && <Lock className="absolute end-3 top-2.5 h-4 w-4 text-ink-subtle" aria-hidden="true" />}
          </div>
          <p className="text-xs text-ink-muted">{t('inspector.fieldNameHint')}</p>
        </Field>
        {!['boolean', 'multiselect', 'file', 'date', 'datetime', 'time'].includes(question.type) && (
          <Field label={t('inspector.placeholder')} hint={t('common:form.optional')} htmlFor={`${question.id}-placeholder`}>
            <input
              id={`${question.id}-placeholder`}
              value={question.placeholder || ''}
              onChange={(e) => set({ placeholder: e.target.value })}
              placeholder={t('inspector.placeholderPlaceholder')}
              className={inputClass}
            />
          </Field>
        )}
        {question.type === 'currency' && (
          <Field label={t('inspector.defaultCurrency')} htmlFor={`${question.id}-currency`}>
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
            <p className="text-xs text-ink-muted">{t('inspector.currencyHint')}</p>
          </Field>
        )}
      </Disclosure>
    </>
  );
};

// ── Step ──────────────────────────────────────────────────────────────────────

const SectionInspector = ({ draft, section, sectionIndex, issueAbout }) => {
  const { t } = useTranslation('builder');
  const { form, updateSection, removeSection, setLogic } = draft;
  const holdsCore = section.questions.some((q) => isCore(q) || !canTurnOff(entryFor(draft.catalog, q)));
  const errorAbout = (about) => issueAbout?.(section.id, about);
  const earlier = questionsBefore(form.sections, section.id);

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
          <Layers className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">{t('inspector.stepSettings')}</h2>
          <p className="text-xs text-ink-muted">
            {t('preview.stepOf', { n: sectionIndex + 1, total: form.sections.length })} ·{' '}
            {t('inspector.questionCount', { count: section.questions.length })}
          </p>
        </div>
        {!holdsCore && (
          <button
            type="button"
            onClick={() => {
              if (section.questions.length === 0 || window.confirm(t('inspector.deleteStepConfirm'))) removeSection(section.id);
            }}
            aria-label={t('inspector.deleteStep')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger-fg"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 px-5 pb-5">
        <Field label={t('inspector.title')} htmlFor={`${section.id}-title`} error={errorAbout('title')}>
          <input
            id={`${section.id}-title`}
            value={section.title}
            onChange={(e) => updateSection(section.id, { title: e.target.value })}
            placeholder={t('inspector.titlePlaceholder')}
            className={inputClass}
          />
        </Field>
        <Field label={t('inspector.introduction')} hint={t('common:form.optional')} htmlFor={`${section.id}-description`}>
          <textarea
            id={`${section.id}-description`}
            rows={3}
            value={section.description || ''}
            onChange={(e) => updateSection(section.id, { description: e.target.value })}
            placeholder={t('inspector.introPlaceholder')}
            className={`${inputClass} resize-none`}
          />
        </Field>
        {holdsCore && (
          <p className="flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
            <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
            {t('inspector.holdsCore')}
          </p>
        )}
      </div>

      <Group title={t('inspector.whenToShowStep')}>
        <LogicEditor
          logic={section.conditional_logic}
          earlier={earlier}
          subject="step"
          onChange={(logic) => setLogic(section.id, null, logic)}
        />
        {errorAbout('condition') && <p className="text-xs text-danger-fg">{errorAbout('condition')}</p>}
      </Group>
    </>
  );
};

const Inspector = ({ draft, issueAbout, onRemove }) => {
  const { t } = useTranslation('builder');
  const { selected } = draft;
  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm font-medium text-ink">{t('inspector.nothingSelected')}</p>
        <p className="text-sm text-ink-muted">{t('inspector.nothingSelectedHint')}</p>
      </div>
    );
  }
  return selected.question ? (
    <QuestionInspector
      key={selected.question.id}
      draft={draft}
      section={selected.section}
      question={selected.question}
      issueAbout={issueAbout}
      onRemove={onRemove}
    />
  ) : (
    <SectionInspector
      key={selected.section.id}
      draft={draft}
      section={selected.section}
      sectionIndex={selected.sectionIndex}
      issueAbout={issueAbout}
    />
  );
};

export default Inspector;
