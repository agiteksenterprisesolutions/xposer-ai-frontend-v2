// src/components/workflows/Inspector.jsx
//
// The builder's right-hand panel: the selected step's settings, or — with
// nothing selected — the workflow's own.
//
// An agent's branches are chosen from the decisions it declares, never typed,
// because a rule on a verdict the agent never returns can't fire. A decision
// left on "Continue to the next step" has no rule written for it at all.
import { Trans, useTranslation } from 'react-i18next';
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
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-[inset-inline-start] ${checked ? 'start-[18px]' : 'start-0.5'}`}
      />
    </button>
  </div>
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 text-[13px]">
    <span className="text-ink-muted">{label}</span>
    <span className="text-end font-medium text-ink">{children}</span>
  </div>
);

const ProblemList = ({ problems }) => (
  <ul className="space-y-1.5 rounded-lg bg-danger-soft px-3 py-2.5">
    {problems.map((problem, i) => (
      <li key={i} className="flex items-start gap-1.5 text-xs text-danger-fg">
        <XCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {problem.message}
      </li>
    ))}
  </ul>
);

const Shell = ({ title, eyebrow, onClose, children, footer }) => {
  const { t } = useTranslation('admin');
  return (
  <aside className="flex max-h-full w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
    <header className="flex items-start justify-between gap-2 border-b border-line-subtle px-4 py-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{eyebrow}</p>}
        <h2 className="truncate text-sm font-semibold text-ink" dir="auto">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('workflow.inspector.closePanel')}
        className="rounded-md p-1 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </header>
    <div className="flex-1 overflow-y-auto">{children}</div>
    {footer}
  </aside>
  );
};

// ─── A step ──────────────────────────────────────────────────────────────

const GotoSelect = ({ value, onChange, targets, disabled, allowContinue, label }) => {
  const { t } = useTranslation('admin');
  return (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    disabled={disabled}
    aria-label={label}
    className={`${fieldClass} py-1.5 text-[13px]`}
  >
    {allowContinue ? <option value="">{t('workflow.inspector.continueNext')}</option> : <option value={NEXT}>{t('workflow.inspector.continueNext')}</option>}
    <option value={END}>{t('workflow.inspector.endWorkflow')}</option>
    {targets.map((target) => (
      <option key={target._id} value={target.key}>
        {t('workflow.inspector.goTo', { name: target.name || target.key })}
      </option>
    ))}
    {value && ![NEXT, END].includes(value) && !targets.some((target) => target.key === value) && (
      <option value={value}>{t('workflow.goto.missing', { key: value })}</option>
    )}
  </select>
  );
};

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
  const { t } = useTranslation('admin');
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
    onChange({ transitions: stage.transitions.map((tr, j) => (j === i ? { ...tr, ...patch } : tr)) });

  return (
    <Shell
      eyebrow={t('workflow.inspector.stepOf', { n: index + 1, total: stages.length })}
      title={stage.name || agent?.name || role?.name || t('workflow.node.newStep')}
      onClose={onClose}
      footer={
        !readOnly && (
          <footer className="flex items-center justify-between gap-2 border-t border-line-subtle px-4 py-3">
            <div className="flex gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => onMove(-1)}
                title={t('workflow.inspector.earlier')}
                aria-label={t('workflow.inspector.earlier')}
                className="rounded-md border border-line p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-40"
              >
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={index === stages.length - 1}
                onClick={() => onMove(1)}
                title={t('workflow.inspector.later')}
                aria-label={t('workflow.inspector.later')}
                className="rounded-md border border-line p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-40"
              >
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-danger-fg transition-colors hover:bg-danger-soft"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('workflow.inspector.deleteStep')}
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

      <Section title={t('workflow.inspector.details')}>
        <Field label={t('workflow.inspector.name')}>
          <input
            value={stage.name}
            readOnly={readOnly}
            placeholder={t('workflow.inspector.namePlaceholder')}
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
        <Field label={t('workflow.inspector.key')} hint={t('workflow.inspector.keyHint')}>
          <input
            value={stage.key}
            readOnly={readOnly}
            onChange={(event) => onChange({ key: event.target.value, _autoKey: false })}
            className={`${fieldClass} font-mono text-[13px]`}
          />
        </Field>
      </Section>

      <Section title={t('workflow.inspector.runBy')}>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-subtle p-1" role="radiogroup" aria-label={t('workflow.inspector.whoRuns')}>
          {[
            { value: EXECUTOR_AGENT, label: t('workflow.inspector.aiAgent'), icon: Bot },
            { value: EXECUTOR_HUMAN, label: t('workflow.inspector.aPerson'), icon: UserRound },
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
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <select
          value={stage.executor_ref}
          onChange={(event) => chooseExecutor(event.target.value)}
          disabled={readOnly}
          aria-label={isAgent ? t('workflow.inspector.agent') : t('workflow.inspector.role')}
          className={fieldClass}
        >
          <option value="">{isAgent ? t('workflow.inspector.chooseAgent') : t('workflow.inspector.chooseRole')}</option>
          {isAgent
            ? agents.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name} — {AGENT_KIND_INFO[a.kind]?.label || a.kind}
                  {a.is_active === false ? ` (${t('workflow.palette.inactive')})` : ''}
                </option>
              ))
            : roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
          {isSummarizer && (
            <option value={stage.executor_ref}>{t('workflow.inspector.summarizerOption', { name: agent.name })}</option>
          )}
          {stage.executor_ref && !executorFound && <option value={stage.executor_ref}>{t('workflow.inspector.notFound', { ref: stage.executor_ref })}</option>}
        </select>

        {isSummarizer && (
          <div className="space-y-2 rounded-lg border border-warning-line bg-warning-soft p-3 text-xs text-warning-fg">
            <p>{t('workflow.inspector.summarizerNote')}</p>
            {!readOnly && (
              <button type="button" onClick={onRemove} className="font-semibold underline">
                {t('workflow.inspector.removeStep')}
              </button>
            )}
          </div>
        )}

        {!isAgent && stage.executor_ref && (
          <p className="text-xs text-ink-muted">{t('workflow.inspector.humanNote')}</p>
        )}
        {agent?.is_active === false && (
          <p className="text-xs text-warning-fg">{t('workflow.inspector.inactiveAgent')}</p>
        )}
      </Section>

      <Section title={t('workflow.inspector.branches')}>
        {isSummarizer ? (
          <p className="text-xs text-ink-muted">{t('workflow.inspector.nothingToBranchSkipped')}</p>
        ) : isAgent ? (
          <>
            {!stage.executor_ref && <p className="text-xs text-ink-muted">{t('workflow.inspector.chooseAgentForDecisions')}</p>}
            {agent && ports.length === 0 && (
              <p className="text-xs text-ink-muted">{t('workflow.inspector.noDecisions')}</p>
            )}
            {ports.map((port) => (
              <div key={port.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate font-mono text-xs ${port.declared ? 'text-ink-secondary' : 'text-danger-fg'}`}>
                    <Trans t={t} i18nKey="workflow.inspector.whenDecides" values={{ decision: port.decision }} components={{ b: <span className="font-semibold" /> }} />
                  </span>
                  {!port.declared && <span className="shrink-0 text-[11px] text-danger-fg">{t('workflow.inspector.notDeclared')}</span>}
                </div>
                <GotoSelect
                  value={port.goto === NEXT ? '' : port.goto || ''}
                  onChange={(goto) => onChange({ transitions: setBranch(stage, port.decision, goto).transitions })}
                  targets={targets}
                  disabled={readOnly}
                  allowContinue
                  label={t('workflow.inspector.whereDecisionGoes', { decision: port.decision })}
                />
              </div>
            ))}
          </>
        ) : (
          <>
            {stage.transitions.length === 0 && (
              <p className="text-xs text-ink-muted">{t('workflow.inspector.noOutcomes')}</p>
            )}
            {stage.transitions.map((transition, i) => (
              <div key={i} className="space-y-1 rounded-lg border border-line-subtle p-2">
                <div className="flex items-center gap-1.5">
                  <input
                    value={transition.when_decision}
                    onChange={(event) => setTransition(i, { when_decision: suggestCode(event.target.value, 'd') })}
                    readOnly={readOnly}
                    placeholder={t('workflow.inspector.outcomePlaceholder')}
                    aria-label={t('workflow.inspector.outcome')}
                    className={`${fieldClass} py-1.5 font-mono text-[13px]`}
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onChange({ transitions: stage.transitions.filter((_, j) => j !== i) })}
                      aria-label={t('workflow.inspector.removeOutcome')}
                      className="shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-hover hover:text-danger-fg"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <GotoSelect
                  value={transition.goto}
                  onChange={(goto) => setTransition(i, { goto })}
                  targets={targets}
                  disabled={readOnly}
                  label={t('workflow.inspector.whereOutcomeGoes')}
                />
              </div>
            ))}
            {!readOnly && (
              <button
                type="button"
                onClick={() => onChange({ transitions: [...stage.transitions, { when_decision: '', goto: END }] })}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent-soft"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {t('workflow.inspector.addOutcome')}
              </button>
            )}
          </>
        )}
        {!isSummarizer && !readOnly && (isAgent ? ports.length > 0 : true) && (
          <p className="text-[11px] text-ink-subtle">{t('workflow.inspector.dragHint')}</p>
        )}
      </Section>

      <Section title={t('workflow.inspector.options')}>
        <Switch
          label={t('workflow.inspector.optionalStep')}
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
  const { t } = useTranslation('admin');
  const humanSteps = stages.filter((s) => s.executor_type === EXECUTOR_HUMAN).length;
  const branches = stages.reduce((n, s) => n + s.transitions.filter((tr) => tr.when_decision).length, 0);

  return (
    <Shell eyebrow={t('workflow.inspector.workflow')} title={name || t('workflow.inspector.untitled')} onClose={onClose}>
      <Section title={t('workflow.inspector.details')}>
        <Field label={t('workflow.inspector.name')}>
          <input value={name} readOnly={readOnly} onChange={(event) => onName(event.target.value)} className={fieldClass} />
        </Field>
        <Field label={t('workflow.inspector.description')}>
          <textarea
            value={description}
            readOnly={readOnly}
            rows={3}
            placeholder={t('workflow.inspector.descriptionPlaceholder')}
            onChange={(event) => onDescription(event.target.value)}
            className={`${fieldClass} resize-y`}
          />
        </Field>
      </Section>

      <Section title={t('workflow.inspector.checks')}>
        {problems.length === 0 && !blockedReason ? (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-success-fg">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t('workflow.inspector.ready')}
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
                    className="flex w-full items-start gap-1.5 rounded-lg bg-danger-soft px-2.5 py-2 text-start text-xs text-danger-fg enabled:hover:brightness-95"
                  >
                    <XCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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

      <Section title={t('workflow.inspector.properties')}>
        <div className="space-y-2">
          <Row label={t('workflow.inspector.status')}>{isCreate ? t('workflow.status.notSaved') : workflow?.is_active ? t('workflow.status.running') : t('workflow.status.standby')}</Row>
          {workflow?.version != null && <Row label={t('workflow.inspector.version')}>v{workflow.version}</Row>}
          <Row label={t('workflow.inspector.steps')}>{stages.length}</Row>
          <Row label={t('workflow.inspector.byPeople')}>{humanSteps}</Row>
          <Row label={t('workflow.inspector.branches')}>{branches}</Row>
        </div>
      </Section>

      <Section title={t('workflow.inspector.runSettings')}>
        <Switch
          label={t('workflow.inspector.useForNew')}
          description={
            isActive && activeOther && !workflow?.is_active
              ? t('workflow.inspector.oneAtATimeOther', { name: activeOther.name })
              : t('workflow.inspector.oneAtATime')
          }
          checked={isActive}
          disabled={readOnly}
          onChange={onActive}
        />
        <Field
          label={t('workflow.inspector.maxVisits')}
          hint={t('workflow.inspector.maxVisitsHint')}
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
