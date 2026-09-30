// src/components/workflows/StageCard.jsx
//
// One stage of a workflow. Branch rules pick from the executing agent's own
// decisions — never free text — because a rule on a verdict the agent never
// returns can't fire. Anything without a rule falls through to the next stage,
// so only the interesting branches need writing down.
import { ArrowDown, ArrowUp, Bot, CornerDownRight, Plus, Trash2, UserRound, X, XCircle } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import { Checkbox } from '../roles/PermissionPicker';
import { suggestCode } from '../../utils/codes';
import { AGENT_KIND_INFO } from '../../utils/agents';
import { END, EXECUTOR_AGENT, EXECUTOR_HUMAN, NEXT } from '../../utils/workflows';

const selectClass =
  'w-full rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink hover:border-line-strong disabled:opacity-60';

const StageCard = ({
  stage,
  index,
  total,
  stages,
  agentsByCode,
  agents,
  roles,
  problems = [],
  readOnly,
  onChange,
  onMove,
  onRemove,
}) => {
  const isAgent = stage.executor_type === EXECUTOR_AGENT;
  const agent = isAgent ? agentsByCode.get(stage.executor_ref) : null;
  const isSummarizer = agent?.kind === 'summarizer';
  const decisions = agent?.decisions || [];
  const used = new Set(stage.transitions.map((t) => t.when_decision));
  const unusedDecisions = decisions.filter((d) => !used.has(d));
  const targets = stages.filter((s) => s._id !== stage._id && s.key);
  const canBranch = !readOnly && !isSummarizer && (isAgent ? unusedDecisions.length > 0 : true);

  const setTransition = (i, patch) =>
    onChange({ transitions: stage.transitions.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  const addTransition = () =>
    onChange({
      transitions: [...stage.transitions, { when_decision: isAgent ? unusedDecisions[0] : '', goto: END }],
    });

  return (
    <div className={`rounded-xl border bg-surface ${problems.length ? 'border-danger-line' : 'border-line'}`}>
      <div className="flex items-start gap-3 border-b border-line-subtle px-4 py-3">
        <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-fg">
          {index + 1}
        </span>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <Input
            label="Stage name"
            value={stage.name}
            readOnly={readOnly}
            onChange={(event) => {
              const name = event.target.value;
              onChange(stage._autoKey ? { name, key: suggestCode(name, 'stage') } : { name });
            }}
            placeholder="e.g. Triage"
          />
          <Input
            label="Key"
            value={stage.key}
            readOnly={readOnly}
            onChange={(event) => onChange({ key: event.target.value, _autoKey: false })}
            className="font-mono"
            helperText="Branches point at this. Renaming it updates them."
          />
        </div>
        {!readOnly && (
          <div className="flex shrink-0 flex-col gap-1">
            <Button variant="ghost" size="small" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move stage up">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="small" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move stage down">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="small" onClick={onRemove} aria-label="Remove stage">
              <Trash2 className="h-3.5 w-3.5 text-danger-fg" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Executor */}
        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
          <div className="inline-flex rounded-lg border border-line p-0.5" role="radiogroup" aria-label="Who runs this stage">
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
                onClick={() => onChange({ executor_type: value, executor_ref: '', transitions: [] })}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  stage.executor_type === value ? 'bg-accent-soft text-accent-fg' : 'text-ink-muted hover:bg-hover hover:text-ink'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <select
            value={stage.executor_ref}
            onChange={(event) => onChange({ executor_ref: event.target.value, transitions: [] })}
            disabled={readOnly}
            aria-label={isAgent ? 'Agent' : 'Role'}
            className={selectClass}
          >
            <option value="">{isAgent ? 'Choose an agent…' : 'Choose a role…'}</option>
            {isAgent
              ? agents.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.name} — {AGENT_KIND_INFO[a.kind]?.label || a.kind}
                    {a.is_active === false ? ' (inactive)' : ''}
                  </option>
                ))
              : roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
            {stage.executor_ref &&
              (isAgent ? !agentsByCode.has(stage.executor_ref) : !roles.some((r) => r.code === stage.executor_ref)) && (
                <option value={stage.executor_ref}>{stage.executor_ref} (not found)</option>
              )}
          </select>
        </div>

        {!isAgent && stage.executor_ref && (
          <p className="text-xs text-ink-muted">The run pauses here until someone with this role acts on the report.</p>
        )}
        {agent?.is_active === false && (
          <p className="text-xs text-warning-fg">This agent is inactive, so the stage won't run until it is reactivated.</p>
        )}

        {/* Branches */}
        {isSummarizer ? (
          <p className="text-xs text-ink-muted">
            A summarizer reaches no decision, so this stage always continues to the next one. It runs only while the
            summarizer is switched on.
          </p>
        ) : (
          (isAgent ? stage.executor_ref : true) && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-ink-secondary">Branches</p>
              {stage.transitions.length === 0 && (
                <p className="text-xs text-ink-muted">No branches — every outcome continues to the next stage.</p>
              )}
              {stage.transitions.map((transition, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted">
                    <CornerDownRight className="h-3.5 w-3.5" />
                    When it decides
                  </span>
                  {isAgent ? (
                    <select
                      value={transition.when_decision}
                      onChange={(event) => setTransition(i, { when_decision: event.target.value })}
                      disabled={readOnly}
                      aria-label="Decision"
                      className={`${selectClass} font-mono sm:w-44`}
                    >
                      {[transition.when_decision, ...unusedDecisions]
                        .filter((d, j, all) => d && all.indexOf(d) === j)
                        .map((d) => (
                          <option key={d} value={d}>
                            {d}
                            {!decisions.includes(d) ? ' (not a decision of this agent)' : ''}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      value={transition.when_decision}
                      onChange={(event) => setTransition(i, { when_decision: suggestCode(event.target.value, 'd') })}
                      readOnly={readOnly}
                      placeholder="e.g. approve"
                      aria-label="Decision"
                      className={`${selectClass} font-mono sm:w-44`}
                    />
                  )}
                  <span className="shrink-0 text-xs text-ink-muted">go to</span>
                  <select
                    value={transition.goto}
                    onChange={(event) => setTransition(i, { goto: event.target.value })}
                    disabled={readOnly}
                    aria-label="Go to"
                    className={`${selectClass} sm:w-56`}
                  >
                    <option value={NEXT}>The next stage</option>
                    <option value={END}>End the run</option>
                    {targets.map((s) => (
                      <option key={s._id} value={s.key}>
                        {s.name || s.key}
                      </option>
                    ))}
                    {transition.goto && ![NEXT, END].includes(transition.goto) && !targets.some((s) => s.key === transition.goto) && (
                      <option value={transition.goto}>{transition.goto} (missing)</option>
                    )}
                  </select>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => onChange({ transitions: stage.transitions.filter((_, j) => j !== i) })}
                      aria-label="Remove branch"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {canBranch && (
                <Button variant="ghost" size="small" startIcon={Plus} onClick={addTransition}>
                  Add a branch
                </Button>
              )}
              {isAgent && agent && decisions.length === 0 && (
                <p className="text-xs text-ink-muted">
                  This agent declares no decisions, so there is nothing to branch on. Add some on the AI Agents page.
                </p>
              )}
              {isAgent && decisions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink-subtle">
                  Decisions:
                  {decisions.map((d) => (
                    <Badge key={d} size="small">
                      {d}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        <label className="flex items-start gap-3">
          <Checkbox
            checked={stage.optional}
            disabled={readOnly}
            onChange={() => onChange({ optional: !stage.optional })}
            labelledBy={`optional-${stage._id}`}
          />
          <span id={`optional-${stage._id}`} className="text-sm text-ink">
            Optional stage
          </span>
        </label>

        {problems.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-danger-soft px-3 py-2">
            {problems.map((problem, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-danger-fg">
                <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                {problem.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default StageCard;
