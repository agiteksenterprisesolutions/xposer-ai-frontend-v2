// src/hooks/useReportTypeNames.js
//
// The category shown for a report. Case lists don't carry the type's name, so
// it's looked up in the organization's report types — one shared, cached list
// (reportTypesAPI.typeIndex) rather than a fresh fetch per screen.
//
// Until that list arrives the name is unknown, not "AI Assistant": typeName()
// returns null so the screen can show a placeholder. "AI Assistant" is only
// for a report that genuinely has no type (filed through the AI assistant).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { reportTypesAPI } from '../api';

export const NO_TYPE_LABEL = 'AI Assistant';
export const UNKNOWN_TYPE_LABEL = 'Unknown type';

export function useReportTypeNames() {
  const [types, setTypes] = useState(null); // null while loading
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    reportTypesAPI
      .typeIndex()
      .then((list) => live && setTypes(Array.isArray(list) ? list : []))
      .catch(() => {
        if (!live) return;
        setTypes([]);
        setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const byId = useMemo(() => new Map((types || []).map((t) => [t.id, t])), [types]);
  const loaded = types !== null;

  /** The report's category, or null while it can't be known yet. */
  const typeName = useCallback(
    (report) => {
      if (report?.report_type_name) return report.report_type_name;
      if (!report?.report_type_id) return NO_TYPE_LABEL;
      const found = byId.get(report.report_type_id)?.name;
      if (found) return found;
      // A type that is gone, or a list that couldn't be loaded.
      return loaded ? UNKNOWN_TYPE_LABEL : null;
    },
    [byId, loaded],
  );

  return { types: types || [], loaded, failed, typeName };
}
