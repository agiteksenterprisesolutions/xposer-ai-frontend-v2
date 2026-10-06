// src/components/workflows/Inspector.jsx
//
// The builder's right-hand panel: the selected step's settings, or — with
// nothing selected — the workflow's own.
//
// An agent's branches are chosen from the decisions it declares, never typed,
// because a rule on a verdict the agent never returns can't fire. A decision
// left on "Continue to the next step" has no rule written for it at all.
import { ArrowDown, ArrowUp, Bot, CheckCircle2, Plus, Trash2, UserRound, X, XCircle } from 'lucide-react';
import { suggestCode } from '../../utils/codes';
import { AGENT_KIND_INFO } from '../../utils/agents';
import { END, EXECUTOR_AGENT, EXECUTOR_HUMAN, NEXT, setBranch, stagePorts, uniqueKey } from '../../utils/workflows';

const fieldClass =
  'w-full rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle hover:border-line-strong focus:border-line-accent focus:ring-2 focus:ring-accent-ring disabled:opacity-60 read-only:bg-sunken';

const Field = ({ label, hint, error, children }) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-medium text-ink-secondary">{label}</span>
    {children}
    {(error || hint) && <span className={`block text-[11px] ${error ? 'text-danger-fg' : 'text-ink-subtle'}`}>{error || hint}</span>}
  </label>
);

const Section = ({ title, aside, children }) => (
  <section className="space-y-3 border-t border-line-subtle px-4 py-4 first:border-t-0">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

const Switch = ({ checked, onChange, disabled, label, description }) => (
  <div className="flex items-start justify-between gap-3">
    <span>
      <span className="block text-sm font-medium text-ink">{label}</span>
      {description && <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-success-solid' : 'bg-active'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-[left] ${checked ? 'left-[18px]' : 'left-0.5'}`}
      />
    </button>
  </div>
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 text-[13px]">
    <span className="text-ink-muted">{label}</span>
    <span className="text-right font-medium text-ink">{children}</span>
  </div>
);

const ProblemList = ({ problems }) => (
  <ul className="space-y-1.5 rounded-lg bg-danger-soft px-3 py-2.5">
    {problems.map((problem, i) => (
      <li key={i} className="flex items-start gap-1.5 text-xs text-danger-fg">
        <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
        {problem.message}
      </li>
    ))}
  </ul>
);

const Shell = ({ title, eyebrow, onClose, children, footer }) => (
  <aside className="flex max-h-full w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
    <header className="flex items-start justify-between gap-2 border-b border-line-subtle px-4 py-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{eyebrow}</p>}
        <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close panel"
        className="rounded-md p-1 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
    </header>
    <div className="flex-1 overflow-y-auto">{children}</div>
    {footer}
  </aside>
);

// ─── A step ──────────────────────────────────────────────────────────────

const GotoSelect = ({ value, onChange, targets, disabled, allowContinue, label }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    disabled={disabled}
    aria-label={label}
    className={`${fieldClass} py-1.5 text-[13px]`}
  >
    {allowContinue ? <option value="">Continue to the next step</option> : <option value={NEXT}>Continue to the next step</option>}
    <option value={END}>End the workflow</option>
    {targets.map((target) => (
      <option key={target._id} value={target.key}>
        Go to: {target.name || target.key}
      </option>
    ))}
    {value && ![NEXT, END].includes(value) && !targets.some((t) => t.key === value) && (
      <option value={value}>{value} (missing)</option>
    )}
  </select>
);

export const StageInspector = ({
  stage,
  index,
  stages,
  agents,
  agentsByCode,
  roles,
  problems,
  readOnly,
  onChange,
  onMove,
  onRemove,
  onClose,
}) => {
  const isAgent = stage.executor_type === EXECUTOR_AGENT;
  const agent = isAgent ? agentsByCode.get(stage.executor_ref) : null;
  const role = !isAgent ? roles.find((r) => r.code === stage.executor_ref) : null;
  const isSummarizer = agent?.kind === 'summarizer';
  const ports = stagePorts(stage, agent);
  const targets = stages.filter((s) => s._id !== stage._id && s.key);
  const executorFound = isAgent ? Boolean(agent) : Boolean(role);

  // Until the step has a name of its own, it borrows the executor's.
  const chooseExecutor = (ref) => {
    const label = isAgent ? agentsByCode.get(ref)?.name : roles.find((r) => r.code === ref)?.name;
    const patch = { executor_ref: ref, transitions: [] };
    if (stage._autoKey && label) {
      patch.name = label;
      patch.key = uniqueKey(suggestCode(label, 'step'), stages, stage._id);
    }
    onChange(patch);
  };

  const setTransition = (i, patch) =>
    onChange({ transitions: stage.transitions.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  return (
    <Shell
      eyebrow={`Step ${index + 1} of ${stages.length}`}
      title={stage.name || agent?.name || role?.name || 'New step'}
      onClose={onClose}
      footer={
        !readOnly && (
          <footer className="flex items-center justify-between gap-2 border-t border-line-subtle px-4 py-3">
            <div className="flex gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(-1)}
                title="Run this step earlier"
                aria-label="Run this step earlier"
                className="rounded-md border border-line p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={index === stages.length - 1}
                onClick={() => onMove(1)}
                title="Run this step later"
                aria-label="Run this step later"
                className="rounded-md border border-line p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-40"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-danger-fg transition-colors hover:bg-danger-soft"
            >
              <Trash2 className="h-4 w-4" />
              Delete step
            </button>
          </footer>
        )
      }
    >
      {problems.length > 0 && (
        <div className="px-4 pt-4">
          <ProblemList problems={problems} />
        </div>
      )}

      <Section title="Details">
        <Field label="Name">
          <input
            value={stage.name}
            readOnly={readOnly}
            placeholder="e.g. Triage"
            onChange={(event) => {
              const name = event.target.value;
              onChange(
                stage._autoKey && name.trim()
                  ? { name, key: uniqueKey(suggestCode(name, 'step'), stages, stage._id) }
                  : { name },
              );
            }}
            className={fieldClass}
          />
        </Field>
        <Field label="Key" hint="Identifies this step in run logs. Renaming it keeps its incoming branches.">
          <input
            value={stage.key}
            readOnly={readOnly}
            onChange={(event) => onChange({ key: event.target.value, _autoKey: false })}
            className={`${fieldClass} font-mono text-[13px]`}
          />
        </Field>
      </Section>

      <Section title="Run by">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-subtle p-1" role="radiogroup" aria-label="Who runs this step">
          {[
            { value: EXECUTOR_AGENT, label: 'AI agent', icon: Bot },
            { value: EXECUTOR_HUMAN, label: 'A person', icon: UserRound },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={stage.executor_type === value}
              disabled={readOnly}
              onClick={() => stage.executor_type !== value && onChange({ executor_type: value, executor_ref: '', transitions: [] })}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                stage.executor_type === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <select
          value={stage.executor_ref}
          onChange={(event) => chooseExecutor(event.target.value)}
          disabled={readOnly}
          aria-label={isAgent ? 'Agent' : 'Role'}
          className={fieldClass}
        >
          <option value="">{isAgent ? 'Choose an agent…' : 'Choose a role…'}</option>
          {isAgent
            ? agents.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name} — {AGENT_KIND_INFO[a.kind]?.label || a.kind}
                  {a.is_active === false ? ' (inactive)' : ''}
                </option>
              ))
            : roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
          {isSummarizer && (
            <option value={stage.executor_ref}>{agent.name} — Summarizer (can't be a step)</option>
          )}
          {stage.executor_ref && !executorFound && <option value={stage.executor_ref}>{stage.executor_ref} (not found)</option>}
        </select>

        {isSummarizer && (
          <div className="space-y-2 rounded-lg border border-warning-line bg-warning-soft p-3 text-xs text-warning-fg">
            <p>
              The summarizer runs automatically before the first step and its digest goes to every agent below, so it
              can't be a step. This step is skipped when a report runs.
            </p>
            {!readOnly && (
              <button type="button" onClick={onRemove} className="font-semibold underline">
                Remove this step
              </button>
            )}
          </div>
        )}

        {!isAgent && stage.executor_ref && (
          <p className="text-xs text-ink-muted">
            The run pauses here until someone holding this role acts on the report. Steps are assigned to a role, not to a
            named person.
          </p>
        )}
        {agent?.is_active === false && (
          <p className="text-xs text-warning-fg">This agent is inactive, so the step won't run until it is reactivated.</p>
        )}
      </Section>

      <Section title="Branches">
        {isSummarizer ? (
          <p className="text-xs text-ink-muted">Nothing to branch on — this step is skipped.</p>
        ) : isAgent ? (
          <>
            {!stage.executor_ref && <p className="text-xs text-ink-muted">Choose an agent to see the decisions it can reach.</p>}
            {agent && ports.length === 0 && (
              <p className="text-xs text-ink-muted">
                This agent declares no decisions, so there is nothing to branch on. Add some on the AI Agents page.
              </p>
            )}
            {ports.map((port) => (
              <div key={port.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate font-mono text-xs ${port.declared ? 'text-ink-secondary' : 'text-danger-fg'}`}>
                    When it decides <span className="font-semibold">{port.decision}</span>
                  </span>
                  {!port.declared && <span className="shrink-0 text-[11px] text-danger-fg">not a decision of this agent</span>}
                </div>
                <GotoSelect
                  value={port.goto === NEXT ? '' : port.goto || ''}
                  onChange={(goto) => onChange({ transitions: setBranch(stage, port.decision, goto).transitions })}
                  targets={targets}
                  disabled={readOnly}
                  allowContinue
                  label={`Where ${port.decision} goes`}
                />
              </div>
            ))}
          </>
        ) : (
          <>
            {stage.transitions.length === 0 && (
              <p className="text-xs text-ink-muted">No outcomes — once the person acts, the report continues to the next step.</p>
            )}
            {stage.transitions.map((transition, i) => (
              <div key={i} className="space-y-1 rounded-lg border border-line-subtle p-2">
                <div className="flex items-center gap-1.5">
                  <input
                    value={transition.when_decision}
                    onChange={(event) => setTransition(i, { when_decision: suggestCode(event.target.value, 'd') })}
                    readOnly={readOnly}
                    placeholder="outcome, e.g. approve"
                    aria-label="Outcome"
                    className={`${fieldClass} py-1.5 font-mono text-[13px]`}
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onChange({ transitions: stage.transitions.filter((_, j) => j !== i) })}
                      aria-label="Remove outcome"
                      className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-danger-fg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <GotoSelect
                  value={transition.goto}
                  onChange={(goto) => setTransition(i, { goto })}
                  targets={targets}
                  disabled={readOnly}
                  label="Where this outcome goes"
                />
              </div>
            ))}
            {!readOnly && (
              <button
                type="button"
                onClick={() => onChange({ transitions: [...stage.transitions, { when_decision: '', goto: END }] })}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent-soft"
              >
                <Plus className="h-3.5 w-3.5" />
                Add an outcome
              </button>
            )}
          </>
        )}
        {!isSummarizer && !readOnly && (isAgent ? ports.length > 0 : true) && (
          <p className="text-[11px] text-ink-subtle">
            You can also drag from an outcome's dot on the canvas to the step it should go to.
          </p>
        )}
      </Section>

      <Section title="Options">
        <Switch
          label="Optional step"
          checked={stage.optional}
          disabled={readOnly}
          onChange={(optional) => onChange({ optional })}
        />
      </Section>
    </Shell>
  );
};

// ─── The workflow ────────────────────────────────────────────────────────

export const WorkflowInspector = ({
  workflow,
  isCreate,
  name,
  description,
  maxVisits,
  isActive,
  visitsError,
  visitLimits,
  activeOther,
  stages,
  problems,
  blockedReason,
  readOnly,
  onName,
  onDescription,
  onMaxVisits,
  onActive,
  onSelectStage,
  onClose,
}) => {
  const humanSteps = stages.filter((s) => s.executor_type === EXECUTOR_HUMAN).length;
  const branches = stages.reduce((n, s) => n + s.transitions.filter((t) => t.when_decision).length, 0);

  return (
    <Shell eyebrow="Workflow" title={name || 'Untitled workflow'} onClose={onClose}>
      <Section title="Details">
        <Field label="Name">
          <input value={name} readOnly={readOnly} onChange={(event) => onName(event.target.value)} className={fieldClass} />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            readOnly={readOnly}
            rows={3}
            placeholder="What this workflow is for"
            onChange={(event) => onDescription(event.target.value)}
            className={`${fieldClass} resize-y`}
          />
        </Field>
      </Section>

      <Section title="Checks">
        {problems.length === 0 && !blockedReason ? (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-success-fg">
            <CheckCircle2 className="h-4 w-4" />
            Ready to run
          </p>
        ) : problems.length === 0 ? (
          <p className="text-[13px] text-ink-muted">{blockedReason}</p>
        ) : (
          <ul className="space-y-1.5">
            {problems.map((problem, i) => {
              const target = problem.stage ? stages.find((s) => s.key === problem.stage) : null;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!target}
                    onClick={() => target && onSelectStage(target._id)}
                    className="flex w-full items-start gap-1.5 rounded-lg bg-danger-soft px-2.5 py-2 text-left text-xs text-danger-fg enabled:hover:brightness-95"
                  >
                    <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                    <span>
                      {target && <span className="font-semibold">{target.name || target.key}: </span>}
                      {!target && problem.stage && <span className="font-semibold">{problem.stage}: </span>}
                      {problem.message}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Properties">
        <div className="space-y-2">
          <Row label="Status">{isCreate ? 'Not saved yet' : workflow?.is_active ? 'Running' : 'Standby'}</Row>
          {workflow?.version != null && <Row label="Version">v{workflow.version}</Row>}
          <Row label="Steps">{stages.length}</Row>
          <Row label="Handled by people">{humanSteps}</Row>
          <Row label="Branches">{branches}</Row>
        </div>
      </Section>

      <Section title="Run settings">
        <Switch
          label="Use for new reports"
          description={
            isActive && activeOther && !workflow?.is_active
              ? `Only one workflow runs at a time. Saving stands down "${activeOther.name}".`
              : 'Only one workflow runs at a time.'
          }
          checked={isActive}
          disabled={readOnly}
          onChange={onActive}
        />
        <Field
          label="Max visits per step"
          hint="How many times one step may run for a single report. Bounds send-back loops."
          error={visitsError}
        >
          <input
            type="number"
            min={visitLimits.min}
            max={visitLimits.max}
            value={maxVisits}
            readOnly={readOnly}
            onChange={(event) => onMaxVisits(event.target.value)}
            className={`${fieldClass} w-24`}
          />
        </Field>
      </Section>
    </Shell>
  );
};
