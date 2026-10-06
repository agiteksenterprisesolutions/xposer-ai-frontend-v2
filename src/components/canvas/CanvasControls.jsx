// src/components/canvas/CanvasControls.jsx
//
// The floating zoom bar shared by the canvas screens (workflow builder, org
// chart). Screen-specific buttons go before or after the zoom group.
import { Maximize, Minus, Plus } from 'lucide-react';
import { useReactFlow, useViewport } from '@xyflow/react';

export const canvasIconButton =
  'inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-hover hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent';

export const CanvasDivider = () => <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />;

const ZoomLevel = () => {
  const { zoom } = useViewport();
  return <span className="w-11 text-center text-xs font-medium tabular-nums text-ink-muted">{Math.round(zoom * 100)}%</span>;
};

const CanvasControls = ({ onFit, before, after, className = '' }) => {
  const flow = useReactFlow();
  return (
    <div
      className={`absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-line bg-surface p-1 shadow-md ${className}`}
    >
      {before}
      {before && <CanvasDivider />}
      <button type="button" onClick={() => flow.zoomOut({ duration: 150 })} aria-label="Zoom out" title="Zoom out" className={canvasIconButton}>
        <Minus className="h-4 w-4" />
      </button>
      <ZoomLevel />
      <button type="button" onClick={() => flow.zoomIn({ duration: 150 })} aria-label="Zoom in" title="Zoom in" className={canvasIconButton}>
        <Plus className="h-4 w-4" />
      </button>
      <CanvasDivider />
      <button type="button" onClick={onFit} aria-label="Fit to screen" title="Fit to screen" className={canvasIconButton}>
        <Maximize className="h-4 w-4" />
      </button>
      {after}
    </div>
  );
};

export default CanvasControls;
