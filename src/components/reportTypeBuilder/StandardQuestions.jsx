// src/components/reportTypeBuilder/StandardQuestions.jsx
//
// Shared pieces for standard questions (the field catalogue):
//   TurnOffConfirm  — removing one shows its `if_disabled` first, verbatim:
//                     it is written for the admin and says what will stop.
//   StandardDetails — what its answer feeds (`drives`) and why it exists (`why`).
import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { ConfirmationModal } from '../layout/Modal';

/** "Turn off …?" with the entry's own consequence. Open it with an entry; null closes it. */
export const TurnOffConfirm = ({ entry, onClose, onConfirm }) => (
  <ConfirmationModal
    isOpen={Boolean(entry)}
    onClose={onClose}
    onConfirm={onConfirm}
    title={entry ? `Turn off "${entry.label}"` : ''}
    message={entry?.if_disabled || ''}
    confirmText="Turn it off"
    cancelText="Keep it"
    destructive
  />
);

/** What the answer feeds, and why the question exists. */
export const StandardDetails = ({ entry, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        {open ? 'Hide details' : 'Details'}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink-secondary">
          {entry.drives && (
            <p>
              <span className="font-semibold text-ink">Feeds: </span>
              {entry.drives}
            </p>
          )}
          {entry.why && <p>{entry.why}</p>}
        </div>
      )}
    </div>
  );
};
