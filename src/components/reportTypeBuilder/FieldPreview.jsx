// src/components/reportTypeBuilder/FieldPreview.jsx
//
// A question's answer area as a reporter sees it — inert, for the builder's
// canvas and the reporter preview. `compact` is the phone-sized version.
import { Upload } from 'lucide-react';
import { DEFAULT_CURRENCY, normalizeOptions } from '../../utils/reportTypes';

const box = (compact) =>
  `w-full rounded-lg border border-line bg-subtle text-ink-muted ${compact ? 'h-9 px-2.5 text-xs' : 'h-10 px-3 text-sm'} flex items-center`;

const FieldPreview = ({ question, compact = false }) => {
  const options = normalizeOptions(question.options);
  const hint = question.placeholder;

  switch (question.type) {
    case 'textarea':
      return <div className={`${box(compact)} ${compact ? 'h-16' : 'h-20'} items-start pt-2`}>{hint}</div>;
    case 'select':
      return (
        <div className={`${box(compact)} justify-between`}>
          <span className="truncate">{hint || 'Choose an answer'}</span>
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      );
    case 'multiselect':
      return (
        <div className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-2'}`}>
          {options.slice(0, compact ? 4 : 6).map((option) => (
            <span key={option.value || option.display_order} className={`flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} text-ink-secondary`}>
              <span className="h-4 w-4 shrink-0 rounded border border-line-strong bg-surface" />
              {option.label || option.value}
            </span>
          ))}
          {options.length > (compact ? 4 : 6) && (
            <span className="text-xs text-ink-muted">+{options.length - (compact ? 4 : 6)} more</span>
          )}
        </div>
      );
    case 'boolean':
      return (
        <div className="flex gap-2">
          {['Yes', 'No'].map((label) => (
            <span
              key={label}
              className={`flex items-center justify-center rounded-lg border border-line text-ink-secondary ${compact ? 'h-8 flex-1 text-xs' : 'h-9 px-5 text-sm'}`}
            >
              {label}
            </span>
          ))}
        </div>
      );
    case 'date':
      return <div className={`${box(compact)} ${compact ? '' : 'max-w-60'}`}>dd / mm / yyyy</div>;
    case 'datetime':
      return <div className={`${box(compact)} ${compact ? '' : 'max-w-72'}`}>dd / mm / yyyy, --:--</div>;
    case 'time':
      return <div className={`${box(compact)} ${compact ? '' : 'max-w-40'}`}>--:--</div>;
    case 'currency':
      return (
        <div className="flex gap-2">
          <div className={`${box(compact)} w-20! shrink-0`}>{question.default_value?.currency || DEFAULT_CURRENCY}</div>
          <div className={box(compact)}>{hint || '0.00'}</div>
        </div>
      );
    case 'file':
      return (
        <div
          className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-line bg-subtle text-ink-muted ${compact ? 'py-3 text-xs' : 'py-5 text-sm'}`}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          Add files
        </div>
      );
    case 'number':
      return <div className={`${box(compact)} ${compact ? '' : 'max-w-60'}`}>{hint}</div>;
    case 'email':
      return <div className={box(compact)}>{hint || 'name@example.com'}</div>;
    default:
      return <div className={box(compact)}>{hint}</div>;
  }
};

export default FieldPreview;
