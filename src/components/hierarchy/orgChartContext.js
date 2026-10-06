// src/components/hierarchy/orgChartContext.js
import { createContext, useContext } from 'react';

export const OrgChartContext = createContext({ toggle: () => {} });

export const useOrgChart = () => useContext(OrgChartContext);
