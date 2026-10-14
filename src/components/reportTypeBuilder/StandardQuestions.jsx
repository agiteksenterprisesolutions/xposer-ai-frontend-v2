// src/components/reportTypeBuilder/StandardQuestions.jsx
//
// The standard questions, as a list of switches: which to ask. Grouped by
// tier — core (locked on), recommended, optional — and in the order a
// reporter meets them. Each row says what its answer feeds (`drives`); the
// details show why it exists (`why`). Turning one off shows `if_disabled`
// first, verbatim: it is written for the admin and says what will stop
// happening.
//
// Turning one on inserts the catalogue entry as given, in its step and
// place; the admin can then move it. Wording and type stay the catalogue's.
import { useState } from 'react';
import { ChevronDown, Info, Lock } from 'lucide-react';
import Modal, { ConfirmationModal } from '../layout/Modal';
import Button from '../ui/Button';
import { TIERS, askedNames, canTurnOff } from './catalog';

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

export const StandardSwitch = ({ on, disabled, label, title, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    title={title}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${
      on ? 'bg-accent' : 'bg-active'
    } ${disabled ? 'opacity-60' : ''}`}
  >
    <span className={`absolute top-1 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${on ? 'left-6' : 'left-1'}`} />
  </button>
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

const Row = ({ entry, on, onToggle }) => {
  const locked = !canTurnOff(entry);
  return (
    <li className="flex items-start gap-3 py-3">
      <StandardSwitch
        on={on}
        // A core question can be added to a type that lacks it, never removed.
        disabled={locked && on}
        label={`Ask "${entry.label}"`}
        title={locked && on ? `Always on. ${entry.if_disabled}` : undefined}
        onChange={onToggle}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-ink">{entry.label}</p>
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-active px-2 py-0.5 text-[11px] font-medium text-ink-secondary" title={entry.if_disabled}>
              <Lock className="h-3 w-3" aria-hidden="true" />
              Always on
            </span>
          )}
        </div>
        {entry.drives && <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted">{entry.drives}</p>}
        {locked && !on && (
          <p className="text-xs font-medium text-danger-fg">Not asked. This type can't go live until it is.</p>
        )}
        <StandardDetails entry={entry} />
      </div>
    </li>
  );
};

/** The list of switches, in a dialog. */
const StandardQuestions = ({ draft, isOpen, onClose }) => {
  const { form, catalog, turnOnStandard, turnOffStandard } = draft;
  const [confirming, setConfirming] = useState(null); // the entry being turned off
  if (!catalog) return null;
  const asked = askedNames(form.sections);
  const count = catalog.entries.filter((e) => asked.has(e.name)).length;

  const toggle = (entry, on) => {
    if (on) turnOnStandard(entry.name);
    else setConfirming(entry);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Standard questions"
        size="large"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">
              {count} of {catalog.entries.length} asked
            </span>
            <Button onClick={onClose}>Done</Button>
          </div>
        }
      >
        <div className="space-y-5">
          <p className="text-sm text-ink-secondary">
            The platform knows what these questions mean, so their answers can be counted across report types. Choose
            which to ask. You can move them to any step and order; their wording and type are fixed.
          </p>
          {TIERS.map((tier) => {
            const entries = catalog.entries.filter((e) => e.tier === tier.value);
            if (!entries.length) return null;
            return (
              <section key={tier.value} aria-labelledby={`tier-${tier.value}`}>
                <div className="border-b border-line pb-1.5">
                  <h3 id={`tier-${tier.value}`} className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                    {tier.label}
                  </h3>
                  <p className="text-xs text-ink-subtle">{tier.hint}</p>
                </div>
                <ul className="divide-y divide-line-subtle">
                  {entries.map((entry) => (
                    <Row key={entry.name} entry={entry} on={asked.has(entry.name)} onToggle={(on) => toggle(entry, on)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </Modal>
      <TurnOffConfirm
        entry={confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          turnOffStandard(confirming.name);
          setConfirming(null);
        }}
      />
    </>
  );
};

export default StandardQuestions;
