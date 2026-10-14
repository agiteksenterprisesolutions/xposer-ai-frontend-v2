// src/hooks/useReportTypeNames.js
//
// The category shown for a report. Case lists don't carry the type's name, so
// it's looked up in the organization's report types — one shared, cached list
// (reportTypesAPI.typeIndex) rather than a fresh fetch per screen.
//
// Until that list arrives the name is unknown, not "AI Assistant": typeName()
// returns null so the screen can show a placeholder. Once it has arrived,
// a report whose type isn't a report type reads "AI Assistant": reports filed
// through the AI voice assistant carry no type, or a placeholder type id that
// matches no report type (GET /report-types/{id} is a 404 for it). Every
// screen and every role gets the same label from here.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { reportTypesAPI } from '../api';

export const NO_TYPE_LABEL = 'AI Assistant';

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
      if (!loaded) return null;
      // The list couldn't be loaded: don't call a typed report something it isn't.
      if (failed) return '—';
      return NO_TYPE_LABEL;
    },
    [byId, loaded, failed],
  );

  /**
   * The same rule for a category in a chart or a count, which carries a type
   * id and the server's own name for it. The server names the AI assistant's
   * placeholder type ("Flexible Reporting"), but it isn't a report type, so it
   * reads "AI Assistant" here as it does in every list. Null while loading.
   */
  const categoryFor = useCallback(
    (typeId, serverName) => {
      if (!typeId) return NO_TYPE_LABEL;
      const found = byId.get(typeId)?.name;
      if (found) return found;
      if (!loaded) return null;
      if (failed) return serverName || '—';
      return NO_TYPE_LABEL;
    },
    [byId, loaded, failed],
  );

  return { types: types || [], loaded, failed, typeName, categoryFor };
}
