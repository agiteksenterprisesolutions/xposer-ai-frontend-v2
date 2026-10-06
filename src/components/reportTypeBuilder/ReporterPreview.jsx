// src/components/reportTypeBuilder/ReporterPreview.jsx
//
// The form as a reporter meets it, one step at a time, in a phone or desktop
// frame. Inert: nothing is filled in, but Back / Continue page through the
// steps so the flow can be checked end to end.
import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import FieldPreview from './FieldPreview';
import { describeLogic } from './model';

const StepBody = ({ section, sections, compact }) => (
  <div className={compact ? 'space-y-3.5' : 'space-y-5'}>
    {section.questions.map((question) => {
      const condition = describeLogic(question.conditional_logic, sections);
      return (
        <div key={question.id} className={compact ? 'space-y-1.5' : 'space-y-2'}>
          {condition && (
            <span className="inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-accent-fg">
              <GitBranch className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{condition}</span>
            </span>
          )}
          <p className={`font-semibold text-ink ${compact ? 'text-[13px]' : 'text-sm'}`}>
            {question.label || <span className="font-normal italic text-ink-muted">Untitled question</span>}
            {question.required && <span className="ml-0.5 text-danger-fg">*</span>}
          </p>
          {question.help_text && <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-ink-muted`}>{question.help_text}</p>}
          <FieldPreview question={question} compact={compact} />
        </div>
      );
    })}
    {section.questions.length === 0 && <p className="text-sm italic text-ink-muted">No questions in this step yet.</p>}
  </div>
);

const ReporterPreview = ({ form, device = 'phone' }) => {
  const sections = form.sections || [];
  const [index, setIndex] = useState(0);
  const step = Math.min(index, Math.max(0, sections.length - 1));
  const section = sections[step];
  const compact = device === 'phone';
  const last = step === sections.length - 1;

  const body = section ? (
    <>
      <div className="flex gap-1" aria-hidden="true">
        {sections.map((s, i) => (
          <span key={s.id} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-active'}`} />
        ))}
      </div>
      <div>
        <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-ink-muted`}>
          Step {step + 1} of {sections.length}
        </p>
        <h3 className={`font-bold text-ink ${compact ? 'text-[17px]' : 'text-xl'}`}>{section.title || 'Untitled step'}</h3>
        {section.description && <p className={`mt-0.5 ${compact ? 'text-xs' : 'text-sm'} text-ink-muted`}>{section.description}</p>}
      </div>
      <StepBody section={section} sections={sections} compact={compact} />
      <div className="mt-auto flex gap-2 pt-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setIndex(step - 1)}
            className={`rounded-lg border border-line font-medium text-ink-secondary hover:bg-hover ${compact ? 'h-10 flex-1 text-sm' : 'h-10 px-5 text-sm'}`}
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={() => !last && setIndex(step + 1)}
          className={`rounded-lg bg-accent font-semibold text-on-accent hover:bg-accent-hover ${compact ? 'h-10 flex-[2] text-sm' : 'ml-auto h-10 px-6 text-sm'}`}
        >
          {last ? 'Submit report' : 'Continue'}
        </button>
      </div>
    </>
  ) : (
    <p className="m-auto text-sm text-ink-muted">Add a step to see the form here.</p>
  );

  if (compact) {
    return (
      <div className="w-75 rounded-[2.25rem] border-[10px] border-[#1E293B] bg-surface shadow-xl">
        <div className="flex h-135 flex-col gap-3.5 overflow-y-auto rounded-[1.6rem] px-4.5 pb-4.5 pt-5.5 scrollbar-thin">{body}</div>
      </div>
    );
  }
  return (
    <div className="w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
      <div className="flex h-8 items-center gap-1.5 border-b border-line-subtle bg-subtle px-3" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-active" />
        <span className="h-2.5 w-2.5 rounded-full bg-active" />
        <span className="h-2.5 w-2.5 rounded-full bg-active" />
        <span className="ml-3 truncate text-xs text-ink-muted">{form.name || 'New report type'}</span>
      </div>
      <div className="mx-auto flex max-h-[70dvh] min-h-105 max-w-xl flex-col gap-5 overflow-y-auto px-6 py-7 scrollbar-thin">{body}</div>
    </div>
  );
};

export default ReporterPreview;
