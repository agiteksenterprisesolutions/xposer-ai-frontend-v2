// src/components/agents/AgentAssignmentPicker.jsx
//
// Which agents may use a knowledge-base document. "Every consulting agent" is
// stored as the sentinel ("*") and follows the organization as agents are
// added or lose the capability; picking agents by name pins the document to
// exactly those.
import { Checkbox } from '../roles/PermissionPicker';
import RoleCheckboxGroup from './RoleCheckboxGroup';

export const DEFAULT_SENTINEL = '*';

/** True when a stored assignment means "every consulting agent". */
export const isAllAgents = (roles, sentinel = DEFAULT_SENTINEL) =>
  Array.isArray(roles) && roles.includes(sentinel);

const AgentAssignmentPicker = ({ agents = [], sentinel = DEFAULT_SENTINEL, value = [], onChange, disabled = false }) => {
  const all = isAllAgents(value, sentinel);
  const labels = Object.fromEntries(agents.map((agent) => [agent.code, agent.name]));
  const codes = agents.map((agent) => agent.code);

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3">
        <Checkbox
          checked={all}
          disabled={disabled}
          onChange={() => onChange(all ? codes : [sentinel])}
          labelledBy="kb-all-agents"
        />
        <span>
          <span id="kb-all-agents" className="block text-sm font-medium text-ink">
            Every agent that can consult the knowledge base
          </span>
          <span className="block text-xs text-ink-muted">
            Includes agents given the capability later. Untick to choose specific agents.
          </span>
        </span>
      </label>

      {!all && (
        <>
          <RoleCheckboxGroup
            roles={codes}
            labels={labels}
            selected={value.filter((code) => code !== sentinel)}
            onChange={onChange}
            disabled={disabled}
          />
          {value.length === 0 && (
            <p className="text-xs text-warning-fg">With no agent selected, the document is stored but never used.</p>
          )}
        </>
      )}
    </div>
  );
};

export default AgentAssignmentPicker;
