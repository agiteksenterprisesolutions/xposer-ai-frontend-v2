// src/components/routing/RuleEditor.jsx
//
// Create or edit a routing rule (ROUTING_RULES.md §3, §8). Conditions: report
// type code prefixes, categories, exact codes, legal entities, and answer
// conditions written with the same builder the form editor uses. Actions:
// owner and backup role (only roles that can open cases), flags, raise tier.
//
// A rule needs at least one condition and one action. The server's
// `problems` show next to the field they name; errors block a save (400 with
// detail.problems), warnings are saved and shown.
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import LogicEditor from '../reportTypeBuilder/LogicEditor';
import ChipPicker from './ChipPicker';
import { routingRulesAPI } from '../../api/routingRules';
import { localized } from '../../api/jurisdiction';
import { CONFIDENTIALITY_TIERS } from '../../utils/reportTypes';
import { describeError } from '../../utils/errors';
import {
  FLAG_PATTERN,
  bodyFromForm,
  changedFields,
  emptyForm,
  formFromRule,
  hasAction,
  hasCondition,
  matchingTypes,
  prefixSuggestions,
  problemsFor,
  questionsOf,
  warningsOf,
} from './ruleUtils';

const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-line-accent focus:ring-2 focus:ring-accent-ring';

/** The server's problems for a field, errors first. */
export const ProblemList = ({ problems, className = '' }) => {
  if (!problems?.length) return null;
  const sorted = [...problems].sort((a, b) => (a.severity === 'error' ? -1 : 0) - (b.severity === 'error' ? -1 : 0));
  return (
    <ul className={`space-y-1 ${className}`}>
      {sorted.map((p, i) => {
        const error = p.severity === 'error';
        const Icon = error ? XCircle : AlertTriangle;
        return (
          <li key={`${p.code}-${i}`} className={`flex items-start gap-1.5 text-xs ${error ? 'text-danger-fg' : 'text-warning-fg'}`}>
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span dir="auto">{p.message || p.code}</span>
          </li>
        );
      })}
    </ul>
  );
};

const Section = ({ title, intro, children }) => (
  <section className="space-y-4 rounded-xl border border-line p-4">
    <div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {intro && <p className="mt-0.5 text-xs text-ink-muted">{intro}</p>}
    </div>
    {children}
  </section>
);

const RuleEditor = ({ isOpen, rule, onClose, onSaved, types = [], entities = [], roles = [], triggers = [], nameFor = (c) => c }) => {
  const { t } = useTranslation('routing');
  const editing = Boolean(rule);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [problems, setProblems] = useState([]);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const ids = { name: useId(), desc: useId(), priority: useId(), owner: useId(), backup: useId(), tier: useId() };

  useEffect(() => {
    if (!isOpen) return;
    setForm(rule ? formFromRule(rule) : emptyForm());
    setProblems(rule?.problems || []);
    setErrors({});
    setServerError(null);
  }, [isOpen, rule]);

  const setTop = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const setMatch = (key, value) => {
    setForm((f) => ({ ...f, match: { ...f.match, [key]: value } }));
    setErrors((e) => ({ ...e, condition: undefined }));
  };
  const setAction = (key, value) => {
    setForm((f) => ({ ...f, actions: { ...f.actions, [key]: value } }));
    setErrors((e) => ({ ...e, action: undefined }));
  };

  // The answer conditions can ask about the questions of the types this rule
  // selects; with no type condition, every type's questions.
  const selected = useMemo(() => matchingTypes(types, form.match), [types, form.match]);
  const questions = useMemo(() => {
    const own = questionsOf(selected);
    return own.length ? own : questionsOf(types);
  }, [selected, types]);
  const usesCurrency = (form.match.answers?.rules || []).some((r) => questions.find((q) => q.name === r.when_question)?.type === 'currency');

  const typeCodes = useMemo(() => types.filter((ty) => ty.code).map((ty) => ({ value: ty.code, label: `${ty.code} · ${ty.name}`, hint: ty.name })), [types]);
  const categories = useMemo(() => [...new Set(types.map((ty) => ty.category).filter(Boolean))].sort().map((c) => ({ value: c, label: c })), [types]);
  const prefixes = useMemo(() => prefixSuggestions(types).map((p) => ({ value: p, label: `${p}*` })), [types]);
  const entityOptions = entities.map((e) => ({ value: e.code, label: localized(e.name) || e.code, hint: e.code }));
  const flagOptions = triggers.map((tr) => ({ value: tr.code, label: tr.label ? `${tr.code} · ${localized(tr.label)}` : tr.code, hint: tr.regulator }));

  const save = async () => {
    const next = {};
    const name = form.name.trim();
    if (!name || name.length > 120) next.name = t('errors.name');
    const priority = Number(form.priority);
    if (!/^\d+$/.test(String(form.priority).trim()) || priority > 100000) next.priority = t('errors.priority');
    if (!hasCondition(form.match)) next.condition = t('errors.condition');
    if (!hasAction(form.actions)) next.action = t('errors.action');
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = bodyFromForm(form, questions);
    const payload = editing ? changedFields(body, bodyFromForm(formFromRule(rule), questions)) : body;
    if (editing && !Object.keys(payload).length) return onClose();

    setSaving(true);
    setServerError(null);
    try {
      const saved = editing ? await routingRulesAPI.update(rule.id, payload) : await routingRulesAPI.create(payload);
      const warnings = warningsOf(saved?.problems || []);
      if (warnings.length) toast.warning(t('toast.savedWithWarnings', { count: warnings.length }));
      else toast.success(editing ? t('toast.saved') : t('toast.created'));
      onSaved?.(saved);
      onClose();
    } catch (err) {
      const described = describeError(err);
      const list = (described.problems || []).map((p) => ({ severity: 'error', ...p }));
      // 422 from the schema points at body.* paths; keep only the field part.
      setProblems(list.map((p) => ({ ...p, field: p.field?.replace(/^body\./, '') })));
      // The summary sentence (detail.message) sits on top; each problem by its field.
      setServerError(described.summary);
    } finally {
      setSaving(false);
    }
  };

  const fieldProblems = (prefix) => problemsFor(problems, prefix);
  // Problems that name no field we show.
  const shown = ['name', 'priority', 'description', 'match', 'actions'];
  const loose = problems.filter((p) => !p.field || !shown.some((f) => p.field === f || p.field.startsWith(`${f}.`)));

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={editing ? t('editor.editTitle', { name: rule.name }) : t('editor.newTitle')}
      size="large"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} isLoading={saving}>{editing ? t('common:actions.save') : t('editor.create')}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        {serverError && <Alert variant="error">{serverError}</Alert>}
        <ProblemList problems={loose} />

        <Section title={t('editor.details')}>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-1.5">
              <label htmlFor={ids.name} className="block text-sm font-medium text-ink-secondary">
                {t('fields.name')}<span className="ms-0.5 text-danger-fg" aria-hidden="true">*</span>
              </label>
              <input id={ids.name} required maxLength={120} dir="auto" className={inputClass} value={form.name} onChange={(e) => setTop('name', e.target.value)} aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? `${ids.name}-err` : undefined} />
              {errors.name && <p id={`${ids.name}-err`} className="text-xs text-danger-fg">{errors.name}</p>}
              <ProblemList problems={fieldProblems('name')} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={ids.priority} className="block text-sm font-medium text-ink-secondary">{t('fields.priority')}</label>
              <input id={ids.priority} type="number" min="0" max="100000" step="1" inputMode="numeric" className={inputClass} value={form.priority} onChange={(e) => setTop('priority', e.target.value)} aria-describedby={`${ids.priority}-hint`} aria-invalid={errors.priority ? 'true' : undefined} />
              <p id={`${ids.priority}-hint`} className={`text-xs ${errors.priority ? 'text-danger-fg' : 'text-ink-muted'}`}>{errors.priority || t('hints.priority')}</p>
              <ProblemList problems={fieldProblems('priority')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={ids.desc} className="block text-sm font-medium text-ink-secondary">{t('fields.description')}</label>
            <textarea id={ids.desc} rows={2} dir="auto" className={`${inputClass} h-auto min-h-16 py-2`} value={form.description} onChange={(e) => setTop('description', e.target.value)} />
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-secondary">
            <input type="checkbox" className="h-4 w-4" checked={form.active} onChange={(e) => setTop('active', e.target.checked)} />
            {t('fields.active')}
          </label>
        </Section>

        <Section title={t('editor.conditions')} intro={t('editor.conditionsIntro')}>
          {errors.condition && <p className="text-xs text-danger-fg" role="alert">{errors.condition}</p>}
          <ChipPicker
            label={t('fields.codePrefixes')}
            hint={t('hints.codePrefixes')}
            options={prefixes}
            value={form.match.code_prefixes}
            onChange={(v) => setMatch('code_prefixes', v)}
            allowFree
            mono
            normalize={(v) => v.trim().toUpperCase().replace(/\*+$/, '')}
            placeholder="FRD-CLM"
          />
          <ProblemList problems={fieldProblems('match.code_prefixes')} />
          <ChipPicker label={t('fields.categories')} options={categories} value={form.match.categories} onChange={(v) => setMatch('categories', v)} allowFree emptyText={t('hints.noCategories')} />
          <ProblemList problems={fieldProblems('match.categories')} />
          <ChipPicker label={t('fields.reportTypeCodes')} hint={t('hints.reportTypeCodes')} options={typeCodes} value={form.match.report_type_codes} onChange={(v) => setMatch('report_type_codes', v)} mono emptyText={t('hints.noTypeCodes')} />
          <ProblemList problems={fieldProblems('match.report_type_codes')} />
          <ChipPicker label={t('fields.entityCodes')} hint={t('hints.entityCodes')} options={entityOptions} value={form.match.entity_codes} onChange={(v) => setMatch('entity_codes', v)} emptyText={t('hints.noEntities')} />
          <ProblemList problems={fieldProblems('match.entity_codes')} />
          <ProblemList problems={problemsFor(problems, 'match').filter((p) => p.field === 'match')} />

          <div className="space-y-2 border-t border-line-subtle pt-4">
            <p className="text-sm font-medium text-ink-secondary">{t('fields.answers')}</p>
            <p className="text-xs text-ink-muted">
              {selected.length && selected.length !== types.length ? t('hints.answersFromTypes', { count: selected.length }) : t('hints.answersAllTypes')}
            </p>
            <LogicEditor
              variant="match"
              logic={form.match.answers}
              earlier={questions}
              onChange={(logic) => setMatch('answers', logic)}
              copy={{
                intro: t('answers.intro'),
                empty: t('answers.empty'),
                noQuestions: t('answers.noQuestions'),
                add: t('answers.add'),
                addAnother: t('answers.addAnother'),
              }}
            />
            {usesCurrency && (
              <p className="flex items-start gap-1.5 text-xs text-ink-muted">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('hints.currency')}
              </p>
            )}
            <ProblemList problems={fieldProblems('match.answers')} />
          </div>
        </Section>

        <Section title={t('editor.actions')} intro={t('editor.actionsIntro')}>
          {errors.action && <p className="text-xs text-danger-fg" role="alert">{errors.action}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={ids.owner} className="block text-sm font-medium text-ink-secondary">{t('fields.ownerRole')}</label>
              <select id={ids.owner} className={inputClass} value={form.actions.owner_role} onChange={(e) => setAction('owner_role', e.target.value)}>
                <option value="">{t('values.typeOwner')}</option>
                {roles.map((r) => <option key={r.code} value={r.code}>{r.name || nameFor(r.code)}</option>)}
                {form.actions.owner_role && !roles.some((r) => r.code === form.actions.owner_role) && <option value={form.actions.owner_role}>{form.actions.owner_role}</option>}
              </select>
              <ProblemList problems={fieldProblems('actions.owner_role')} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={ids.backup} className="block text-sm font-medium text-ink-secondary">{t('fields.backupRole')}</label>
              <select id={ids.backup} className={inputClass} value={form.actions.backup_role} onChange={(e) => setAction('backup_role', e.target.value)} aria-describedby={`${ids.backup}-hint`}>
                <option value="">{t('values.none')}</option>
                {roles.map((r) => <option key={r.code} value={r.code}>{r.name || nameFor(r.code)}</option>)}
                {form.actions.backup_role && !roles.some((r) => r.code === form.actions.backup_role) && <option value={form.actions.backup_role}>{form.actions.backup_role}</option>}
              </select>
              <p id={`${ids.backup}-hint`} className="text-xs text-ink-muted">{t('hints.backupRole')}</p>
              <ProblemList problems={fieldProblems('actions.backup_role')} />
            </div>
          </div>
          <ChipPicker
            label={t('fields.flags')}
            hint={t('hints.flags')}
            options={flagOptions}
            value={form.actions.add_flags}
            onChange={(v) => setAction('add_flags', v)}
            allowFree
            mono
            normalize={(v) => v.trim().toUpperCase()}
            validate={(v) => (FLAG_PATTERN.test(v) ? null : t('errors.flag'))}
            placeholder="IA_FRAUD"
          />
          <ProblemList problems={fieldProblems('actions.add_flags')} />
          <div className="space-y-1.5 sm:w-1/2">
            <label htmlFor={ids.tier} className="block text-sm font-medium text-ink-secondary">{t('fields.raiseTier')}</label>
            <select id={ids.tier} className={inputClass} value={form.actions.raise_tier} onChange={(e) => setAction('raise_tier', e.target.value)} aria-describedby={`${ids.tier}-hint`}>
              <option value="">{t('values.noTierChange')}</option>
              {CONFIDENTIALITY_TIERS.map((tier) => <option key={tier.value} value={tier.value}>{tier.label}</option>)}
            </select>
            <p id={`${ids.tier}-hint`} className="text-xs text-ink-muted">{t('hints.raiseTier')}</p>
            <ProblemList problems={fieldProblems('actions.raise_tier')} />
          </div>
          <ProblemList problems={problemsFor(problems, 'actions').filter((p) => p.field === 'actions')} />
        </Section>
      </div>
    </Modal>
  );
};

export default RuleEditor;
