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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('builder');
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
    <nav aria-label={t('outline.label')} className="flex h-full flex-col" data-tour="rtb-outline">
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{t('outline.steps')}</span>
        <span className="text-xs text-ink-muted">
          {t('outline.stepCount', { count: form.sections.length })} · {t('inspector.questionCount', { count: total })}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3 scrollbar-thin">
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
                title={t('outline.dragToReorder')}
                className={`group flex items-center rounded-lg transition-colors ${into ? 'bg-accent-soft ring-2 ring-accent' : stepSelected ? 'bg-surface shadow-[0_0_0_1.5px_var(--color-accent)]' : open ? '' : 'hover:bg-hover'
                  }`}
              >
              <GripVertical className="ms-0.5 h-3.5 w-3.5 shrink-0 cursor-grab text-ink-subtle opacity-0 group-hover:opacity-100" aria-hidden="true" />
              <button
                type="button"
                aria-expanded={open}
                onClick={() => select({ sectionId: section.id, questionId: null })}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-start"
              >
                <span
                  className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${open ? 'bg-accent text-on-accent' : 'bg-active text-ink-secondary'
                    }`}
                >
                  {index + 1}
                </span>
                <span className={`min-w-0 flex-1 truncate text-sm ${open ? 'font-semibold text-ink' : 'font-medium text-ink-secondary'}`}>
                  {section.title || <span className="italic text-ink-muted">{t('preview.untitledStep')}</span>}
                </span>
                {problemIds.has(section.id) && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-danger-solid" role="img" aria-label={t('outline.needsAttention')} />
                )}
                {isConditional(section) && <GitBranch className="h-3.5 w-3.5 shrink-0 text-accent-fg" aria-label={t('outline.hasCondition')} />}
                <span className="text-xs text-ink-muted">{section.questions.length}</span>
              </button>
              {/* On the open step: add a question, or delete the step, without
                  leaving the outline. A step holding core questions can't go. */}
              {open && (
                <span className="flex shrink-0 items-center pe-1">
                  <button
                    type="button"
                    onClick={() => addQuestion(section.id, 'text', selection?.questionId ?? null)}
                    aria-label={t('outline.addQuestionTo', { step: section.title || t('issues.stepN', { n: index + 1 }) })}
                    title={t('outline.addQuestion')}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-accent-fg transition-colors hover:bg-accent-soft"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {!locks(section) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (section.questions.length === 0 || window.confirm(t('inspector.deleteStepConfirm'))) {
                          removeSection(section.id);
                        }
                      }}
                      aria-label={t('outline.deleteNamed', { step: section.title || t('issues.stepN', { n: index + 1 }) })}
                      title={t('inspector.deleteStep')}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger-fg"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </span>
              )}
              </div>

              {open && section.questions.length > 0 && (
                <ul className="flex flex-col gap-px py-1 ps-3">
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
                          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors ${active
                            ? 'bg-surface font-medium text-ink shadow-[0_0_0_1.5px_var(--color-accent)]'
                            : 'text-ink-secondary hover:bg-surface/70'
                            }`}
                        >
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-accent-fg' : 'text-ink-muted'}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">
                            {question.label || <span className="italic text-ink-muted">{t('preview.untitledQuestion')}</span>}
                          </span>
                          {problemIds.has(question.id) && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-danger-solid" role="img" aria-label={t('outline.needsAttention')} />
                          )}
                          {isConditional(question) && <GitBranch className="h-3 w-3 shrink-0 text-accent-fg" aria-label={t('outline.hasCondition')} />}
                          {(isCore(question) || entryFor(catalog, question)) && (
                            <Lock
                              className="h-3 w-3 shrink-0 text-ink-muted"
                              aria-label={isCore(question) ? t('outline.coreQuestion') : t('outline.standardQuestion')}
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
          {t('outline.addStep')}
        </button>
      </div>

      {!catalog && form.sections.some((s) => s.questions.some(isCore)) && (
        <p className="m-3 flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
          <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
          {t('outline.lockedNote')}
        </p>
      )}
    </nav>
  );
};

// ── Adding a question ─────────────────────────────────────────────────────────

const AddQuestionBar = ({ onAdd }) => {
  const { t } = useTranslation('builder');
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
      <span className="me-1 flex items-center gap-1.5 text-sm font-medium text-ink-secondary">
        {t('canvas.addQuestionLabel')}
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
          {t('canvas.moreTypes')}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        {moreOpen && (
          <div
            role="menu"
            className={`absolute start-0 z-20 w-52 rounded-xl border border-line bg-surface p-1.5 shadow-lg ${openUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          >
            {QUESTION_TYPES.filter((option) => !QUICK_TYPES.includes(option.value)).map((type) => (
              <button
                key={type.value}
                type="button"
                role="menuitem"
                onClick={() => add(type.value)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-sm text-ink-secondary hover:bg-hover hover:text-ink"
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
  const { t } = useTranslation('builder');
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
        <div className="absolute -bottom-4 end-4 z-10 flex gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm">
          <ToolButton label={t('canvas.moveUp')} disabled={index === 0} onClick={() => moveQuestion(section.id, question.id, -1)}>
            <ArrowUp className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton label={t('canvas.moveDown')} disabled={index === count - 1} onClick={() => moveQuestion(section.id, question.id, 1)}>
            <ArrowDown className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton label={t('canvas.duplicate')} onClick={() => duplicateQuestion(section.id, question.id)}>
            <Copy className="h-3.5 w-3.5" />
          </ToolButton>
          {removable && (
            <ToolButton label={entry ? t('inspector.turnOffQuestion') : t('inspector.deleteQuestion')} danger onClick={() => onRemove(section, question)}>
              <Trash2 className="h-3.5 w-3.5" />
            </ToolButton>
          )}
        </div>
      )}
      <div
        {...selectable(() => select({ sectionId: section.id, questionId: question.id }))}
        aria-pressed={active}
        className={`flex cursor-pointer flex-col gap-2 rounded-2xl border bg-surface px-6 py-4.5 text-start outline-none transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${active
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
            {question.label || <span className="font-normal italic text-ink-muted">{t('preview.untitledQuestion')}</span>}
            {question.required && <span className="ms-0.5 text-danger-fg">*</span>}
          </span>
          {(isCore(question) || entry) && (
            <span
              className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-ink-muted"
              title={entry?.drives ? t('canvas.feeds', { drives: entry.drives }) : undefined}
            >
              <Lock className="h-3 w-3" aria-hidden="true" />
              {isCore(question) ? t('canvas.coreAlwaysOn') : t('outline.standardQuestion')}
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
  const { t } = useTranslation('builder');
  const sections = form.sections;
  const index = Math.max(
    0,
    sections.findIndex((s) => s.id === selection?.sectionId),
  );
  const section = sections[index];

  if (!section) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="text-base font-semibold text-ink">{t('canvas.noSteps')}</p>
        <p className="max-w-sm text-sm text-ink-muted">{t('canvas.noStepsHint')}</p>
        <button
          type="button"
          onClick={() => addSection()}
          className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('canvas.addFirstStep')}
        </button>
      </div>
    );
  }

  const stepActive = selection?.sectionId === section.id && !selection?.questionId;
  const stepProblem = issuesFor(section.id)[0];
  const stepCondition = describeLogic(section.conditional_logic, sections, { subject: 'step' });
  const goTo = (i) => select({ sectionId: sections[i].id, questionId: null });

  return (
    <div className="mx-auto flex w-full max-w-170 flex-col gap-4 px-4 py-6 sm:px-8 sm:py-7" data-tour="rtb-canvas">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t('canvas.previousStep')}
            disabled={index === 0}
            onClick={() => goTo(index - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:bg-hover hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-ink-muted">
            {t('canvas.stepOfSee', { n: index + 1, total: sections.length })}
          </span>
          <button
            type="button"
            aria-label={t('canvas.nextStep')}
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
              aria-label={s.title ? t('canvas.goToStepNamed', { n: i + 1, title: s.title }) : t('canvas.goToStep', { n: i + 1 })}
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
          <div className="absolute -bottom-4 end-4 z-10 flex gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-sm">
            <ToolButton label={t('canvas.stepEarlier')} disabled={index === 0} onClick={() => moveSection(section.id, -1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label={t('canvas.stepLater')} disabled={index === sections.length - 1} onClick={() => moveSection(section.id, 1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </ToolButton>
            <ToolButton label={t('canvas.addStepAfter')} onClick={() => addSection(section.id)}>
              <Plus className="h-3.5 w-3.5" />
            </ToolButton>
          </div>
        )}
        <div
          {...selectable(() => select({ sectionId: section.id, questionId: null }))}
          aria-pressed={stepActive}
          className={`flex cursor-pointer flex-col items-start gap-1 rounded-2xl border bg-surface px-6 py-5 outline-none transition-[border-color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${stepActive
            ? 'border-accent shadow-[0_0_0_1px_var(--color-accent)]'
            : stepProblem
              ? 'border-danger-line'
              : 'border-line hover:border-line-strong'
            }`}
        >
          {stepCondition && (
            <span className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-fg">
              <GitBranch className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{stepCondition}</span>
            </span>
          )}
          <h2 className="text-xl font-bold tracking-[-0.01em] text-ink">
            {section.title || <span className="font-semibold italic text-ink-muted">{t('preview.untitledStep')}</span>}
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
          {t('canvas.nextStepNamed', { title: sections[index + 1].title || t('preview.untitledStep') })}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => addSection(section.id)}
          className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          {t('canvas.lastStep')}
        </button>
      )}
    </div>
  );
};

const QuestionsStep = ({ draft, issues }) => {
  const { t } = useTranslation('builder');
  // Removing a standard question confirms first, with what stops working.
  const [turningOff, setTurningOff] = useState(null); // { section, question, entry }
  const remove = (section, question) => {
    const entry = entryFor(draft.catalog, question);
    if (entry) setTurningOff({ section, question, entry });
    else draft.removeQuestion(section.id, question.id);
  };

  // Errors keyed by the question or step they're about, for inline flags.
  const byId = new Map();
  const errorIssues = issues.filter((issue) => issue.level === 'error');
  errorIssues.forEach(({ message, target }) => {
    const id = target?.questionId || target?.sectionId;
    if (!id) return;
    byId.set(id, [...(byId.get(id) || []), message]);
  });
  const issuesFor = (id) => byId.get(id) || [];
  // The first error about one setting of a question or step (issue.about), so
  // the inspector can show it under that field whatever the language.
  const issueAbout = (id, about) =>
    errorIssues.find((issue) => (issue.target?.questionId || issue.target?.sectionId) === id && issue.about === about)
      ?.message;
  // A step is flagged when it, or a question in it, needs attention.
  const problemIds = new Set(byId.keys());
  issues.forEach(({ level, target }) => {
    if (level === 'error' && target?.questionId) problemIds.add(target.sectionId);
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="hidden w-68 shrink-0 border-e border-line bg-surface lg:block">
        <Outline draft={draft} problemIds={problemIds} />
      </aside>
      <div className="min-w-0 flex-1 bg-canvas lg:overflow-y-auto lg:scrollbar-thin">
        <Canvas draft={draft} issuesFor={issuesFor} onRemove={remove} />
      </div>
      <aside
        aria-label={t('canvas.settings')}
        className="shrink-0 border-t border-line bg-surface lg:w-88 lg:overflow-y-auto lg:border-s lg:border-t-0 lg:scrollbar-thin"
        data-tour="rtb-inspector"
      >
        <Inspector draft={draft} issueAbout={issueAbout} onRemove={remove} />
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
