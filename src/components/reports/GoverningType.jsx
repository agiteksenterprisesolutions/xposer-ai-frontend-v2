// src/components/reports/GoverningType.jsx
//
// The report type that governs a case — for an AI report, the type the
// assistant matched the conversation to (governing_report_type_*), not the
// placeholder type the call was filed under. Shown as a link to that type,
// with a side-by-side of the type's questions and what the AI actually asked.
//
// The form compared is the version the AI was working from
// (matched_report_type_version), so a type edited since doesn't make the AI
// look like it skipped questions that didn't exist at the time.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, CircleDashed, ListChecks, MinusCircle, PlusCircle } from 'lucide-react';
import Modal from '../layout/Modal';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import { reportTypesAPI } from '../../api';
import { useCan } from '../../hooks/useCan';
import { useReportTypeNames } from '../../hooks/useReportTypeNames';
import { ACCESS } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { errorSummary } from '../../utils/errors';
import { formatAnswer } from '../../utils/reportAnswers';
import { buildVoiceAnswerRows, getVoiceAnswers } from '../../utils/questionSets';

/** The governing type's id, name, code and the form version that applies. */
export const governingTypeOf = (report) => {
  const id = report?.governing_report_type_id || report?.matched_report_type_id || null;
  if (!id) return null;
  const version =
    id === report.matched_report_type_id
      ? report.matched_report_type_version ?? null
      : id === report.report_type_id
        ? report.report_type_version ?? null
        : null;
  const name =
    report.governing_report_type_name ||
    (id === report.matched_report_type_id ? report.matched_report_type_name : null) ||
    null;
  return { id, version, name, code: report.governing_report_type_code || null };
};

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

const STATUS = {
  asked: { icon: CheckCircle2, className: 'text-success-fg', label: 'Asked' },
  declined: { icon: MinusCircle, className: 'text-warning-fg', label: 'Declined' },
  missing: { icon: CircleDashed, className: 'text-ink-subtle', label: 'Not asked' },
};

const Comparison = ({ report, governing }) => {
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    reportTypesAPI
      .formForReport({ report_type_id: governing.id, report_type_version: governing.version })
      .then((data) => live && setForm(data))
      .catch((err) => live && setError(errorSummary(err)));
    return () => {
      live = false;
    };
  }, [governing.id, governing.version]);

  if (error) return <p className="text-sm text-ink-muted">Couldn&apos;t load the report type. {error}</p>;
  if (!form) return <Skeleton.Lines size="sm" lines={8} />;

  const asked = new Map(buildVoiceAnswerRows(report).map((row) => [row.key, row]));
  const sections = [...(form.sections || [])].sort(byOrder).map((section) => ({
    ...section,
    questions: [...(section.questions || [])].sort(byOrder),
  }));
  const formKeys = new Set(sections.flatMap((s) => s.questions.map((q) => q.name)));
  const total = formKeys.size;
  const covered = [...formKeys].filter((key) => asked.has(key)).length;
  const extra = [...asked.values()].filter((row) => !formKeys.has(row.key));

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">
        The AI covered <span className="font-semibold text-ink">{covered} of {total}</span> questions on this form
        {governing.version != null && <> (version {governing.version}, the one it worked from)</>}.
        {extra.length > 0 && <> It also asked {extra.length} that {extra.length === 1 ? "isn't" : "aren't"} on the form.</>}
      </p>

      {sections.map((section, s) => (
        <section key={section.id || s} className="rounded-xl border border-line">
          <h4 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
            {section.title || `Step ${s + 1}`}
          </h4>
          <ul className="divide-y divide-line-subtle">
            {section.questions.map((question) => {
              const row = asked.get(question.name);
              const state = !row ? 'missing' : row.skipped ? 'declined' : 'asked';
              const { icon: Icon, className, label } = STATUS[state];
              return (
                <li key={question.id || question.name} className="flex gap-3 px-4 py-2.5">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-label={label} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      {question.label || question.name}
                      {question.required && <span className="text-danger-fg"> *</span>}
                    </p>
                    {state === 'asked' ? (
                      <p className="mt-0.5 wrap-break-word text-xs text-ink-secondary">
                        {formatAnswer(row.answer, question)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {extra.length > 0 && (
        <section className="rounded-xl border border-line">
          <h4 className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
            <PlusCircle className="h-4 w-4 text-ink-muted" /> Asked, but not on the form
          </h4>
          <ul className="divide-y divide-line-subtle">
            {extra.map((row) => (
              <li key={row.key} className="px-4 py-2.5">
                <p className="text-sm text-ink">{row.label}</p>
                <p className="mt-0.5 wrap-break-word text-xs text-ink-secondary">
                  {row.skipped ? 'Declined' : formatAnswer(row.answer)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

/** The "Report type" row for the case sidebar. Nothing when there's no governing type. */
const GoverningType = ({ report, orgSlug }) => {
  const can = useCan();
  const { types } = useReportTypeNames();
  const [comparing, setComparing] = useState(false);
  const governing = governingTypeOf(report);
  if (!governing) return null;

  const known = types.find((t) => t.id === governing.id);
  const name = governing.name || known?.name || null;
  const code = governing.code || known?.code || null;
  // Editors open the builder; anyone else who can see types gets the read-only view.
  const href = can(ACCESS.reportTypesManage)
    ? staffPath(orgSlug, `report-types/${governing.id}`)
    : can(ACCESS.reportTypes)
      ? staffPath(orgSlug, `report-types/${governing.id}/view`)
      : null;
  const hasAiAnswers = getVoiceAnswers(report).length > 0;

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-ink-muted uppercase">
        {hasAiAnswers ? 'Matched report type' : 'Report type'}
      </p>
      {name ? (
        href ? (
          <Link to={href} className="group inline-flex items-start gap-1 text-sm font-medium text-link hover:underline">
            <span className="wrap-break-word">{name}</span>
            <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          <p className="text-sm font-medium text-ink wrap-break-word">{name}</p>
        )
      ) : (
        <Skeleton.Text className="w-36" />
      )}
      {(code || governing.version != null) && (
        <p className="text-xs text-ink-muted">
          {code && <span className="font-mono">{code}</span>}
          {code && governing.version != null && ' · '}
          {governing.version != null && `version ${governing.version}`}
        </p>
      )}
      {hasAiAnswers && (
        <Button variant="secondary" size="small" startIcon={ListChecks} className="mt-2" onClick={() => setComparing(true)}>
          Compare with form
        </Button>
      )}

      <Modal
        isOpen={comparing}
        onClose={() => setComparing(false)}
        size="large"
        title={name ? `${name}: what the AI asked` : 'What the AI asked'}
      >
        {comparing && <Comparison report={report} governing={governing} />}
      </Modal>
    </div>
  );
};

export default GoverningType;
