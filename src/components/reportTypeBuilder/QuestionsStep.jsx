// src/components/reportTypeBuilder/QuestionsStep.jsx
//
// Step 1 of the report type builder: an outline of steps and questions on the
// left, the selected step drawn as a reporter will see it in the middle, and
// the selected item's settings on the right. Only one step is on the canvas at
// a time, so a long form never becomes one long page.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  GitBranch,
  Lock,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import FieldPreview from './FieldPreview';
import Inspector from './Inspector';
import { QUESTION_TYPES, QUICK_TYPES, describeLogic, isConditional, isCore, typeInfo } from './model';

// ── Outline ─────────────────────────────────────────────────────────────────

const Outline = ({ draft, problemIds }) => {
  const { form, selection, select, addSection } = draft;
  const activeId = selection?.sectionId;
  const total = form.sections.reduce((n, s) => n + s.questions.length, 0);
  const hasCore = form.sections.some((s) => s.questions.some(isCore));

  return (
    <nav aria-label="Form outline" className="flex h-full flex-col" data-tour="rtb-outline">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Steps</span>
        <span className="text-xs text-ink-muted">
          {form.sections.length} step{form.sections.length === 1 ? '' : 's'} · {total} question{total === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
        {form.sections.map((section, index) => {
          const open = section.id === activeId;
          const stepSelected = open && !selection?.questionId;
          return (
            <div key={section.id} className={`rounded-xl ${open ? 'bg-accent-soft/60 p-1' : ''}`}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => select({ sectionId: section.id, questionId: null })}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                  stepSelected ? 'bg-surface shadow-[0_0_0_1.5px_var(--color-accent)]' : open ? '' : 'hover:bg-hover'
                }`}
              >
                <span
                  className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                    open ? 'bg-accent text-on-accent' : 'bg-active text-ink-secondary'
                  }`}
                >
                  {index + 1}
                </span>
                <span className={`min-w-0 flex-1 truncate text-sm ${open ? 'font-semibold text-ink' : 'font-medium text-ink-secondary'}`}>
                  {section.title || <span className="italic text-ink-muted">Untitled step</span>}
                </span>
                {problemIds.has(section.id) && <span className="h-2 w-2 shrink-0 rounded-full bg-danger-solid" aria-label="Needs attention" />}
                {isConditional(section) && <GitBranch className="h-3.5 w-3.5 shrink-0 text-accent-fg" aria-label="Has a condition" />}
                <span className="text-xs text-ink-muted">{section.questions.length}</span>
              </button>

              {open && section.questions.length > 0 && (
                <ul className="space-y-px py-1 pl-3">
                  {section.questions.map((question) => {
                    const Icon = typeInfo(question.type).icon;
                    const active = selection?.questionId === question.id;
                    return (
                      <li key={question.id}>
                        <button
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => select({ sectionId: section.id, questionId: question.id })}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                            active
                              ? 'bg-surface font-medium text-ink shadow-[0_0_0_1.5px_var(--color-accent)]'
                              : 'text-ink-secondary hover:bg-surface/70'
                          }`}
                        >
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-accent-fg' : 'text-ink-muted'}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">
                            {question.label || <span className="italic text-ink-muted">Untitled question</span>}
                          </span>
                          {problemIds.has(question.id) && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-danger-solid" aria-label="Needs attention" />
                          )}
                          {isConditional(question) && <GitBranch className="h-3 w-3 shrink-0 text-accent-fg" aria-label="Has a condition" />}
                          {isCore(question) && <Lock className="h-3 w-3 shrink-0 text-ink-muted" aria-label="Required question" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => addSection(activeId)}
          className="mt-2 flex w-full items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2.5 text-sm font-medium text-link transition-colors hover:border-line-accent hover:bg-accent-soft/50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add step
        </button>
      </div>

      {hasCore && (
        <p className="m-3 flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
          <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
          Locked questions are core fields. You can reword them, but not remove them or change their type.
        </p>
      )}
    </nav>
  );
};

// ── Adding a question ─────────────────────────────────────────────────────────

const AddQuestionBar = ({ onAdd }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMoreOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const add = (type) => {
    setMoreOpen(false);
    onAdd(type);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface/60 px-4 py-3.5"
      data-tour="rtb-add-question"
    >
      <span className="mr-1 flex items-center gap-1.5 text-sm font-medium text-ink-secondary">
        <Plus className="h-4 w-4 text-accent-fg" aria-hidden="true" />
        Add a question
      </span>
      {QUICK_TYPES.map((value) => {
        const type = typeInfo(value);
        return (
          <button
            key={value}
            type="button"
            onClick={() => add(value)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm text-ink-secondary transition-colors hover:border-line-accent hover:text-accent-fg"
          >
            <type.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {type.label}
          </button>
        );
      })}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          onClick={() => setMoreOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium text-link hover:bg-accent-soft"
        >
          More types
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {moreOpen && (
          <div role="menu" className="absolute bottom-full left-0 z-20 mb-2 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
            {QUESTION_TYPES.filter((t) => !QUICK_TYPES.includes(t.value)).map((type) => (
              <button
                key={type.value}
                type="button"
                role="menuitem"
                onClick={() => add(type.value)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-secondary hover:bg-hover hover:text-ink"
              >
                <type.icon className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                {type.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Canvas ──────────────────────────────────────────────────────────────────

const ToolButton = ({ label, onClick, disabled, danger, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    className={`flex h-7.5 w-7.5 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
      danger ? 'text-danger-fg hover:bg-danger-soft' : 'text-ink-muted hover:bg-hover hover:text-ink'
    }`}
  >
    {children}
  </button>
);

const selectable = (onSelect) => ({
  role: 'button',
  tabIndex: 0,
  onClick: onSelect,
  onKeyDown: (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  },
});

const QuestionCard = ({ draft, section, question, index, count, problem }) => {
  const { form, selection, select, moveQuestion, duplicateQuestion, removeQuestion } = draft;
  const active = selection?.questionId === question.id;
  const condition = describeLogic(question.conditional_logic, form.sections);
  const ref = useRef(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [active]);

  return (
    <div className="relative" ref={ref}>
      {active && (
        <div className="absolute -bottom-4 right-4 z-10 flex gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm">
          <ToolButton label="Move up" disabled={index === 0} onClick={() => moveQuestion(section.id, question.id, -1)}>
            <ArrowUp className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton label="Move down" disabled={index === count - 1} onClick={() => moveQuestion(section.id, question.id, 1)}>
            <ArrowDown className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton label="Duplicate" onClick={() => duplicateQuestion(section.id, question.id)}>
            <Copy className="h-3.5 w-3.5" />
          </ToolButton>
          {!isCore(question) && (
            <ToolButton label="Delete question" danger onClick={() => removeQuestion(section.id, question.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </ToolButton>
          )}
        </div>
      )}
      <div
        {...selectable(() => select({ sectionId: section.id, questionId: question.id }))}
        aria-pressed={active}
        className={`cursor-pointer space-y-2 rounded-2xl border bg-surface px-6 py-4.5 text-left outline-none transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
          active
            ? 'border-accent shadow-[0_0_0_1px_var(--color-accent),0_6px_20px_-8px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]'
            : problem
              ? 'border-danger-line hover:border-danger-fg'
              : 'border-line hover:border-line-strong'
        }`}
      >
        {condition && (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-fg">
            <GitBranch className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{condition}</span>
          </span>
        )}
        <div className="flex items-start gap-3">
          <span className="min-w-0 flex-1 text-[0.9375rem] font-semibold text-ink">
            {question.label || <span className="font-normal italic text-ink-muted">Untitled question</span>}
            {question.required && <span className="ml-0.5 text-danger-fg">*</span>}
          </span>
          {isCore(question) && (
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Required by policy
            </span>
          )}
        </div>
        {question.help_text && <p className="text-sm text-ink-muted">{question.help_text}</p>}
        <FieldPreview question={question} />
        {problem && <p className="text-xs font-medium text-danger-fg">{problem}</p>}
      </div>
    </div>
  );
};

const Canvas = ({ draft, issuesFor }) => {
  const { form, selection, select, addQuestion, addSection, moveSection } = draft;
  const sections = form.sections;
  const index = Math.max(
    0,
    sections.findIndex((s) => s.id === selection?.sectionId),
  );
  const section = sections[index];

  if (!section) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-base font-semibold text-ink">No steps yet</p>
        <p className="max-w-sm text-sm text-ink-muted">A step is one page of the form. Add one, then add its questions.</p>
        <button
          type="button"
          onClick={() => addSection()}
          className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add the first step
        </button>
      </div>
    );
  }

  const stepActive = selection?.sectionId === section.id && !selection?.questionId;
  const stepProblem = issuesFor(section.id)[0];
  const stepCondition = describeLogic(section.conditional_logic, sections);
  const goTo = (i) => select({ sectionId: sections[i].id, questionId: null });

  return (
    <div className="mx-auto w-full max-w-170 space-y-4 px-4 py-6 sm:px-8 sm:py-7" data-tour="rtb-canvas">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous step"
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-hover hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-ink-muted">
            Step {index + 1} of {sections.length} · what reporters will see
          </span>
          <button
            type="button"
            aria-label="Next step"
            disabled={index === sections.length - 1}
            onClick={() => goTo(index + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-hover hover:text-ink disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-1">
          {sections.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to step ${i + 1}${s.title ? `: ${s.title}` : ''}`}
              onClick={() => goTo(i)}
              className="flex h-4 items-center"
            >
              <span className={`block h-1 w-7 rounded-full transition-colors ${i === index ? 'bg-accent' : i < index ? 'bg-accent/40' : 'bg-active'}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {stepActive && (
          <div className="absolute -bottom-4 right-4 z-10 flex gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm">
            <ToolButton label="Move step earlier" disabled={index === 0} onClick={() => moveSection(section.id, -1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label="Move step later" disabled={index === sections.length - 1} onClick={() => moveSection(section.id, 1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label="Add a step after this one" onClick={() => addSection(section.id)}>
              <Plus className="h-3.5 w-3.5" />
            </ToolButton>
          </div>
        )}
        <div
          {...selectable(() => select({ sectionId: section.id, questionId: null }))}
          aria-pressed={stepActive}
          className={`cursor-pointer space-y-1 rounded-2xl border bg-surface px-6 py-5 outline-none transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
            stepActive
              ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]'
              : stepProblem
                ? 'border-danger-line'
                : 'border-line hover:border-line-strong'
          }`}
        >
          {stepCondition && (
            <span className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-fg">
              <GitBranch className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{stepCondition.replace('Only shown', 'Step only shown').replace('Skipped', 'Step skipped')}</span>
            </span>
          )}
          <h2 className="text-xl font-bold tracking-[-0.01em] text-ink">
            {section.title || <span className="font-semibold italic text-ink-muted">Untitled step</span>}
          </h2>
          {section.description && <p className="text-sm text-ink-muted">{section.description}</p>}
          {stepProblem && <p className="pt-1 text-xs font-medium text-danger-fg">{stepProblem}</p>}
        </div>
      </div>

      {section.questions.map((question, i) => (
        <QuestionCard
          key={question.id}
          draft={draft}
          section={section}
          question={question}
          index={i}
          count={section.questions.length}
          problem={issuesFor(question.id)[0]}
        />
      ))}

      <AddQuestionBar onAdd={(type) => addQuestion(section.id, type, selection?.sectionId === section.id ? selection.questionId : null)} />

      {index < sections.length - 1 ? (
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-ink-muted hover:text-ink"
        >
          Next step: {sections[index + 1].title || 'Untitled step'}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => addSection(section.id)}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          Last step. Add another?
        </button>
      )}
    </div>
  );
};

const QuestionsStep = ({ draft, issues }) => {
  // Errors keyed by the question or step they're about, for inline flags.
  const byId = new Map();
  issues
    .filter((issue) => issue.level === 'error')
    .forEach(({ message, target }) => {
      const id = target?.questionId || target?.sectionId;
      if (!id) return;
      byId.set(id, [...(byId.get(id) || []), message]);
    });
  const issuesFor = (id) => byId.get(id) || [];
  // A step is flagged when it, or a question in it, needs attention.
  const problemIds = new Set(byId.keys());
  issues.forEach(({ level, target }) => {
    if (level === 'error' && target?.questionId) problemIds.add(target.sectionId);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="hidden w-68 shrink-0 border-r border-line bg-surface lg:block">
        <Outline draft={draft} problemIds={problemIds} />
      </aside>
      <main className="min-w-0 flex-1 bg-canvas lg:overflow-y-auto lg:scrollbar-thin">
        <Canvas draft={draft} issuesFor={issuesFor} />
      </main>
      <aside
        aria-label="Settings"
        className="shrink-0 border-t border-line bg-surface lg:w-88 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:scrollbar-thin"
        data-tour="rtb-inspector"
      >
        <Inspector draft={draft} issuesFor={issuesFor} />
      </aside>
    </div>
  );
};

export default QuestionsStep;
