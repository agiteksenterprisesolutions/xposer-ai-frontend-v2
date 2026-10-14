// src/components/hierarchy/orgChartContext.js
import { createContext, useContext } from 'react';

export const OrgChartContext = createContext({ toggle: () => {}, loadMore: () => {} });

export const useOrgChart = () => useContext(OrgChartContext);
