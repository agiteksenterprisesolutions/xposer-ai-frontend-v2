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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ListChecks,
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw,
  Info,
  Paperclip,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import { ConfirmationModal } from '../../components/ui/Modal';
import { questionSetsAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import {
  QUESTION_TYPES,
  createEmptyQuestion,
  hasOptions,
  hydrateQuestions,
  serializeQuestions,
  toKey,
  validateQuestionSet,
} from '../../utils/questionSets';
import { AGENT_ORG_REQUIRED_MESSAGE, agentErrorMessage } from '../../utils/agents';

const QuestionEditor = ({
  question,
  index,
  total,
  errors = {},
  onChange,
  onRemove,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDropTarget,
  disabled,
}) => {
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
    return trimmedOptions.some(
      (other, i) => i < optionIndex && other.toLowerCase() === normalised,
    );
  };
  const liveOptionError = !showOptions
    ? null
    : filledOptions.length < 2
      ? `A '${question.type}' question needs at least two options`
      : new Set(lowered).size !== lowered.length
        ? 'Options must be unique'
        : null;

  const setField = (field, value) => onChange(index, { ...question, [field]: value });

  const setType = (type) => {
    // The server rejects options on anything but a choice type, so they are
    // dropped rather than carried along invisibly.
    onChange(index, {
      ...question,
      type,
      options: hasOptions(type) ? question.options || [] : [],
    });
  };

  const setOption = (optionIndex, value) => {
    const options = [...(question.options || [])];
    options[optionIndex] = value;
    setField('options', options);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(index);
      }}
      className={`rounded-xl border bg-surface p-4 transition-colors ${
        isDragging
          ? 'border-line-accent opacity-50'
          : isDropTarget
            ? 'border-line-accent ring-2 ring-accent-ring'
            : 'border-line'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-ink-subtle">
          {/* Drag reorders; the arrows do the same thing from the keyboard,
              which dragging alone cannot. */}
          <span
            draggable={!disabled}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              onDragStart(index);
            }}
            onDragEnd={onDragEnd}
            title="Drag to reorder"
            aria-hidden="true"
            className={`-ml-1 rounded p-1 ${
              disabled ? 'opacity-50' : 'cursor-grab text-ink-subtle hover:text-ink active:cursor-grabbing'
            }`}
          >
            <GripVertical className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.04em]">
            Question {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="small"
            disabled={disabled || index === 0}
            onClick={() => onMove(index, index - 1)}
            title="Move up"
            aria-label={`Move question ${index + 1} up`}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="small"
            disabled={disabled || index === total - 1}
            onClick={() => onMove(index, index + 1)}
            title="Move down"
            aria-label={`Move question ${index + 1} down`}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="small"
            disabled={disabled}
            onClick={() => onRemove(index)}
            title="Remove question"
            aria-label={`Remove question ${index + 1}`}
          >
            <Trash2 className="h-4 w-4 text-danger-fg" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Input
            label="What to find out"
            value={question.label}
            disabled={disabled}
            error={errors.label || errors.key}
            helperText={
              errors.label || errors.key ? undefined : 'For example: “When did this happen?”'
            }
            onChange={(e) => onChange(index, { ...question, label: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink-secondary">Answer stored as</label>
          <select
            value={question.type}
            disabled={disabled}
            onChange={(e) => setType(e.target.value)}
            className="block h-10 w-full appearance-none rounded-lg border border-line bg-subtle px-3 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-accent focus:ring-2 focus:ring-accent-ring disabled:opacity-50"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-subtle">
            {QUESTION_TYPES.find((t) => t.value === question.type)?.hint}
          </p>
        </div>

        <div className="flex items-end pb-1">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={question.required !== false}
              disabled={disabled}
              onChange={(e) => setField('required', e.target.checked)}
              className="h-4 w-4 accent-[var(--xp-accent)]"
            />
            Required — must be answered or explicitly declined
          </label>
        </div>

        {showOptions && (
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-ink-secondary">Options</label>
            <div className="space-y-2">
              {(question.options || []).map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    value={option}
                    disabled={disabled}
                    onChange={(e) => setOption(optionIndex, e.target.value)}
                    placeholder={`Option ${optionIndex + 1}`}
                    aria-invalid={duplicateOption(option, optionIndex)}
                    className={`h-10 min-w-0 flex-1 rounded-lg border bg-subtle px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-accent-ring disabled:opacity-50 ${
                      duplicateOption(option, optionIndex)
                        ? 'border-danger-line focus:border-danger-line'
                        : 'border-line focus:border-line-accent'
                    }`}
                  />
                  <Button
                    variant="ghost"
                    size="small"
                    disabled={disabled}
                    onClick={() =>
                      setField(
                        'options',
                        question.options.filter((_, i) => i !== optionIndex),
                      )
                    }
                    aria-label={`Remove option ${optionIndex + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="small"
                startIcon={Plus}
                disabled={disabled}
                onClick={() => setField('options', [...(question.options || []), ''])}
              >
                Add option
              </Button>
              {/* Read aloud as natural alternatives — past about six, a call
                  starts to feel like a phone menu. */}
              <p className="text-xs text-ink-subtle">
                Keep them short and distinct — the agent reads them out.
              </p>
              {(errors.options || liveOptionError) && (
                <p className="text-xs text-danger-fg">{errors.options || liveOptionError}</p>
              )}
            </div>
          </div>
        )}

        <div className="md:col-span-2">
          <Input
            label="Guidance for the agent (optional)"
            value={question.help_text}
            disabled={disabled}
            helperText="Never read aloud — it only steers how the agent probes."
            onChange={(e) => setField('help_text', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

const QuestionSets = () => {
  useSEO({
    title: 'Voice Questions',
    description: 'Choose what the AI agent finds out on every reporting call.',
    noIndex: true,
  });

  const { user } = useAuthStore();
  const [questionSet, setQuestionSet] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [intro, setIntro] = useState('');
  const [askForEvidence, setAskForEvidence] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [errors, setErrors] = useState({});
  const [serviceError, setServiceError] = useState(null);
  const listEndRef = useRef(null);

  // Every one of these endpoints is org-scoped; a super admin has no
  // organization and gets a 400 that reads like a bug unless it is explained.
  const missingOrganization = !user?.organization_id;

  const applySet = useCallback((data) => {
    setQuestionSet(data);
    setQuestions(hydrateQuestions(data?.questions));
    setIntro(data?.intro || '');
    setAskForEvidence(data?.ask_for_evidence !== false);
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
      setServiceError(agentErrorMessage(error, 'The question set could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [applySet, missingOrganization]);

  useEffect(() => {
    fetchQuestionSet();
  }, [fetchQuestionSet]);

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

  const removeQuestion = (index) =>
    setQuestions((prev) => prev.filter((_, i) => i !== index));

  // Reordering by drag. The list is short and the rows are plain divs, so the
  // native HTML5 events are enough — no library, and the arrow buttons keep
  // the same reordering reachable from the keyboard.
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDrop = (index) => {
    if (dragIndex !== null && dragIndex !== index) moveQuestion(dragIndex, index);
    handleDragEnd();
  };

  const moveQuestion = (from, to) =>
    setQuestions((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const addQuestion = () => {
    setQuestions((prev) => [...prev, createEmptyQuestion()]);
    // The new card is appended below the fold on a long list.
    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const saveSet = async () => {
    setSaving(true);
    try {
      // Whole-list replace: the complete array, in display order, every save.
      const data = await questionSetsAPI.updateQuestionSet({
        questions: serializeQuestions(questions),
        intro: intro.trim() ? intro.trim() : null,
        askForEvidence,
      });
      applySet(data);
      toast.success('Saved — the next call uses these questions.');
    } catch (error) {
      console.error('Error saving question set:', error);
      // The interceptor toasts 4xx detail; 422 lands here with the specific
      // rule that failed, which is worth keeping on screen.
      setServiceError(agentErrorMessage(error, 'The question set could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const validation = validateQuestionSet(questions);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast.error('Fix the highlighted questions before saving.');
      return;
    }

    await saveSet();
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      applySet(await questionSetsAPI.resetQuestionSet());
      setConfirmReset(false);
      toast.success('Reset to the default questions.');
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

  // "saved 2 hours ago" is what tells an admin their save actually landed; a
  // full timestamp reads as decoration and is harder to check at a glance.
  const updatedLabel = useMemo(() => {
    if (!questionSet?.updated_at) return null;
    const date = new Date(questionSet.updated_at);
    if (Number.isNaN(date.getTime())) return null;

    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const units = [
      ['second', 60],
      ['minute', 60],
      ['hour', 24],
      ['day', 7],
      ['week', 4.35],
      ['month', 12],
    ];
    const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    let value = seconds;
    for (const [unit, step] of units) {
      if (Math.abs(value) < step) return relative.format(Math.round(value), unit);
      value /= step;
    }
    return relative.format(Math.round(value), 'year');
  }, [questionSet?.updated_at]);

  if (missingOrganization) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Voice Questions</h1>
          <p className="text-sm text-ink-muted">What the AI agent finds out on every call.</p>
        </div>
        <Alert variant="warning" title="No organization on this account">
          {AGENT_ORG_REQUIRED_MESSAGE}
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-line-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink">Voice Questions</h1>
          <p className="text-sm text-ink-muted">
            What the assistant finds out on every call, in the order it works through them.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {questionSet?.version > 0 && (
            <Badge variant="secondary" size="small">
              Version {questionSet.version}
              {updatedLabel ? ` · saved ${updatedLabel}` : ''}
            </Badge>
          )}
          <Button
            variant="outline"
            startIcon={RotateCcw}
            onClick={() => setConfirmReset(true)}
            disabled={saving || isDefaultSet}
            title={
              isDefaultSet
                ? 'Already using the default questions'
                : 'Discard your customisation and return to the defaults'
            }
          >
            Reset to defaults
          </Button>
          <Button startIcon={Save} onClick={handleSave} isLoading={saving}>
            Save questions
          </Button>
        </div>
      </div>

      {serviceError && (
        <Alert variant="error" title="Could not save">
          {serviceError}
        </Alert>
      )}

      {isDefaultSet && (
        <Alert variant="info" title="Using the default questions">
          Edit them and save to make them yours. Nothing here is live for your organization
          until you do.
        </Alert>
      )}

      {/* The single most common way to get a worse agent is to write these as
          form prompts. */}
      <Alert variant="info" title="Write them as things to find out, not form prompts">
        <span className="block">
          The agent rephrases each one conversationally, in the caller's own language.
          <span className="mt-1 block text-success-fg">Good: “When did this happen?”</span>
          <span className="text-danger-fg">
            Bad: “Please enter the incident date in DD/MM/YYYY”
          </span>
        </span>
      </Alert>

      <Card title="How the call opens" icon={Info}>
        <div className="space-y-5">
          <Input
            label="Opening remark (optional)"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            helperText="Anything the agent should know before it starts asking."
            disabled={saving}
          />

          {/* A call-behaviour setting rather than a question — kept out of the
              list so it cannot be reordered into it. */}
          <div className="flex flex-col gap-3 rounded-xl border border-line-subtle bg-subtle p-4 sm:flex-row sm:items-start">
            <Paperclip className="mt-0.5 hidden h-4 w-4 shrink-0 text-accent-fg sm:block" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Ask callers for supporting files</p>
              <p className="mt-1 text-sm text-ink-muted">
                The agent invites the caller to attach documents, photos or recordings before
                the report is submitted.
              </p>
              <p className="mt-1 text-xs text-ink-subtle">
                Turning this off only stops the agent from raising it. Callers can still upload
                files from the interface, and the agent will acknowledge anything they send.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={askForEvidence}
              aria-label="Ask callers for supporting files"
              disabled={saving}
              onClick={() => setAskForEvidence((value) => !value)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring disabled:opacity-50 ${
                askForEvidence ? 'bg-[var(--xp-accent)]' : 'bg-line-strong'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform ${
                  askForEvidence ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </Card>

      {errorCount > 0 && (
        <Alert variant="error" title={`${errorCount} question${errorCount === 1 ? '' : 's'} need attention`}>
          Nothing is saved until every question below is valid — saving replaces the whole
          list at once.
        </Alert>
      )}

      <div className="space-y-4" data-tour="question-list">
        {questions.length === 0 ? (
          <Card>
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-line-subtle bg-subtle">
                <ListChecks className="h-6 w-6 text-ink-subtle" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-ink">No questions</h3>
              <p className="mx-auto max-w-md text-sm text-ink-muted">
                This is allowed — the agent simply has a free-form conversation and writes up
                whatever the caller tells it. Add a question to steer it.
              </p>
            </div>
          </Card>
        ) : (
          questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              index={index}
              total={questions.length}
              errors={errors[index] || {}}
              onChange={updateQuestion}
              onRemove={removeQuestion}
              onMove={moveQuestion}
              onDragStart={setDragIndex}
              onDragOver={setOverIndex}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              isDragging={dragIndex === index}
              isDropTarget={overIndex === index && dragIndex !== null && dragIndex !== index}
              disabled={saving}
            />
          ))
        )}
        <div ref={listEndRef} />
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <Button variant="secondary" startIcon={Plus} onClick={addQuestion} disabled={saving}>
          Add question
        </Button>
        <p className="text-xs text-ink-subtle">Changes apply to the very next call.</p>
      </div>

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset to the default questions?"
        message="Your customised questions will be discarded and the defaults restored. Reports already submitted keep the answers they were collected with."
        confirmText="Reset to defaults"
        destructive
        isLoading={resetting}
      />
    </div>
  );
};

export default QuestionSets;
