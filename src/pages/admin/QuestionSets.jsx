// src/pages/admin/QuestionSets.jsx
//
// What the voice agent finds out on every call, in the order it works through
// them. Saving replaces the whole list — there is no per-question endpoint —
// and the change applies to the very next call with no deploy.
//
// The admin edits labels, types and options freely, with no warnings and no
// confirmations. That is safe because a submitted report stores its own copy
// of the questions it was asked — keys and labels together — so nothing done
// to this list can reach back into a report already filed. Keys are derived
// from labels and never shown; they are an implementation detail.
//
// Layout: the call as a timeline on the left (opening remark, the questions,
// supporting files, the end), and the selected step's editor on the right.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Calendar,
  CircleDot,
  Flag,
  GripVertical,
  Hash,
  ListChecks,
  Paperclip,
  Phone,
  Plus,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../utils/locale';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Alert from '../../components/ui/Alert';
import { ConfirmationModal } from '../../components/ui/Modal';
import { questionSetsAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import {
  QUESTION_TYPES,
  createEmptyQuestion,
  getTypeLabel,
  hasOptions,
  hydrateQuestions,
  serializeQuestions,
  toKey,
  validateQuestionSet,
} from '../../utils/questionSets';
import { AGENT_ORG_REQUIRED_MESSAGE, agentErrorMessage } from '../../utils/agents';

const OPENING = 'opening';

const TYPE_ICONS = {
  text: AlignLeft,
  date: Calendar,
  choice: CircleDot,
  multi_choice: ListChecks,
  boolean: ToggleRight,
  number: Hash,
};

// Shorter than the stored-as hints in utils, to fit a tile: voice.tileHints.<type>.

const fieldClass = (error) =>
  `w-full rounded-lg border bg-subtle px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:ring-2 focus:ring-accent-ring disabled:opacity-50 ${
    error ? 'border-danger-line focus:border-danger-line' : 'border-line hover:border-line-strong focus:border-line-accent'
  }`;

const Switch = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`relative inline-flex h-6 w-10.5 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50 ${
      checked ? 'bg-accent' : 'bg-active'
    }`}
  >
    <span
      className={`inline-block h-4.5 w-4.5 rounded-full bg-surface shadow-sm transition-transform ${
        checked ? 'translate-x-5.25 rtl:-translate-x-5.25' : 'translate-x-0.75 rtl:-translate-x-0.75'
      }`}
    />
  </button>
);

/** One stop on the call timeline: a marker, the line down to the next, and its content. */
const PageTitle = () => {
  const { t } = useTranslation('reportTypes');
  return (
    <div>
      <h1 className="text-xl font-bold text-ink">{t('voice.title')}</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t('voice.intro')}</p>
    </div>
  );
};

/** The page while the question set loads: the call timeline and the editor. */
const QuestionSetsSkeleton = () => {
  const { t } = useTranslation('reportTypes');
  return (
  <div className="space-y-5 pb-24" aria-busy="true">
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <PageTitle />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton.Text size="xs" className="w-36" />
        <Skeleton.Button className="w-36" />
      </div>
    </div>

    <div className="grid items-start gap-5 lg:grid-cols-[26rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
          <h2 className="text-sm font-semibold text-ink">{t('voice.timelineTitle')}</h2>
          <Skeleton.Text size="xs" className="w-32" />
        </header>
        <div className="p-3.5">
          <Stop marker={<Skeleton.Circle size="h-8 w-8" />}>
            <div className="mb-3 rounded-xl px-3 py-2.5">
              <Skeleton.Text size="2xs" className="w-24" />
              <Skeleton.Text className="mt-0.5 w-48" />
              <Skeleton.Text size="xs" className="mt-0.5 w-52" />
            </div>
          </Stop>
          {[0, 1, 2].map((i) => (
            <Stop key={i} marker={<Skeleton.Circle size="h-8 w-8" />}>
              <div className="mb-3 rounded-xl border border-line px-3 py-2.5">
                <Skeleton.Text className="w-44" />
                <div className="mt-1.5 flex gap-1.5">
                  <Skeleton.Badge className="w-12" />
                  <Skeleton.Badge className="w-16" />
                </div>
              </div>
            </Stop>
          ))}
          <Stop marker={<Skeleton.Circle size="h-8 w-8" />}>
            <Skeleton className="mb-3 h-10 w-full rounded-xl" />
          </Stop>
          <Stop marker={<Skeleton.Circle size="h-8 w-8" />}>
            <div className="mb-3 flex items-start gap-3 px-1 py-1">
              <div className="flex-1">
                <Skeleton.Text className="w-40" />
                <Skeleton.Lines size="xs" lines={2} />
              </div>
              <Skeleton className="h-6 w-10.5 rounded-full" />
            </div>
          </Stop>
          <Stop last marker={<Skeleton.Circle size="h-8 w-8" />}>
            <Skeleton.Text size="xs" className="mt-2 w-56" />
          </Stop>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <Skeleton.Text size="2xs" className="w-24" />
            <Skeleton.Text size="base" className="w-40" />
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Skeleton.Button small className="w-10" />
            <Skeleton.Button small className="w-10" />
            <Skeleton.Button small className="w-24" />
          </div>
        </header>
        <div className="space-y-6 p-5 sm:p-6">
          <div className="space-y-2">
            <Skeleton.Text className="w-28" />
            <Skeleton className="h-10.5 w-full rounded-lg" />
            <Skeleton.Text size="xs" className="w-4/5" />
          </div>
          <div className="space-y-2.5">
            <Skeleton.Text className="w-28" />
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5">
                  <Skeleton.Icon size="h-8 w-8" />
                  <div className="flex-1">
                    <Skeleton.Text size="xs" className="w-16" />
                    <Skeleton.Text size="2xs" className="w-24" />
                  </div>
                </div>
              ))}
            </div>
            <Skeleton.Text size="xs" className="w-3/4" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="space-y-2">
            <Skeleton.Text className="w-36" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      </section>
    </div>
  </div>
  );
};

const Stop = ({ marker, last = false, children }) => (
  <div className="flex gap-3">
    <div className="flex w-8 shrink-0 flex-col items-center">
      {marker}
      {!last && <span className="min-h-3 w-0.5 flex-1 bg-line" aria-hidden="true" />}
    </div>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

const Marker = ({ children, tone = 'neutral' }) => {
  const tones = {
    neutral: 'bg-active text-ink-muted',
    accent: 'bg-accent-soft text-accent-fg',
    selected: 'bg-accent text-on-accent',
    outline: 'border-[1.5px] border-line-strong bg-surface text-ink-secondary',
    danger: 'bg-danger-solid text-white',
    dashed: 'border-[1.5px] border-dashed border-ink-subtle text-ink-muted',
  };
  return (
    <span
      className={`box-border flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

// ─── The selected question ────────────────────────────────────────────────

const QuestionEditor = ({ question, index, total, errors = {}, disabled, onChange, onMove, onRemove }) => {
  const { t } = useTranslation('reportTypes');
  const showOptions = hasOptions(question.type);

  // Checked as they type rather than only on save, so a duplicate option is
  // visible next to the field that caused it. The server compares
  // case-insensitively, so "High" and "high" collide here too.
  const trimmedOptions = (question.options || []).map((option) => option.trim());
  const filledOptions = trimmedOptions.filter(Boolean);
  const lowered = filledOptions.map((option) => option.toLowerCase());
  const duplicateOption = (value, optionIndex) => {
    const normalised = value.trim().toLowerCase();
    if (!normalised) return false;
    return trimmedOptions.some((other, i) => i < optionIndex && other.toLowerCase() === normalised);
  };
  const liveOptionError = !showOptions
    ? null
    : filledOptions.length < 2
      ? t('voice.editor.atLeastTwo')
      : new Set(lowered).size !== lowered.length
        ? t('voice.editor.mustDiffer')
        : null;

  const setField = (field, value) => onChange({ ...question, [field]: value });

  const setType = (type) =>
    // The server rejects options on anything but a choice type, so they are
    // dropped rather than carried along invisibly.
    onChange({ ...question, type, options: hasOptions(type) ? question.options || [] : [] });

  const setOption = (optionIndex, value) => {
    const options = [...(question.options || [])];
    options[optionIndex] = value;
    setField('options', options);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
            {t('voice.editor.position', { number: index + 1, total })}
          </p>
          <h2 className="truncate text-base font-bold text-ink">{question.label.trim() || t('voice.newQuestion')}</h2>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            variant="outline"
            size="small"
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
            aria-label={t('voice.editor.earlier')}
            title={t('voice.editor.earlier')}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="small"
            disabled={disabled || index === total - 1}
            onClick={() => onMove(1)}
            aria-label={t('voice.editor.later')}
            title={t('voice.editor.later')}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="small" disabled={disabled} onClick={onRemove} className="text-danger-fg">
            <Trash2 className="h-4 w-4" />
            {t('voice.editor.remove')}
          </Button>
        </div>
      </header>

      <div className="space-y-6 p-5 sm:p-6">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-ink-secondary">{t('voice.editor.whatLabel')}</span>
          <input
            value={question.label}
            disabled={disabled}
            autoFocus={!question.label}
            placeholder={t('voice.editor.whatPlaceholder')}
            onChange={(event) => setField('label', event.target.value)}
            aria-invalid={errors.label || errors.key ? 'true' : undefined}
            className={`${fieldClass(errors.label || errors.key)} text-[15px]`}
          />
          <span className={`block text-xs ${errors.label || errors.key ? 'text-danger-fg' : 'text-ink-subtle'}`}>
            {errors.label ||
              errors.key ||
              t('voice.editor.whatHint')}
          </span>
        </label>

        <div className="space-y-2.5">
          <p id="voice-kind-label" className="text-sm font-semibold text-ink-secondary">{t('voice.editor.kind')}</p>
          <div role="radiogroup" aria-labelledby="voice-kind-label" className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {QUESTION_TYPES.map((type) => {
              const Icon = TYPE_ICONS[type.value] || AlignLeft;
              const on = question.type === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => setType(type.value)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors disabled:opacity-50 ${
                    on ? 'border-[1.5px] border-accent bg-accent-soft' : 'border border-line hover:border-line-strong'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      on ? 'bg-accent text-on-accent' : 'bg-active text-ink-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-ink">{type.label}</span>
                    <span className="block truncate text-[11px] text-ink-subtle">{t(`voice.tileHints.${type.value}`)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-subtle">{t('voice.editor.kindHint')}</p>
        </div>

        {showOptions && (
          <div className="space-y-2.5">
            <p className="text-sm font-semibold text-ink-secondary">{t('voice.editor.options')}</p>
            <div className="space-y-2">
              {(question.options || []).map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    value={option}
                    disabled={disabled}
                    onChange={(event) => setOption(optionIndex, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        setField('options', [...(question.options || []), '']);
                      }
                    }}
                    placeholder={t('voice.editor.option', { number: optionIndex + 1 })}
                    aria-label={t('voice.editor.option', { number: optionIndex + 1 })}
                    aria-invalid={duplicateOption(option, optionIndex) ? 'true' : undefined}
                    className={fieldClass(duplicateOption(option, optionIndex))}
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setField('options', question.options.filter((_, i) => i !== optionIndex))}
                    aria-label={t('voice.editor.removeOption', { number: optionIndex + 1 })}
                    className="rounded-md p-2 text-ink-muted transition-colors hover:bg-hover hover:text-danger-fg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                variant="outline"
                size="small"
                startIcon={Plus}
                disabled={disabled}
                onClick={() => setField('options', [...(question.options || []), ''])}
              >
                {t('voice.editor.addOption')}
              </Button>
            </div>
            {/* Read aloud as natural alternatives — past about six, a call
                starts to feel like a phone menu. */}
            <p className={`text-xs ${errors.options || liveOptionError ? 'text-danger-fg' : 'text-ink-subtle'}`}>
              {errors.options || liveOptionError || t('voice.editor.optionsHint')}
            </p>
          </div>
        )}

        <div className="flex items-center gap-4 rounded-xl bg-subtle px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{t('voice.required')}</p>
            <p className="text-xs text-ink-muted">
              {question.required !== false ? t('voice.editor.requiredOn') : t('voice.editor.requiredOff')}
            </p>
          </div>
          <Switch
            checked={question.required !== false}
            disabled={disabled}
            onChange={() => setField('required', question.required === false)}
            label={t('voice.required')}
          />
        </div>

        <label className="block space-y-2">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-ink-secondary">{t('voice.editor.guidance')}</span>
            <span className="text-xs text-ink-subtle">{t('voice.editor.guidanceNote')}</span>
          </span>
          <textarea
            rows={3}
            value={question.help_text}
            disabled={disabled}
            onChange={(event) => setField('help_text', event.target.value)}
            placeholder={t('voice.editor.guidancePlaceholder')}
            className={`${fieldClass(false)} resize-y`}
          />
        </label>
      </div>
    </section>
  );
};

// ─── The page ─────────────────────────────────────────────────────────────

const QuestionSets = () => {
  const { t, i18n } = useTranslation('reportTypes');
  useSEO({
    title: t('voice.title'),
    description: t('voice.seoDescription'),
    noIndex: true,
  });

  const { user } = useAuthStore();
  const [questionSet, setQuestionSet] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [intro, setIntro] = useState('');
  const [askForEvidence, setAskForEvidence] = useState(true);
  const [baseline, setBaseline] = useState(null);
  const [selected, setSelected] = useState(OPENING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [errors, setErrors] = useState({});
  const [serviceError, setServiceError] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  // Every one of these endpoints is org-scoped; a super admin has no
  // organization and gets a 400 that reads like a bug unless it is explained.
  const missingOrganization = !user?.organization_id;

  const snapshot = (list, opening, evidence) =>
    JSON.stringify({ q: serializeQuestions(list), i: opening.trim(), e: evidence });

  const applySet = useCallback((data) => {
    const hydrated = hydrateQuestions(data?.questions);
    setQuestionSet(data);
    setQuestions(hydrated);
    setIntro(data?.intro || '');
    setAskForEvidence(data?.ask_for_evidence !== false);
    setBaseline(snapshot(hydrated, data?.intro || '', data?.ask_for_evidence !== false));
    setSelected((current) => (current === OPENING ? (hydrated[0]?.id ?? OPENING) : current));
    setErrors({});
  }, []);

  const fetchQuestionSet = useCallback(async () => {
    if (missingOrganization) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      applySet(await questionSetsAPI.getQuestionSet());
      setServiceError(null);
    } catch (error) {
      console.error('Error fetching question set:', error);
      setServiceError(agentErrorMessage(error, t('voice.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [applySet, missingOrganization]);

  useEffect(() => {
    fetchQuestionSet();
  }, [fetchQuestionSet]);

  const dirty = baseline !== null && snapshot(questions, intro, askForEvidence) !== baseline;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const updateQuestion = (index, next) =>
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== index) return question;
        // The key follows the label. Renaming a question is safe: every report
        // already filed carries its own copy of what it was asked.
        if (next.label === question.label) return next;
        const taken = new Set(prev.filter((_, j) => j !== index).map((q) => q.key));
        return { ...next, key: toKey(next.label, taken) };
      }),
    );

  const moveQuestion = (from, to) =>
    setQuestions((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const removeQuestion = (index) => {
    const remaining = questions.filter((_, i) => i !== index);
    setQuestions(remaining);
    setSelected(remaining[Math.min(index, remaining.length - 1)]?.id ?? OPENING);
    setErrors({});
  };

  const addQuestion = () => {
    const created = createEmptyQuestion();
    setQuestions((prev) => [...prev, created]);
    setSelected(created.id);
  };

  // Reordering by drag on the timeline. Native HTML5 events are enough for a
  // short list, and the arrow buttons keep reordering reachable by keyboard.
  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  // After a save the rows get new client ids; select the same position again.
  const [pendingSelectIndex, setPendingSelectIndex] = useState(null);
  useEffect(() => {
    if (pendingSelectIndex === null) return;
    setSelected(questions[pendingSelectIndex]?.id ?? questions[0]?.id ?? OPENING);
    setPendingSelectIndex(null);
  }, [pendingSelectIndex, questions]);

  const saveSet = async () => {
    const validation = validateQuestionSet(questions);
    setErrors(validation);
    const firstBad = Object.keys(validation)[0];
    if (firstBad !== undefined) {
      setSelected(questions[Number(firstBad)].id);
      toast.error(t('voice.fixFirst'));
      return;
    }
    setSaving(true);
    try {
      // Whole-list replace: the complete array, in display order, every save.
      const data = await questionSetsAPI.updateQuestionSet({
        questions: serializeQuestions(questions),
        intro: intro.trim() ? intro.trim() : null,
        askForEvidence,
      });
      const keepIndex = questions.findIndex((q) => q.id === selected);
      applySet(data);
      // Rows are re-created from the response, so reselect by position.
      if (keepIndex >= 0) setPendingSelectIndex(keepIndex);
      setServiceError(null);
      toast.success(t('voice.saved'));
    } catch (error) {
      console.error('Error saving question set:', error);
      // The interceptor toasts 4xx detail; 422 lands here with the specific
      // rule that failed, which is worth keeping on screen.
      setServiceError(agentErrorMessage(error, t('voice.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (questionSet) applySet(questionSet);
    setServiceError(null);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      applySet(await questionSetsAPI.resetQuestionSet());
      setConfirmReset(false);
      toast.success(t('voice.resetDone'));
    } catch (error) {
      console.error('Error resetting question set:', error);
    } finally {
      setResetting(false);
    }
  };

  // Version 0 means the org has never configured a set — the defaults come
  // back populated, so they are an editable starting point, not a blank page.
  const isDefaultSet = questionSet?.version === 0;
  const errorCount = Object.keys(errors).length;
  const requiredCount = questions.filter((q) => q.required !== false).length;
  const selectedIndex = questions.findIndex((q) => q.id === selected);
  const selectedQuestion = selectedIndex >= 0 ? questions[selectedIndex] : null;

  const savedLabel = useMemo(() => {
    if (!questionSet?.updated_at) return null;
    const date = new Date(questionSet.updated_at);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  }, [questionSet?.updated_at, i18n.resolvedLanguage]);

  if (missingOrganization) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-ink">{t('voice.title')}</h1>
          <p className="text-sm text-ink-muted">{t('voice.shortIntro')}</p>
        </div>
        <Alert variant="warning" title={t('voice.noOrg')}>
          {AGENT_ORG_REQUIRED_MESSAGE}
        </Alert>
      </div>
    );
  }

  if (loading) return <QuestionSetsSkeleton />;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <PageTitle />
        <div className="flex flex-wrap items-center gap-3">
          {questionSet?.version > 0 && (
            <span className="text-xs text-ink-subtle">
              {savedLabel
                ? t('voice.versionSaved', { version: questionSet.version, date: savedLabel })
                : t('voice.version', { version: questionSet.version })}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => setConfirmReset(true)}
            disabled={saving || isDefaultSet}
            title={isDefaultSet ? t('voice.resetTitleDefault') : t('voice.resetTitle')}
          >
            {t('voice.reset')}
          </Button>
        </div>
      </div>

      {serviceError && (
        <Alert variant="error" title={t('voice.errorTitle')}>
          {serviceError}
        </Alert>
      )}

      {isDefaultSet && (
        <Alert variant="info" title={t('voice.defaultsTitle')}>
          {t('voice.defaultsBody')}
        </Alert>
      )}

      {errorCount > 0 && (
        <Alert variant="error" title={t('voice.needAttention', { count: errorCount })}>
          {t('voice.needAttentionBody')}
        </Alert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[26rem_minmax(0,1fr)]">
        {/* The call, in order */}
        <section className="overflow-hidden rounded-2xl border border-line bg-surface lg:sticky lg:top-20">
          <header className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
            <h2 className="text-sm font-semibold text-ink">{t('voice.timelineTitle')}</h2>
            <span className="text-xs text-ink-subtle">
              {t('voice.questionCount', { count: questions.length })} · {t('voice.requiredCount', { count: requiredCount })}
            </span>
          </header>

          <div className="p-3.5">
            {/* Opening remark */}
            <Stop
              marker={
                <Marker tone={selected === OPENING ? 'selected' : 'accent'}>
                  <Phone className="h-4 w-4" />
                </Marker>
              }
            >
              <button
                type="button"
                onClick={() => setSelected(OPENING)}
                aria-pressed={selected === OPENING}
                className={`mb-3 w-full rounded-xl px-3 py-2.5 text-start transition-colors ${
                  selected === OPENING ? 'bg-accent-soft ring-1 ring-line-accent' : 'hover:bg-hover'
                }`}
              >
                <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
                  {t('voice.opening.title')}
                </span>
                <span className={`mt-0.5 block text-sm ${intro.trim() ? 'text-ink' : 'text-ink-subtle'}`} dir="auto">
                  {intro.trim() ? t('voice.opening.quoted', { text: intro.trim() }) : t('voice.opening.default')}
                </span>
                <span className="mt-0.5 block text-xs text-ink-subtle">{t('voice.opening.afterGreeting')}</span>
              </button>
            </Stop>

            {/* Questions */}
            {questions.map((question, index) => {
              const on = selected === question.id;
              const hasError = Boolean(errors[index]);
              const Icon = TYPE_ICONS[question.type] || AlignLeft;
              const dropping = overIndex === index && dragIndex !== null && dragIndex !== index;
              return (
                <Stop
                  key={question.id}
                  marker={<Marker tone={hasError ? 'danger' : on ? 'selected' : 'outline'}>{index + 1}</Marker>}
                >
                  <div
                    onDragOver={(event) => {
                      event.preventDefault();
                      setOverIndex(index);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (dragIndex !== null && dragIndex !== index) moveQuestion(dragIndex, index);
                      endDrag();
                    }}
                    className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                      hasError
                        ? 'border-danger-line bg-danger-soft'
                        : on
                          ? 'border-accent bg-accent-soft ring-2 ring-accent-ring'
                          : dropping
                            ? 'border-line-accent'
                            : 'border-line hover:border-line-strong'
                    } ${dragIndex === index ? 'opacity-50' : ''}`}
                  >
                    <span
                      draggable={!saving}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        setDragIndex(index);
                      }}
                      onDragEnd={endDrag}
                      title={t('voice.dragToReorder')}
                      aria-hidden="true"
                      className="mt-0.5 cursor-grab text-ink-subtle hover:text-ink active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelected(question.id)}
                      aria-pressed={on}
                      className="min-w-0 flex-1 text-start"
                    >
                      <span className={`block text-sm font-semibold ${question.label.trim() ? 'text-ink' : 'text-ink-subtle'}`}>
                        {question.label.trim() || t('voice.newQuestion')}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md bg-active px-1.5 py-0.5 text-[11px] font-semibold text-ink-secondary">
                          <Icon className="h-3 w-3" />
                          {getTypeLabel(question.type)}
                        </span>
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                            question.required !== false ? 'bg-warning-soft text-warning-fg' : 'bg-subtle text-ink-subtle'
                          }`}
                        >
                          {question.required !== false ? t('voice.required') : t('voice.optional')}
                        </span>
                        {question.help_text?.trim() && (
                          <span className="rounded-md bg-info-soft px-1.5 py-0.5 text-[11px] font-semibold text-info-fg">
                            {t('voice.hasGuidance')}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                </Stop>
              );
            })}

            {/* Add */}
            <Stop
              marker={
                <Marker tone="dashed">
                  <Plus className="h-3.5 w-3.5" />
                </Marker>
              }
            >
              <button
                type="button"
                onClick={addQuestion}
                disabled={saving}
                className="mb-3 flex h-10 w-full items-center rounded-xl border-[1.5px] border-dashed border-line-strong px-3.5 text-[13px] font-semibold text-accent-fg transition-colors hover:border-line-accent hover:bg-accent-soft disabled:opacity-50"
              >
                {t('voice.addQuestion')}
              </button>
            </Stop>

            {/* Supporting files — a call setting, not a question, so it can't be
                reordered into the list. */}
            <Stop
              marker={
                <Marker>
                  <Paperclip className="h-3.5 w-3.5" />
                </Marker>
              }
            >
              <div className="mb-3 flex items-center gap-3 px-1 py-1">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{t('voice.evidence.title')}</p>
                  <p className="text-xs text-ink-subtle">
                    {askForEvidence ? t('voice.evidence.on') : t('voice.evidence.off')}
                  </p>
                </div>
                <Switch
                  checked={askForEvidence}
                  disabled={saving}
                  onChange={() => setAskForEvidence((value) => !value)}
                  label={t('voice.evidence.title')}
                />
              </div>
            </Stop>

            <Stop
              last
              marker={
                <Marker>
                  <Flag className="h-3.5 w-3.5" />
                </Marker>
              }
            >
              <p className="px-1 pt-1.5 text-xs text-ink-subtle">{t('voice.end')}</p>
            </Stop>
          </div>
        </section>

        {/* Editor */}
        {selected === OPENING || !selectedQuestion ? (
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{t('voice.opening.eyebrow')}</p>
            <h2 className="text-base font-bold text-ink">{t('voice.opening.title')}</h2>
            <label className="mt-5 block space-y-2">
              <span className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-ink-secondary">{t('voice.opening.label')}</span>
                <span className="text-xs text-ink-subtle">{t('voice.optional')}</span>
              </span>
              <input
                value={intro}
                disabled={saving}
                onChange={(event) => setIntro(event.target.value)}
                placeholder={t('voice.opening.placeholder')}
                className={fieldClass(false)}
                dir="auto"
              />
              <span className="block text-xs text-ink-subtle">{t('voice.opening.hint')}</span>
            </label>
            {questions.length === 0 && (
              <div className="mt-6 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center">
                <ListChecks className="mx-auto h-6 w-6 text-ink-subtle" />
                <p className="mt-2 text-sm font-semibold text-ink">{t('voice.empty.title')}</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{t('voice.empty.body')}</p>
                <Button className="mt-3" variant="outline" size="small" startIcon={Plus} onClick={addQuestion}>
                  {t('voice.addQuestion')}
                </Button>
              </div>
            )}
          </section>
        ) : (
          <QuestionEditor
            key={selectedQuestion.id}
            question={selectedQuestion}
            index={selectedIndex}
            total={questions.length}
            errors={errors[selectedIndex] || {}}
            disabled={saving}
            onChange={(next) => updateQuestion(selectedIndex, next)}
            onMove={(delta) => moveQuestion(selectedIndex, selectedIndex + delta)}
            onRemove={() => removeQuestion(selectedIndex)}
          />
        )}
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl bg-ink px-4 py-3 text-canvas shadow-xl sm:flex-row sm:items-center sm:ps-5">
          <p className="min-w-0 flex-1 text-sm">{t('voice.unsaved')}</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={saving}
              className="h-9 rounded-lg border border-canvas/25 px-3.5 text-sm font-medium transition-colors hover:bg-canvas/10 disabled:opacity-50"
            >
              {t('voice.discard')}
            </button>
            <button
              type="button"
              onClick={saveSet}
              disabled={saving}
              className="h-9 rounded-lg bg-canvas px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t('common:status.saving') : t('voice.save')}
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title={t('voice.resetConfirmTitle')}
        message={t('voice.resetConfirmBody')}
        confirmText={t('voice.reset')}
        destructive
        isLoading={resetting}
      />
    </div>
  );
};

export default QuestionSets;
