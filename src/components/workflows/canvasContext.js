// src/components/workflows/canvasContext.js
//
// Actions the canvas's nodes and edges can trigger. React Flow renders them
// from plain data, so callbacks travel by context rather than through `data`.
import { createContext, useContext } from 'react';

export const WorkflowCanvasContext = createContext({
  readOnly: true,
  insertAt: () => {},
});

export const useWorkflowCanvas = () => useContext(WorkflowCanvasContext);
