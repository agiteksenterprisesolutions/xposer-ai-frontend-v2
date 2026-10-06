// src/components/workflows/TerminalNode.jsx
//
// The two fixed ends of every workflow: a report arriving, and the run ending.
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Flag, Inbox } from 'lucide-react';
import { TERMINAL_HEIGHT, TERMINAL_WIDTH } from '../../utils/workflowLayout';

const dot = {
  width: 11,
  height: 11,
  background: 'var(--color-line-strong)',
  border: '2px solid var(--color-surface)',
  boxShadow: '0 0 0 1px var(--color-line-strong)',
};

const TerminalNode = ({ data }) => {
  const isStart = data.kind === 'start';
  const { horizontal } = data;
  const Icon = isStart ? Inbox : Flag;
  return (
    <div
      style={{ width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT }}
      className={`flex items-center justify-center gap-2 rounded-full border text-sm font-semibold shadow-sm ${
        isStart ? 'border-line-accent bg-accent-soft text-accent-fg' : 'border-line bg-surface text-ink-muted'
      }`}
    >
      <Icon className="h-4 w-4" />
      {isStart ? 'Report submitted' : 'End of workflow'}
      {isStart ? (
        <Handle
          type="source"
          id="next"
          position={horizontal ? Position.Right : Position.Bottom}
          isConnectable={!data.readOnly}
          style={dot}
        />
      ) : (
        <>
          <Handle type="target" id="in" position={horizontal ? Position.Left : Position.Top} style={dot} />
          <Handle
            type="target"
            id="branch-in"
            position={horizontal ? Position.Bottom : Position.Right}
            style={{ ...dot, opacity: 0 }}
          />
        </>
      )}
    </div>
  );
};

export default memo(TerminalNode);
