// src/components/reportTypeBuilder/QuestionsStep.jsx
//
// Step 1 of the report type builder: an outline of steps and questions on the
// left, the selected step drawn as a reporter will see it in the middle, and
// the selected item's settings on the right. Only one step is on the canvas at
// a time, so a long form never becomes one long page.
//
// Steps, and the questions of the open step, can be dragged in the outline:
// a question onto another step moves it to the end of that step. The order
// saved is the order drawn — the server renumbers from array position.
//
// Removing a standard question shows what stops working first (its
// `if_disabled`), from the canvas or the settings panel.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  GitBranch,
  GripVertical,
  Lock,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';
import FieldPreview from './FieldPreview';
import Inspector from './Inspector';
import { TurnOffConfirm } from './StandardQuestions';
import { QUESTION_TYPES, QUICK_TYPES, describeLogic, isConditional, isCore, typeInfo } from './model';
import { canTurnOff, entryFor } from './catalog';

// ── Outline ─────────────────────────────────────────────────────────────────

/** Where a dragged item would land: 'before' or 'after' the row under the pointer. */
const half = (event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
};

const DropLine = () => <div className="mx-2 h-0.5 rounded-full bg-accent" aria-hidden="true" />;

const Outline = ({ draft, problemIds }) => {
  const { form, selection, select, addSection, addQuestion, removeSection, catalog, moveSectionTo, moveQuestionTo } = draft;
  const activeId = selection?.sectionId;
  const total = form.sections.reduce((n, s) => n + s.questions.length, 0);
  const locks = (section) => section.questions.some((q) => isCore(q) || !canTurnOff(entryFor(catalog, q)));

  // ── Drag and drop ──
  const [dragging, setDragging] = useState(null); // { kind: 'step' | 'question', sectionId, questionId? }
  const [drop, setDrop] = useState(null); // { kind: 'step', index } | { kind: 'question', sectionId, index } | { kind: 'into', sectionId }
  const endDrag = () => {
    setDragging(null);
    setDrop(null);
  };
  const startDrag = (event, item) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', item.questionId || item.sectionId);
    setDragging(item);
  };
  const commit = (event) => {
    event.preventDefault();
    if (dragging && drop) {
      if (dragging.kind === 'step' && drop.kind === 'step') moveSectionTo(dragging.sectionId, drop.index);
      if (dragging.kind === 'question' && drop.kind === 'question')
        moveQuestionTo(dragging.sectionId, dragging.questionId, drop.sectionId, drop.index);
      if (dragging.kind === 'question' && drop.kind === 'into') {
        const target = form.sections.find((s) => s.id === drop.sectionId);
        moveQuestionTo(dragging.sectionId, dragging.questionId, drop.sectionId, target.questions.length);
      }
    }
    endDrag();
  };
  const overStep = (event, section, index) => {
    if (!dragging) return;
    if (dragging.kind === 'step') {
      event.preventDefault();
      const at = half(event) === 'before' ? index : index + 1;
      setDrop((prev) => (prev?.kind === 'step' && prev.index === at ? prev : { kind: 'step', index: at }));
    } else if (section.id !== dragging.sectionId) {
      event.preventDefault();
      setDrop((prev) => (prev?.kind === 'into' && prev.sectionId === section.id ? prev : { kind: 'into', sectionId: section.id }));
    }
  };
  const overQuestion = (event, section, index) => {
    if (dragging?.kind !== 'question') return;
    event.preventDefault();
    event.stopPropagation();
    const at = half(event) === 'before' ? index : index + 1;
    setDrop((prev) =>
      prev?.kind === 'question' && prev.sectionId === section.id && prev.index === at ? prev : { kind: 'question', sectionId: section.id, index: at },
    );
  };

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
          const into = drop?.kind === 'into' && drop.sectionId === section.id;
          return (
            <div key={section.id} onDragOver={(e) => overStep(e, section, index)} onDrop={commit}>
            {drop?.kind === 'step' && drop.index === index && <DropLine />}
            <div className={`rounded-xl ${open ? 'bg-accent-soft/60 p-1' : ''} ${dragging?.sectionId === section.id && dragging.kind === 'step' ? 'opacity-50' : ''}`}>
              <div
                draggable
                onDragStart={(e) => startDrag(e, { kind: 'step', sectionId: section.id })}
                onDragEnd={endDrag}
                title="Drag to reorder"
                className={`group flex items-center rounded-lg transition-colors ${into ? 'bg-accent-soft ring-2 ring-accent' : stepSelected ? 'bg-surface shadow-[0_0_0_1.5px_var(--color-accent)]' : open ? '' : 'hover:bg-hover'
                  }`}
              >
              <GripVertical className="ml-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-ink-subtle opacity-0 group-hover:opacity-100" aria-hidden="true" />
              <button
                type="button"
                aria-expanded={open}
                onClick={() => select({ sectionId: section.id, questionId: null })}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left"
              >
                <span
                  className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${open ? 'bg-accent text-on-accent' : 'bg-active text-ink-secondary'
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
              {/* On the open step: add a question, or delete the step, without
                  leaving the outline. A step holding core questions can't go. */}
              {open && (
                <span className="flex shrink-0 items-center pr-1">
                  <button
                    type="button"
                    onClick={() => addQuestion(section.id, 'text', selection?.questionId ?? null)}
                    aria-label={`Add a question to ${section.title || `step ${index + 1}`}`}
                    title="Add a question"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-accent-fg transition-colors hover:bg-accent-soft"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {!locks(section) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (section.questions.length === 0 || window.confirm('Delete this step and its questions?')) {
                          removeSection(section.id);
                        }
                      }}
                      aria-label={`Delete ${section.title || `step ${index + 1}`}`}
                      title="Delete step"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger-fg"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </span>
              )}
              </div>

              {open && section.questions.length > 0 && (
                <ul className="space-y-px py-1 pl-3">
                  {section.questions.map((question, qIndex) => {
                    const Icon = typeInfo(question.type).icon;
                    const active = selection?.questionId === question.id;
                    const lineHere = drop?.kind === 'question' && drop.sectionId === section.id;
                    return (
                      <li
                        key={question.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          startDrag(e, { kind: 'question', sectionId: section.id, questionId: question.id });
                        }}
                        onDragEnd={endDrag}
                        onDragOver={(e) => overQuestion(e, section, qIndex)}
                        onDrop={(e) => {
                          e.stopPropagation();
                          commit(e);
                        }}
                        className={dragging?.questionId === question.id ? 'opacity-50' : ''}
                      >
                        {lineHere && drop.index === qIndex && <DropLine />}
                        <button
                          type="button"
                          aria-current={active ? 'true' : undefined}
                          onClick={() => select({ sectionId: section.id, questionId: question.id })}
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${active
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
                          {(isCore(question) || entryFor(catalog, question)) && (
                            <Lock
                              className="h-3 w-3 shrink-0 text-ink-muted"
                              aria-label={isCore(question) ? 'Core question' : 'Standard question'}
                            />
                          )}
                        </button>
                        {lineHere && drop.index === qIndex + 1 && qIndex === section.questions.length - 1 && <DropLine />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {drop?.kind === 'step' && drop.index === index + 1 && index === form.sections.length - 1 && <DropLine />}
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

      {!catalog && form.sections.some((s) => s.questions.some(isCore)) && (
        <p className="m-3 flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
          <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
          Locked questions are core fields. They can't be removed or change type.
        </p>
      )}
    </nav>
  );
};

// ── Adding a question ─────────────────────────────────────────────────────────

const AddQuestionBar = ({ onAdd }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  // Opens downward, flipping up only when there isn't room below — near the
  // top of the canvas (the first question) an upward menu ran under the header.
  const [openUp, setOpenUp] = useState(false);
  const menuRef = useRef(null);

  const toggleMore = () => {
    if (!moreOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const menuHeight = (QUESTION_TYPES.length - QUICK_TYPES.length) * 40 + 16;
      setOpenUp(window.innerHeight - rect.bottom < menuHeight + 12 && rect.top > menuHeight + 12);
    }
    setMoreOpen((v) => !v);
  };

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
        Add a question :
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
          onClick={toggleMore}
          className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium text-link hover:bg-accent-soft"
        >
          More types
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {moreOpen && (
          <div
            role="menu"
            className={`absolute left-0 z-20 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lg ${openUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          >
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
    className={`flex h-7.5 w-7.5 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${danger ? 'text-danger-fg hover:bg-danger-soft' : 'text-ink-muted hover:bg-hover hover:text-ink'
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

const QuestionCard = ({ draft, section, question, index, count, problem, onRemove }) => {
  const { form, selection, select, moveQuestion, duplicateQuestion, catalog } = draft;
  const entry = entryFor(catalog, question);
  const removable = !isCore(question) && canTurnOff(entry);
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
          {removable && (
            <ToolButton label={entry ? 'Turn off this question' : 'Delete question'} danger onClick={() => onRemove(section, question)}>
              <Trash2 className="h-3.5 w-3.5" />
            </ToolButton>
          )}
        </div>
      )}
      <div
        {...selectable(() => select({ sectionId: section.id, questionId: question.id }))}
        aria-pressed={active}
        className={`cursor-pointer space-y-2 rounded-2xl border bg-surface px-6 py-4.5 text-left outline-none transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active
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
          {(isCore(question) || entry) && (
            <span
              className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted"
              title={entry?.drives ? `Feeds: ${entry.drives}` : undefined}
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              {isCore(question) ? 'Core · always on' : 'Standard question'}
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

const Canvas = ({ draft, issuesFor, onRemove }) => {
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
          className={`cursor-pointer space-y-1 rounded-2xl border bg-surface px-6 py-5 outline-none transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${stepActive
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
          onRemove={onRemove}
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
  // Removing a standard question confirms first, with what stops working.
  const [turningOff, setTurningOff] = useState(null); // { section, question, entry }
  const remove = (section, question) => {
    const entry = entryFor(draft.catalog, question);
    if (entry) setTurningOff({ section, question, entry });
    else draft.removeQuestion(section.id, question.id);
  };

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
        <Canvas draft={draft} issuesFor={issuesFor} onRemove={remove} />
      </main>
      <aside
        aria-label="Settings"
        className="shrink-0 border-t border-line bg-surface lg:w-88 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:scrollbar-thin"
        data-tour="rtb-inspector"
      >
        <Inspector draft={draft} issuesFor={issuesFor} onRemove={remove} />
      </aside>
      <TurnOffConfirm
        entry={turningOff?.entry}
        onClose={() => setTurningOff(null)}
        onConfirm={() => {
          draft.removeQuestion(turningOff.section.id, turningOff.question.id);
          setTurningOff(null);
        }}
      />
    </div>
  );
};

export default QuestionsStep;
