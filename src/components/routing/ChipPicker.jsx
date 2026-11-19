// src/components/routing/ChipPicker.jsx
//
// Pick several values from known options as toggle chips, optionally typing
// new ones. Used for report type prefixes, categories, codes, entities and
// flags in the routing rule editor.
//
//   <ChipPicker label="…" options={[{ value, label, hint }]} value={[...]}
//     onChange={…} allowFree normalize={(v) => v.toUpperCase()}
//     validate={(v) => errorText | null} />
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';

const ChipPicker = ({ label, hint, options = [], value = [], onChange, allowFree = false, normalize = (v) => v.trim(), validate, placeholder, error, emptyText, mono = false }) => {
  const { t } = useTranslation('routing');
  const id = useId();
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState(null);

  // Chosen values not among the options still show, so they can be removed.
  const known = new Set(options.map((o) => o.value));
  const extra = value.filter((v) => !known.has(v)).map((v) => ({ value: v, label: v }));
  const all = [...options, ...extra];

  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const add = () => {
    const v = normalize(draft);
    if (!v) return;
    const problem = validate?.(v);
    if (problem) {
      setDraftError(problem);
      return;
    }
    if (!value.includes(v)) onChange([...value, v]);
    setDraft('');
    setDraftError(null);
  };

  return (
    <div className="space-y-1.5">
      <p id={`${id}-label`} className="text-sm font-medium text-ink-secondary">{label}</p>
      {all.length > 0 ? (
        <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1.5">
          {all.map((o) => {
            const on = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                title={o.hint}
                onClick={() => toggle(o.value)}
                className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  on ? 'border-line-accent bg-accent-soft text-accent-fg' : 'border-line bg-surface text-ink-secondary hover:border-line-strong'
                }`}
              >
                <span className={mono ? 'font-mono' : undefined} dir="auto">{o.label}</span>
                {on && <X className="h-3 w-3" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      ) : (
        emptyText && <p className="text-xs text-ink-muted">{emptyText}</p>
      )}
      {allowFree && (
        <div className="flex gap-2">
          <input
            aria-label={t('chips.addLabel', { field: label })}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDraftError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            dir="auto"
            className={`h-8 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink outline-none focus:border-line-accent ${mono ? 'font-mono' : ''}`}
          />
          <button
            type="button"
            onClick={add}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-line px-2.5 text-xs font-medium text-ink-secondary hover:bg-hover"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {t('chips.add')}
          </button>
        </div>
      )}
      {(draftError || error) && <p className="text-xs text-danger-fg">{draftError || error}</p>}
      {!draftError && !error && hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
};

export default ChipPicker;
