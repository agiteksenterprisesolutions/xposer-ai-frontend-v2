// src/components/reportTypeBuilder/LogicEditor.jsx
//
// When a step or question is shown, written as a sentence: "Show this
// question if [Was anyone hurt?] [is] [Yes]". Rules can only look at questions
// that come earlier — the reporter has not seen later ones yet.
//
// The reporter form reads show/skip from the first rule, so the mode is set
// once for all rules. Yes/No answers are stored as booleans, and a rule on one
// compares against true/false, not the strings "true"/"false".
import { GitBranch, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { normalizeOptions } from '../../utils/reportTypes';
import { hasOptions, isListOperator, isValuelessOperator, operatorsFor } from './model';

const control =
  'h-8 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none transition-colors focus:border-line-accent';

const defaultValueFor = (question) => {
  if (question?.type === 'boolean') return true;
  if (hasOptions(question)) return normalizeOptions(question.options)[0]?.value ?? '';
  return '';
};

const RuleValue = ({ rule, question, onChange }) => {
  const { t } = useTranslation('builder');
  if (isValuelessOperator(rule.operator)) return null;

  if (question?.type === 'boolean') {
    return (
      <select
        aria-label={t('logicEditor.answer')}
        value={String(rule.value === true || rule.value === 'true' || rule.value === 1 || rule.value === '1')}
        onChange={(e) => onChange({ value: e.target.value === 'true' })}
        className={control}
      >
        <option value="true">{t('logic.yes')}</option>
        <option value="false">{t('logic.no')}</option>
      </select>
    );
  }

  if (hasOptions(question)) {
    const options = normalizeOptions(question.options);
    if (isListOperator(rule.operator)) {
      const values = rule.values || [];
      return (
        <div className="flex basis-full flex-wrap gap-1.5" role="group" aria-label={t('logicEditor.answers')}>
          {options.map((option) => {
            const on = values.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ values: on ? values.filter((v) => v !== option.value) : [...values, option.value] })}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  on ? 'border-line-accent bg-accent-soft text-accent-fg' : 'border-line bg-surface text-ink-secondary hover:border-line-strong'
                }`}
              >
                {option.label || option.value}
              </button>
            );
          })}
        </div>
      );
    }
    return (
      <select aria-label={t('logicEditor.answer')} value={rule.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} className={`${control} max-w-full`}>
        <option value="" disabled>
          {t('logicEditor.pickAnswer')}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label || option.value}
          </option>
        ))}
      </select>
    );
  }

  if (isListOperator(rule.operator)) {
    return (
      <input
        aria-label={t('logicEditor.answersCommas')}
        value={(rule.values || []).join(', ')}
        onChange={(e) => onChange({ values: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })}
        placeholder={t('logicEditor.answersPlaceholder')}
        className={`${control} min-w-0 flex-1`}
      />
    );
  }

  return (
    <input
      aria-label={t('logicEditor.answer')}
      type={['number', 'currency'].includes(question?.type) ? 'number' : 'text'}
      value={rule.value ?? ''}
      onChange={(e) => onChange({ value: e.target.value })}
      placeholder={t('logicEditor.answerPlaceholder')}
      className={`${control} min-w-0 flex-1`}
    />
  );
};

/**
 * Props:
 *   logic    – { rules, logic_type } or null
 *   earlier  – the questions before this point, in form order
 *   subject  – 'question' | 'step', for the wording
 *   onChange – (logic | null) => void
 */
const LogicEditor = ({ logic, earlier, subject = 'question', onChange }) => {
  const { t } = useTranslation('builder');
  const rules = logic?.rules || [];
  const mode = rules[0]?.condition_type === 'skip' || rules[0]?.condition_type === 'hide' ? 'skip' : 'show';
  const byName = new Map(earlier.map((q) => [q.name, q]));

  const write = (nextRules, patch = {}) =>
    onChange(nextRules.length ? { logic_type: logic?.logic_type || 'and', ...patch, rules: nextRules } : null);

  const addRule = () => {
    const question = earlier[earlier.length - 1];
    write([
      ...rules,
      {
        condition_type: mode,
        when_question: question?.name || '',
        operator: 'equals',
        value: defaultValueFor(question),
        values: null,
      },
    ]);
  };

  const updateRule = (index, patch) => {
    const next = rules.map((rule, i) => {
      if (i !== index) return rule;
      const merged = { ...rule, ...patch };
      if ('when_question' in patch) {
        const question = byName.get(patch.when_question);
        const allowed = operatorsFor(question).map((o) => o.value);
        if (!allowed.includes(merged.operator)) merged.operator = 'equals';
        merged.value = isListOperator(merged.operator) ? null : defaultValueFor(question);
        merged.values = isListOperator(merged.operator) ? [] : null;
      }
      if ('operator' in patch) {
        const question = byName.get(merged.when_question);
        if (isListOperator(patch.operator)) {
          merged.values = rule.values?.length ? rule.values : rule.value !== '' && rule.value != null ? [String(rule.value)] : [];
          merged.value = null;
        } else if (isValuelessOperator(patch.operator)) {
          merged.value = null;
          merged.values = null;
        } else {
          merged.value = rule.value ?? rule.values?.[0] ?? defaultValueFor(question);
          merged.values = null;
        }
      }
      return merged;
    });
    write(next);
  };

  const setMode = (nextMode) => write(rules.map((rule) => ({ ...rule, condition_type: nextMode })));

  if (earlier.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-ink-muted">
        {subject === 'step' ? t('logicEditor.firstStep') : t('logicEditor.firstQuestion')}
      </p>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t('logicEditor.alwaysShown')}</p>
        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-link hover:bg-accent-soft"
        >
          <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
          {t('logicEditor.addCondition')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-secondary">
        <select aria-label={t('logicEditor.showOrSkip')} value={mode} onChange={(e) => setMode(e.target.value)} className={control}>
          <option value="show">{t('logicEditor.show')}</option>
          <option value="skip">{t('logicEditor.skip')}</option>
        </select>
        <span>{subject === 'step' ? t('logicEditor.thisStepIf') : t('logicEditor.thisQuestionIf')}</span>
        {rules.length > 1 && (
          <>
            <select
              aria-label={t('logicEditor.match')}
              value={logic?.logic_type || 'and'}
              onChange={(e) => write(rules, { logic_type: e.target.value })}
              className={control}
            >
              <option value="and">{t('logicEditor.all')}</option>
              <option value="or">{t('logicEditor.any')}</option>
            </select>
            <span>{t('logicEditor.ofTheseAreTrue')}</span>
          </>
        )}
      </div>

      {rules.map((rule, index) => {
        const question = byName.get(rule.when_question);
        const operators = operatorsFor(question);
        return (
          <div key={index} className="rounded-lg border border-line-accent/40 bg-accent-soft/40 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {index > 0 && (
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {logic?.logic_type === 'or' ? t('logicEditor.or') : t('logicEditor.and')}
                </span>
              )}
              <select
                aria-label={t('logicEditor.question')}
                value={rule.when_question || ''}
                onChange={(e) => updateRule(index, { when_question: e.target.value })}
                className={`${control} min-w-0 max-w-full flex-1 font-medium`}
              >
                {!question && (
                  <option value="" disabled>
                    {rule.when_question ? t('logicEditor.laterQuestion') : t('logicEditor.pickQuestion')}
                  </option>
                )}
                {earlier.map((q) => (
                  <option key={q.id} value={q.name}>
                    {q.label || q.name || t('preview.untitledQuestion')}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => write(rules.filter((_, i) => i !== index))}
                aria-label={t('logicEditor.removeCondition')}
                className="ms-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-danger-soft hover:text-danger-fg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <select
                aria-label={t('logicEditor.comparison')}
                value={rule.operator}
                onChange={(e) => updateRule(index, { operator: e.target.value })}
                className={control}
              >
                {operators.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
                {!operators.some((op) => op.value === rule.operator) && <option value={rule.operator}>{rule.operator}</option>}
              </select>
              <RuleValue rule={rule} question={question} onChange={(patch) => updateRule(index, patch)} />
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addRule}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-link hover:bg-accent-soft"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {t('logicEditor.addAnother')}
      </button>
    </div>
  );
};

export default LogicEditor;
