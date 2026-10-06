// src/utils/workflowLayout.js
//
// Where the workflow builder's nodes sit on the canvas.
//
// The API stores a workflow as an ordered list of stages and nothing about
// how it was drawn, so an arrangement is remembered per browser, keyed by
// each stage's key. A workflow with no remembered arrangement — a new
// browser, a colleague's machine — is laid out in stage order, top to bottom
// or left to right depending on the builder's orientation.

export const START_ID = '__start';
export const END_ID = '__end';

export const STAGE_WIDTH = 288;
export const TERMINAL_WIDTH = 176;
export const TERMINAL_HEIGHT = 40;
export const LAYOUT_GAP = 72;
export const ROW_GAP = 96;

export const VERTICAL = 'vertical';
export const HORIZONTAL = 'horizontal';

/** Where the run-order connectors sit on a step when it runs left to right: level with its header. */
export const STAGE_HEADER_CENTER = 34;

const HEADER_HEIGHT = 74;
const PORT_HEIGHT = 30;
const PORTS_PADDING = 12;

/** A stage node's height before the browser has measured it. */
export const estimateStageHeight = (portCount) =>
  HEADER_HEIGHT + (portCount > 0 ? portCount * PORT_HEIGHT + PORTS_PADDING : 0);

/**
 * One centred column, in order.
 * @param {{ id: string, width: number, height: number }[]} items start, stages…, end
 */
export const columnLayout = (items, origin = { x: 0, y: 0 }) => {
  const positions = {};
  let y = origin.y;
  items.forEach((item) => {
    positions[item.id] = { x: origin.x - item.width / 2, y };
    y += item.height + LAYOUT_GAP;
  });
  return positions;
};

/**
 * One row, in order, with every step's header on the same line so the
 * run-order line between them is straight.
 */
export const rowLayout = (items, origin = { x: 0, y: 0 }) => {
  const positions = {};
  let x = origin.x;
  items.forEach((item) => {
    const isTerminal = item.id === START_ID || item.id === END_ID;
    positions[item.id] = { x, y: origin.y + (isTerminal ? STAGE_HEADER_CENTER - TERMINAL_HEIGHT / 2 : 0) };
    x += item.width + ROW_GAP;
  });
  return positions;
};

export const layoutFor = (orientation, items) =>
  orientation === HORIZONTAL ? rowLayout(items) : columnLayout(items);

const ORIENTATION_KEY = 'xposer_workflow_orientation';

/** The builder's orientation, remembered per browser. */
export const loadOrientation = () => {
  try {
    return localStorage.getItem(ORIENTATION_KEY) === HORIZONTAL ? HORIZONTAL : VERTICAL;
  } catch {
    return VERTICAL;
  }
};

export const saveOrientation = (orientation) => {
  try {
    localStorage.setItem(ORIENTATION_KEY, orientation);
  } catch {
    // Not remembered; the default applies next time.
  }
};

const storageKey = (workflowId) => `xposer_workflow_layout_${workflowId}`;

/** The remembered arrangement as `{ orientation, [START_ID], [END_ID], stages: { key: {x, y} } }`, or null. */
export const loadLayout = (workflowId) => {
  if (!workflowId) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(workflowId)) || 'null');
    return saved && typeof saved === 'object' && saved.stages ? saved : null;
  } catch {
    return null;
  }
};

export const saveLayout = (workflowId, stages, positions, orientation = VERTICAL) => {
  if (!workflowId) return;
  try {
    const byKey = {};
    stages.forEach((stage) => {
      if (stage.key && positions[stage._id]) byKey[stage.key] = positions[stage._id];
    });
    localStorage.setItem(
      storageKey(workflowId),
      JSON.stringify({ orientation, [START_ID]: positions[START_ID], [END_ID]: positions[END_ID], stages: byKey }),
    );
  } catch {
    // Private mode or a full quota: the arrangement just isn't remembered.
  }
};
