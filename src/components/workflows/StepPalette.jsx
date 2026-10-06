// src/components/workflows/StepPalette.jsx
//
// What a step can be run by: one of the organization's agents, or a person
// holding one of its roles. Click an entry to add it to the end of the
// workflow, or drag it onto the canvas to place it.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, GripVertical, PanelLeftClose, Plus, Search, UserRound } from 'lucide-react';
import { AGENT_KIND_INFO } from '../../utils/agents';
import { EXECUTOR_AGENT, EXECUTOR_HUMAN } from '../../utils/workflows';

export const STEP_DRAG_TYPE = 'application/x-xposer-workflow-step';

const Entry = ({ icon: Icon, tone, title, detail, step, onAdd }) => (
  <button
    type="button"
    draggable
    onDragStart={(event) => {
      event.dataTransfer.setData(STEP_DRAG_TYPE, JSON.stringify(step));
      event.dataTransfer.effectAllowed = 'copy';
    }}
    onClick={() => onAdd(step)}
    title="Click to add, or drag onto the canvas"
    className="group flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-left transition-colors hover:border-line-accent hover:bg-hover active:cursor-grabbing"
  >
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tone}`}>
      <Icon className="h-4 w-4" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium text-ink">{title}</span>
      <span className="block truncate text-[11px] text-ink-subtle">{detail}</span>
    </span>
    <GripVertical className="h-4 w-4 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />
  </button>
);

const Group = ({ title, count, children }) => (
  <section className="space-y-1.5">
    <h3 className="flex items-center justify-between px-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
      {title}
      <span className="tabular-nums">{count}</span>
    </h3>
    {children}
  </section>
);

const StepPalette = ({ agents, roles, onAdd, onClose, agentsPath, rolesPath }) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const matchingAgents = useMemo(
    () => agents.filter((a) => !q || a.name?.toLowerCase().includes(q) || a.code?.toLowerCase().includes(q)),
    [agents, q],
  );
  const matchingRoles = useMemo(
    () => roles.filter((r) => !q || r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q)),
    [roles, q],
  );

  return (
    <aside className="flex max-h-full w-64 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
      <header className="flex items-center justify-between border-b border-line-subtle px-3.5 py-3">
        <h2 className="text-sm font-semibold text-ink">Add a step</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide the step list"
          className="rounded-md p-1 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-line-subtle p-2.5">
        <label className="flex items-center gap-2 rounded-lg border border-line bg-subtle px-2.5 py-1.5 focus-within:border-line-accent">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents and roles"
            aria-label="Search agents and roles"
            className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle"
          />
        </label>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-2.5">
        <Group title="AI agents" count={matchingAgents.length}>
          {matchingAgents.map((agent) => (
            <Entry
              key={agent.code}
              icon={Bot}
              tone="bg-accent text-on-accent"
              title={agent.name}
              detail={`${AGENT_KIND_INFO[agent.kind]?.label || agent.kind}${agent.is_active === false ? ' · inactive' : ''}`}
              step={{ executor_type: EXECUTOR_AGENT, executor_ref: agent.code, label: agent.name }}
              onAdd={onAdd}
            />
          ))}
          {agents.length === 0 && (
            <p className="px-0.5 text-xs text-ink-muted">
              No agents yet.{' '}
              <Link to={agentsPath} className="font-medium text-link hover:underline">
                Create one
              </Link>
            </p>
          )}
          {agents.length > 0 && matchingAgents.length === 0 && <p className="px-0.5 text-xs text-ink-subtle">No match.</p>}
        </Group>

        <Group title="People" count={matchingRoles.length}>
          {matchingRoles.map((role) => (
            <Entry
              key={role.code}
              icon={UserRound}
              tone="bg-warning-soft text-warning-fg"
              title={role.name}
              detail="Anyone holding this role"
              step={{ executor_type: EXECUTOR_HUMAN, executor_ref: role.code, label: role.name }}
              onAdd={onAdd}
            />
          ))}
          {roles.length > 0 && matchingRoles.length === 0 && <p className="px-0.5 text-xs text-ink-subtle">No match.</p>}
        </Group>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-line-subtle px-3.5 py-2.5 text-xs">
        <Link to={agentsPath} className="font-medium text-link hover:underline">
          Manage agents
        </Link>
        <Link to={rolesPath} className="font-medium text-link hover:underline">
          Manage roles
        </Link>
      </footer>
    </aside>
  );
};

export const PaletteToggle = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-md transition-colors hover:border-line-accent hover:bg-hover"
  >
    <Plus className="h-4 w-4" />
    Add a step
  </button>
);

export default StepPalette;
