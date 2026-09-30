// src/components/agents/RoleCheckboxGroup.jsx
//
// Which agents may read a knowledge-base document. The role list comes from
// GET /agent-kb/roles rather than a hardcoded array — the backend owns it, and
// there is deliberately no "summarizer" role because that agent works from the
// report's own attachments instead of organization policy.
import { Check } from 'lucide-react';
import { formatRoleLabel } from '../../utils/agents';

const RoleCheckboxGroup = ({
  roles = [],
  selected = [],
  onChange,
  disabled = false,
  className = '',
  // code → display name; agents are organization-defined, so their names
  // come from the API rather than from the code.
  labels = {},
}) => {
  const toggle = (role) => {
    if (disabled) return;
    onChange(
      selected.includes(role)
        ? selected.filter((r) => r !== role)
        : [...selected, role]
    );
  };

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {roles.map((role) => {
        const isSelected = selected.includes(role);
        return (
          <button
            key={role}
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => toggle(role)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? 'bg-accent-soft border-line-accent text-accent-fg'
                : 'bg-subtle border-line text-ink-muted hover:text-ink hover:border-line-strong'
            }`}
          >
            <span
              className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
                isSelected ? 'bg-accent border-accent text-on-accent' : 'border-line-strong'
              }`}
            >
              {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            {labels[role] || formatRoleLabel(role)}
          </button>
        );
      })}
    </div>
  );
};

export default RoleCheckboxGroup;
