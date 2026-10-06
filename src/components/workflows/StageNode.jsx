// src/components/workflows/StageNode.jsx
//
// One step of a workflow on the canvas. The run-order connector (bottom, or
// right when the builder runs left to right) is "what happens next"; each
// outcome the step can reach has its own connector on the right, and an
// outcome with nothing attached simply continues to the next step.
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, ArrowRight, Bot, Flag, Plus, UserRound } from 'lucide-react';
import { EXECUTOR_HUMAN } from '../../utils/workflows';
import { STAGE_HEADER_CENTER, STAGE_WIDTH } from '../../utils/workflowLayout';

const dot = (color) => ({
  width: 11,
  height: 11,
  background: color,
  border: '2px solid var(--color-surface)',
  boxShadow: '0 0 0 1px var(--color-line-strong)',
});

export const NEW_OUTCOME_PORT = 'new';

const StageNode = ({ data, selected }) => {
  const { stage, index, executor, ports, problems, readOnly, horizontal } = data;
  const header = { top: STAGE_HEADER_CENTER };
  const isHuman = stage.executor_type === EXECUTOR_HUMAN;
  const Icon = isHuman ? UserRound : Bot;
  const hasProblems = problems.length > 0;
  const title = stage.name || executor.label || 'New step';

  const frame = hasProblems
    ? 'border-danger-line'
    : selected
      ? 'border-line-accent'
      : 'border-line hover:border-line-strong';

  return (
    <div
      style={{ width: STAGE_WIDTH }}
      className={`rounded-xl border bg-surface shadow-sm transition-[border-color,box-shadow] duration-150 ${frame} ${
        selected ? 'ring-2 ring-accent-ring shadow-md' : ''
      }`}
    >
      <Handle
        type="target"
        id="in"
        position={horizontal ? Position.Left : Position.Top}
        style={{ ...dot('var(--color-line-strong)'), ...(horizontal ? header : {}) }}
      />
      {/* Branches from other steps arrive here, clear of the outcome connectors. */}
      <Handle
        type="target"
        id="branch-in"
        position={horizontal ? Position.Bottom : Position.Right}
        style={{ ...dot('var(--color-accent)'), ...(horizontal ? {} : { top: 26 }), opacity: 0 }}
      />

      <div className="flex items-center gap-3 px-3.5 py-3.5">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            isHuman ? 'bg-warning-soft text-warning-fg' : 'bg-accent text-on-accent'
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
            Step {index + 1}
            <span aria-hidden="true">·</span>
            {executor.kindLabel}
            {stage.optional && <span className="rounded bg-active px-1 py-px normal-case tracking-normal">Optional</span>}
          </p>
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <p className={`truncate text-xs ${executor.warning ? 'text-warning-fg' : 'text-ink-muted'}`}>{executor.detail}</p>
        </div>
        {hasProblems && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger-fg"
            title={problems.map((p) => p.message).join('\n')}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {problems.length}
          </span>
        )}
      </div>

      {(ports.length > 0 || (isHuman && !readOnly)) && (
        <div className="border-t border-line-subtle py-1.5">
          {ports.map((port) => (
            <div key={port.id} className="relative flex h-[30px] items-center justify-between gap-2 pl-3.5 pr-5 text-xs">
              <span className={`truncate font-mono ${port.declared ? 'text-ink-secondary' : 'text-danger-fg'}`}>
                {port.decision || 'unnamed'}
              </span>
              <span className={`flex shrink-0 items-center gap-1 ${port.goto ? 'text-accent-fg' : 'text-ink-subtle'}`}>
                {port.isEnd ? <Flag className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                <span className="max-w-[7.5rem] truncate">{port.targetLabel}</span>
              </span>
              <Handle
                type="source"
                id={port.id}
                position={Position.Right}
                isConnectable={!readOnly}
                style={dot(port.goto ? 'var(--color-accent)' : 'var(--color-line-strong)')}
              />
            </div>
          ))}
          {isHuman && !readOnly && (
            <div className="relative flex h-[30px] items-center gap-1.5 pl-3.5 pr-5 text-xs text-ink-subtle">
              <Plus className="h-3 w-3" />
              Drag to add an outcome
              <Handle type="source" id={NEW_OUTCOME_PORT} position={Position.Right} style={dot('var(--color-line-strong)')} />
            </div>
          )}
        </div>
      )}

      <Handle
        type="source"
        id="next"
        position={horizontal ? Position.Right : Position.Bottom}
        isConnectable={!readOnly}
        style={{ ...dot('var(--color-line-strong)'), ...(horizontal ? header : {}) }}
      />
    </div>
  );
};

export default memo(StageNode);
