// src/components/reportTypeBuilder/StartScreen.jsx
//
// The first thing "New report type" shows: a name and a starting point — the
// ten questions every report needs, or a copy of an existing type. Starting
// from something already filled in is what keeps building a type short.
import { useEffect, useState } from 'react';
import { ArrowRight, Copy, FileText, Info, X } from 'lucide-react';
import Button from '../ui/Button';
import { reportTypesAPI } from '../../api';
import { useUIStore } from '../../store/uiStore';

const StartScreen = ({ onStart, onCancel, starting = false }) => {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('essentials');
  const [types, setTypes] = useState(null);
  const [copyId, setCopyId] = useState('');

  useEffect(() => {
    useUIStore.setState({ fullBleed: true });
    return () => useUIStore.setState({ fullBleed: false });
  }, []);

  useEffect(() => {
    let live = true;
    reportTypesAPI
      .getReportTypes(false, false)
      .then((list) => live && setTypes(list))
      .catch(() => live && setTypes([]));
    return () => {
      live = false;
    };
  }, []);

  const pickCopy = (id) => {
    setCopyId(id);
    const source = types?.find((t) => (t.id || t._id) === id);
    if (source && !name.trim()) setName(`${source.name} (copy)`);
  };

  const ready = name.trim() && (mode === 'essentials' || copyId);
  const submit = (e) => {
    e.preventDefault();
    if (ready) onStart({ name: name.trim(), mode, copyId });
  };

  const choice = (value, Icon, title, text) => {
    const on = mode === value;
    return (
      <label
        className={`relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-4 transition-colors ${
          on ? 'border-accent bg-accent-soft/50 shadow-[0_0_0_1px_var(--color-accent)]' : 'border-line hover:border-line-strong'
        }`}
      >
        <input
          type="radio"
          name="start-from"
          value={value}
          checked={on}
          onChange={() => setMode(value)}
          className="absolute right-4 top-4 h-4 w-4 accent-[var(--color-accent)]"
        />
        <Icon className={`h-5 w-5 ${on ? 'text-accent-fg' : 'text-ink-muted'}`} aria-hidden="true" />
        <span className="text-sm font-semibold text-ink">{title}</span>
        <span className="text-xs leading-relaxed text-ink-secondary">{text}</span>
      </label>
    );
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-start justify-center bg-canvas px-4 py-10 sm:items-center">
      <form
        onSubmit={submit}
        aria-labelledby="rt-start-title"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
        data-tour="crt-start"
      >
        <div className="flex items-start gap-4 px-6 pb-1 pt-6 sm:px-7">
          <div className="flex-1">
            <h1 id="rt-start-title" className="text-xl font-bold tracking-[-0.01em] text-ink">
              New report type
            </h1>
            <p className="mt-1 text-sm text-ink-muted">Name it and pick a starting point. You can change everything afterwards.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-hover hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5 sm:px-7">
          <div className="space-y-1.5">
            <label htmlFor="rt-start-name" className="block text-sm font-medium text-ink-secondary">
              Name
            </label>
            <input
              id="rt-start-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Workplace harassment"
              className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-[0.9375rem] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent focus:ring-3 focus:ring-accent-ring"
            />
            <p className="text-xs text-ink-muted">Reporters see this when they choose what to report.</p>
          </div>

          <fieldset className="space-y-2.5">
            <legend className="mb-2.5 text-sm font-medium text-ink-secondary">Start from</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {choice('essentials', FileText, 'The essentials', 'The 10 questions every report needs, ready for you to add your own.')}
              {choice('copy', Copy, 'A copy of an existing type', 'Its questions and handling rules, under the new name.')}
            </div>
          </fieldset>

          {mode === 'copy' && (
            <div className="space-y-1.5">
              <label htmlFor="rt-start-copy" className="block text-sm font-medium text-ink-secondary">
                Type to copy
              </label>
              <select
                id="rt-start-copy"
                value={copyId}
                onChange={(e) => pickCopy(e.target.value)}
                disabled={!types}
                className="h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-line-accent disabled:opacity-60"
              >
                <option value="" disabled>
                  {!types ? 'Loading report types…' : types.length ? 'Choose a report type' : 'No report types to copy yet'}
                </option>
                {(types || []).map((type) => (
                  <option key={type.id || type._id} value={type.id || type._id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle bg-subtle px-6 py-4 sm:px-7">
          <span className="flex flex-[1_1_15rem] items-center gap-2 text-xs text-ink-secondary">
            <Info className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            Nothing is saved until you publish it or save a draft.
          </span>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!ready} isLoading={starting} endIcon={ArrowRight}>
            Open builder
          </Button>
        </div>
      </form>
    </div>
  );
};

export default StartScreen;
