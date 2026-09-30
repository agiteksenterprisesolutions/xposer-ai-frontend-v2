// src/components/agents/AgentPills.jsx
//
// One small pill per agent for a run row. Three states, and the difference
// matters: the agent acted, the step was routed to a human by the org's
// orchestration mode, or the agent never ran at all (a null entry).
import { AGENT_TYPES, AGENT_LABELS, isManualAction } from '../../utils/agents';

const STATE_CLASSES = {
  ran: 'bg-success-soft border-success-line text-success-fg',
  manual: 'bg-warning-soft border-warning-line text-warning-fg',
  skipped: 'bg-subtle border-line-subtle text-ink-subtle',
};

const stateOf = (action) => {
  if (action == null) return 'skipped';
  return isManualAction(action) ? 'manual' : 'ran';
};

const STATE_TITLES = {
  ran: 'Completed by the AI agent',
  manual: 'Routed to a human by your orchestration mode',
  skipped: 'Did not run',
};

const AgentPills = ({ agents = {}, className = '' }) => (
  <div className={`flex flex-wrap gap-1 ${className}`}>
    {AGENT_TYPES.map((type) => {
      const state = stateOf(agents[type]);
      return (
        <span
          key={type}
          title={`${AGENT_LABELS[type]} — ${STATE_TITLES[state]}`}
          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.03em] ${STATE_CLASSES[state]}`}
        >
          {AGENT_LABELS[type].slice(0, 3)}
        </span>
      );
    })}
  </div>
);

export default AgentPills;
