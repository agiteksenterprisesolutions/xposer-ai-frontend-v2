// src/hooks/useReportForm.js
//
// The form a report was filled in against — its pinned version, or the type's
// current form for reports from before versioning — for labelling, ordering
// and option-labelling its answers. `form` is undefined while loading and null
// when there is none (no type, or it couldn't be fetched): answers then show
// under their keys.
import { useEffect, useState } from 'react';
import { reportTypesAPI, reportTypeVersionOf } from '../api/reportTypes';

export function useReportForm(report) {
  // POST /reports/track already returns the report's own version inline.
  const inline = report?.report_type?.sections ? report.report_type : null;
  const { id, version } = reportTypeVersionOf(report);
  const [form, setForm] = useState(undefined);

  useEffect(() => {
    if (inline) return undefined;
    if (!id) {
      setForm(null);
      return undefined;
    }
    let live = true;
    setForm(undefined);
    reportTypesAPI
      .formForReport({ report_type_id: id, report_type_version: version })
      .then((data) => live && setForm(data || null))
      .catch(() => live && setForm(null));
    return () => {
      live = false;
    };
  }, [inline, id, version]);

  return inline || form;
}
