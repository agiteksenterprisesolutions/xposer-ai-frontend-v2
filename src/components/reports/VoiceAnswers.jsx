// src/components/reports/VoiceAnswers.jsx
//
// The answers the voice agent collected, in the order it asked.
//
// Every label and type here comes from the report's own `question_set` — the
// copy captured when it was submitted — joined to `voice_answers` on key.
// Never from the live question set: a report filed in March must keep showing
// March's wording after the admin rewords the question in July, and reading
// the current config would attribute an answer to a question nobody was asked.
//
// That snapshot is also what makes the console free of warnings. Renaming a
// question cannot damage a filed report, because the filed report is not
// looking at the question any more.
//
// Reports filed before snapshots existed carry the question and type inline on
// each answer, which is what the join falls back to.
import { MessageSquareOff, Mic } from 'lucide-react';
import {
  CHOICE_TYPES,
  buildVoiceAnswerRows,
  formatVoiceAnswer,
  getVoiceAnswers,
} from '../../utils/questionSets';

const Chips = ({ values }) => (
  <div className="flex flex-wrap gap-1.5">
    {values.map((item, index) => (
      <span
        key={`${item}-${index}`}
        className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs text-ink"
      >
        {String(item)}
      </span>
    ))}
  </div>
);

const VoiceAnswers = ({ report, title = 'Answers from the call', className = '' }) => {
  const answers = getVoiceAnswers(report);
  const version = report?.question_set?.version ?? report?.question_set_version ?? null;

  if (!answers.length) return null;

  const rows = buildVoiceAnswerRows(report);

  return (
    <div className={className}>
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Mic className="h-4 w-4 text-accent-fg" />
        {title}
      </h4>

      <dl className="space-y-3">
        {rows.map((row, index) => {
          // The answer is a string, an array, a bool or a number depending on
          // the type it was collected as — formatVoiceAnswer flattens all of it.
          const value = formatVoiceAnswer(row.answer);
          const asChips = CHOICE_TYPES.includes(row.type) || Array.isArray(row.answer);

          return (
            <div
              key={row.key || index}
              className="rounded-lg border border-line-subtle bg-subtle p-3"
            >
              <dt className="text-xs font-medium text-ink-muted">{row.label}</dt>
              <dd className="mt-1 min-w-0">
                {row.skipped || value === null ? (
                  <span className="inline-flex items-center gap-1.5 text-sm italic text-ink-subtle">
                    <MessageSquareOff className="h-3.5 w-3.5 shrink-0" />
                    {/* Asked and refused is not the same as never asked. */}
                    {row.skipped ? 'Declined to answer' : 'Not answered'}
                  </span>
                ) : asChips ? (
                  <Chips values={Array.isArray(row.answer) ? row.answer : [row.answer]} />
                ) : (
                  <p className="whitespace-pre-wrap wrap-break-word text-sm text-ink">{value}</p>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* The first thing anyone wants when two reports disagree about what
          was asked. */}
      {version > 0 && (
        <p className="mt-2 text-xs text-ink-subtle">Collected under question set v{version}</p>
      )}
    </div>
  );
};

export default VoiceAnswers;
