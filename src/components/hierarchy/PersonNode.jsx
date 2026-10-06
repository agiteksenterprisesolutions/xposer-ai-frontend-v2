// src/components/hierarchy/PersonNode.jsx
//
// One person on the org chart. The badge under the card folds their team
// away or opens it again; dragging the card onto someone else (for anyone
// who can manage the hierarchy) proposes that person as their new manager.
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { PERSON_HEIGHT, PERSON_WIDTH } from '../../utils/orgChart';
import { useOrgChart } from './orgChartContext';

const hidden = { opacity: 0, width: 1, height: 1, minWidth: 0, minHeight: 0, border: 0 };

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

const PersonNode = ({ id, data, selected }) => {
  const { toggle } = useOrgChart();
  const { member, levelTitle, flags, reports, descendants, collapsed, drop, dimmed } = data;

  const frame =
    drop === 'valid'
      ? 'border-success-line ring-2 ring-success-line'
      : drop === 'invalid'
        ? 'border-danger-line ring-2 ring-danger-line'
        : selected
          ? 'border-line-accent ring-2 ring-accent-ring'
          : flags.length
            ? 'border-warning-line hover:border-line-strong'
            : 'border-line hover:border-line-strong';

  return (
    <div
      style={{ width: PERSON_WIDTH, height: PERSON_HEIGHT }}
      className={`relative flex flex-col justify-between rounded-xl border bg-surface px-3 py-2.5 shadow-sm transition-[border-color,box-shadow,opacity] ${frame} ${
        dimmed ? 'opacity-35' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} style={hidden} />

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-fg">
          {initials(member.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink" title={member.name}>
            {member.name}
          </p>
          <p className="truncate text-xs text-ink-muted" title={member.designation || ''}>
            {[member.designation, member.department].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2">
        {levelTitle ? (
          <span className="truncate rounded-md bg-active px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">{levelTitle}</span>
        ) : (
          <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-[11px] font-medium text-warning-fg">No level</span>
        )}
        {flags.filter((f) => f !== 'no_level').length > 0 && (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-fg" aria-label="Needs attention" />
        )}
      </div>

      {reports > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggle(id);
          }}
          title={collapsed ? `Show ${descendants} under ${member.name}` : 'Fold this team away'}
          aria-label={collapsed ? `Show ${member.name}'s team` : `Hide ${member.name}'s team`}
          className="nodrag absolute -bottom-3 left-1/2 flex h-6 -translate-x-1/2 items-center gap-0.5 rounded-full border border-line-strong bg-surface px-2 text-[11px] font-semibold text-ink-muted shadow-sm transition-colors hover:border-line-accent hover:text-accent-fg"
        >
          {collapsed ? (
            <>
              {descendants}
              <ChevronDown className="h-3 w-3" />
            </>
          ) : (
            <>
              {reports}
              <ChevronUp className="h-3 w-3" />
            </>
          )}
        </button>
      )}

      <Handle type="source" position={Position.Bottom} isConnectable={false} style={hidden} />
    </div>
  );
};

export default memo(PersonNode);
