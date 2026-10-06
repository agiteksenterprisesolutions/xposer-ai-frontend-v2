// src/components/reportTypeBuilder/ReportTypeEditor.jsx
//
// Creating or editing a report type, in three steps: Questions, Handling and
// Review. Each step fits one screen, so the work never reads as one long form.
// Nothing reaches the server until the user saves; leaving with unsaved
// changes asks first.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, Send } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import Modal, { ConfirmationModal } from '../layout/Modal';
import { useUIStore } from '../../store/uiStore';
import useReportTypeDraft from './useReportTypeDraft';
import QuestionsStep from './QuestionsStep';
import HandlingStep from './HandlingStep';
import ReviewStep from './ReviewStep';
import ReporterPreview from './ReporterPreview';
import { findIssues } from './model';

const STEPS = [
  { id: 'questions', label: 'Questions' },
  { id: 'handling', label: 'Handling' },
  { id: 'review', label: 'Review' },
];

const STATUS_PILL = {
  new: ['New', 'bg-active text-ink-secondary'],
  draft: ['Draft', 'bg-active text-ink-secondary'],
  active: ['Published', 'bg-success-soft text-success-fg'],
  retired: ['Retired', 'bg-warning-soft text-warning-fg'],
};

/** Use a fresh `key` per report type: the draft is seeded once. */
const ReportTypeEditor = ({ initialData, isNew, codeLocked = false, saving = false, onSave, onExit, initialStep, onStepChange }) => {
  const draft = useReportTypeDraft(initialData);
  const { form, dirty, select } = draft;
  const [step, setStep] = useState(initialStep || 'questions');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [triedSave, setTriedSave] = useState(false);

  const issues = useMemo(() => findIssues(form, { isNew }), [form, isNew]);
  const errors = issues.filter((issue) => issue.level === 'error');
  // Until a save is tried, only flag what's actually been touched, not the
  // empty step a brand-new type starts with.
  const visibleIssues = triedSave ? issues : issues.filter((i) => !i.blank);
  const questionErrors = errors.filter((i) => i.target?.sectionId || i.check === 'steps').length;

  // The builder takes the whole content area rather than a padded column.
  useEffect(() => {
    useUIStore.setState({ fullBleed: true });
    return () => useUIStore.setState({ fullBleed: false });
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const goTo = (next) => {
    setStep(next);
    onStepChange?.(next);
    document.getElementById('rtb-scroll')?.scrollTo({ top: 0 });
  };

  /** Jump to where an issue can be fixed. */
  const fix = (target) => {
    if (target?.questionId || target?.sectionId) {
      select({ sectionId: target.sectionId, questionId: target.questionId ?? null });
      goTo('questions');
    } else if (target?.step === 'questions') goTo('questions');
    else goTo('handling');
  };

  const save = async (status) => {
    setTriedSave(true);
    if (errors.length) {
      goTo('review');
      toast.error(`Fix ${errors.length === 1 ? 'one thing' : `${errors.length} things`} before saving.`);
      return;
    }
    const ok = await onSave({ ...form, ...(status ? { status, is_active: status === 'active' } : {}) });
    if (ok) draft.setDirty(false);
  };

  const exit = () => (dirty ? setConfirmLeave(true) : onExit());

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const [pillLabel, pillClass] = STATUS_PILL[isNew ? 'new' : form.status || 'active'] || STATUS_PILL.active;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-canvas lg:h-[calc(100dvh-4rem)]">
      <header className="sticky top-16 z-30 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-surface px-4 py-3 sm:px-6 lg:static">
        <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
          <button
            type="button"
            onClick={exit}
            aria-label="Back to report types"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-secondary hover:bg-hover"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <input
                aria-label="Report type name"
                value={form.name}
                onChange={(e) => draft.setField('name', e.target.value)}
                placeholder="Untitled report type"
                className="-ml-1 min-w-[12ch] max-w-full truncate rounded-md border border-transparent bg-transparent px-1 text-base font-semibold text-ink outline-none [field-sizing:content] placeholder:text-ink-muted hover:border-line focus:border-line-accent"
              />
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${pillClass}`}>{pillLabel}</span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted" aria-live="polite">
              {dirty ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-warning-solid" aria-hidden="true" />
                  Unsaved changes
                </>
              ) : isNew ? (
                'Not saved yet'
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 text-success-fg" aria-hidden="true" />
                  All changes saved
                </>
              )}
            </p>
          </div>
        </div>

        <nav aria-label="Builder steps" className="order-last flex w-full gap-1 rounded-xl bg-active p-1 sm:order-none sm:w-auto" data-tour="rtb-steps">
          {STEPS.map((s, i) => {
            const current = s.id === step;
            const flagged = s.id === 'questions' && triedSave && questionErrors > 0;
            return (
              <button
                key={s.id}
                type="button"
                aria-current={current ? 'step' : undefined}
                onClick={() => goTo(s.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition-colors sm:flex-none ${
                  current ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink-muted hover:text-ink'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    flagged
                      ? 'bg-danger-solid text-white'
                      : current
                        ? 'bg-accent text-on-accent'
                        : i < stepIndex
                          ? 'bg-success-solid text-white'
                          : 'border-[1.5px] border-line-strong'
                  }`}
                >
                  {flagged ? questionErrors : i < stepIndex && !current ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-[1_1_16rem] items-center justify-end gap-2">
          {step === 'questions' && (
            <Button variant="secondary" startIcon={Eye} onClick={() => setPreviewOpen(true)} data-tour="rtb-preview">
              <span className="hidden sm:inline">Preview</span>
            </Button>
          )}
          {step !== 'questions' && isNew && (
            <Button variant="secondary" onClick={() => goTo(STEPS[stepIndex - 1].id)}>
              Back
            </Button>
          )}
          {!isNew && (
            <Button variant={step === 'review' ? 'primary' : 'secondary'} onClick={() => save()} isLoading={saving} startIcon={Check}>
              Save changes
            </Button>
          )}
          {isNew && step === 'review' && (
            <>
              <Button variant="secondary" onClick={() => save('draft')} disabled={saving}>
                Save as draft
              </Button>
              <Button onClick={() => save('active')} isLoading={saving} startIcon={Send} data-tour="rtb-submit">
                Publish
              </Button>
            </>
          )}
          {step !== 'review' && (
            <Button
              variant={isNew ? 'primary' : 'ghost'}
              endIcon={ArrowRight}
              onClick={() => goTo(STEPS[stepIndex + 1].id)}
              data-tour="rtb-next"
            >
              {isNew ? `Next: ${STEPS[stepIndex + 1].label}` : STEPS[stepIndex + 1].label}
            </Button>
          )}
        </div>
      </header>

      <div id="rtb-scroll" className={`flex min-h-0 flex-1 flex-col ${step === 'questions' ? '' : 'lg:overflow-y-auto lg:scrollbar-thin'}`}>
        {step === 'questions' && <QuestionsStep draft={draft} issues={visibleIssues} />}
        {step === 'handling' && (
          <HandlingStep
            draft={draft}
            codeLocked={codeLocked}
            nameError={triedSave && !form.name?.trim() ? 'Give the report type a name' : null}
          />
        )}
        {step === 'review' && <ReviewStep draft={draft} issues={issues} isNew={isNew} onFix={fix} />}
      </div>

      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="What reporters will see"
        size="xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">Nothing here is saved. Use Continue to page through the steps.</span>
            <span className="flex rounded-lg bg-active p-0.5">
              {['desktop', 'phone'].map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={previewDevice === d}
                  onClick={() => setPreviewDevice(d)}
                  className={`h-7 rounded-md px-2.5 text-xs font-medium capitalize ${previewDevice === d ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'}`}
                >
                  {d}
                </button>
              ))}
            </span>
          </div>
        }
      >
        <div className="flex justify-center">
          <ReporterPreview key={previewDevice} form={form} device={previewDevice} />
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          onExit();
        }}
        title="Leave without saving?"
        message={isNew ? "This report type hasn't been saved. It will be lost." : 'Your unsaved changes will be lost.'}
        confirmText="Leave"
        cancelText="Keep editing"
      />
    </div>
  );
};

export default ReportTypeEditor;
