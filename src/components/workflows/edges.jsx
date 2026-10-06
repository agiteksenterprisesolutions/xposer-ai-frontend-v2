// src/components/workflows/edges.jsx
//
// The two kinds of line on the workflow canvas.
//
//   Spine  — solid, from each step to the one after it. This is the order the
//            steps run in, and where a step with no matching rule continues.
//   Branch — dashed and accented, from one outcome of a step to wherever that
//            outcome sends the report. It travels along a lane outside every
//            node — to the right of a top-to-bottom flow, below a
//            left-to-right one — so a jump forwards or backwards never cuts
//            across the steps in between.
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { useWorkflowCanvas } from './canvasContext';

export const SpineEdge = ({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }) => {
  const { readOnly, insertAt } = useWorkflowCanvas();
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 14,
  });

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={{ stroke: 'var(--color-line-strong)', strokeWidth: 1.5 }} />
      {!readOnly && (
        <EdgeLabelRenderer>
          <button
            type="button"
            onClick={() => insertAt(data.index)}
            aria-label="Add a step here"
            title="Add a step here"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
            className="nodrag nopan absolute flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-surface text-ink-muted shadow-sm transition-colors hover:border-line-accent hover:bg-accent hover:text-on-accent"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

const RADIUS = 12;

/** Out to the lane, along it, and back in — with rounded corners. */
const lanePath = (sx, sy, tx, ty, laneX) => {
  const x = Math.max(laneX, sx + 2 * RADIUS, tx + 2 * RADIUS);
  const distance = Math.abs(ty - sy);
  if (distance < 1) return `M ${sx} ${sy} L ${tx} ${ty}`;
  const r = Math.min(RADIUS, distance / 2);
  const dir = ty > sy ? 1 : -1;
  return [
    `M ${sx} ${sy}`,
    `L ${x - r} ${sy}`,
    `Q ${x} ${sy} ${x} ${sy + dir * r}`,
    `L ${x} ${ty - dir * r}`,
    `Q ${x} ${ty} ${x - r} ${ty}`,
    `L ${tx} ${ty}`,
  ].join(' ');
};

/** Out of the outcome, down to the lane beneath the row, along it, and up into the target. */
const lanePathBelow = (sx, sy, tx, ty, laneY) => {
  const y = Math.max(laneY, sy + 2 * RADIUS, ty + 2 * RADIUS);
  const x = sx + 2 * RADIUS; // step clear of the node before turning
  const r = RADIUS;
  const run = tx - x;
  if (Math.abs(run) < 2 * r) {
    return `M ${sx} ${sy} L ${x - r} ${sy} Q ${x} ${sy} ${x} ${sy + r} L ${x} ${y} L ${tx} ${y} L ${tx} ${ty}`;
  }
  const dir = run > 0 ? 1 : -1;
  return [
    `M ${sx} ${sy}`,
    `L ${x - r} ${sy}`,
    `Q ${x} ${sy} ${x} ${sy + r}`,
    `L ${x} ${y - r}`,
    `Q ${x} ${y} ${x + dir * r} ${y}`,
    `L ${tx - dir * r} ${y}`,
    `Q ${tx} ${y} ${tx} ${y - r}`,
    `L ${tx} ${ty}`,
  ].join(' ');
};

export const BranchEdge = ({ sourceX, sourceY, targetX, targetY, markerEnd, selected, data }) => (
  <BaseEdge
    path={
      data?.laneY != null
        ? lanePathBelow(sourceX, sourceY, targetX, targetY, data.laneY)
        : lanePath(sourceX, sourceY, targetX, targetY, data?.laneX ?? sourceX + 48)
    }
    markerEnd={markerEnd}
    interactionWidth={18}
    style={{
      stroke: 'var(--color-accent)',
      strokeWidth: selected ? 2.5 : 1.5,
      strokeDasharray: selected ? undefined : '6 4',
    }}
  />
);

export const edgeTypes = { spine: SpineEdge, branch: BranchEdge };
