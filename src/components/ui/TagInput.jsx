// src/components/ui/TagInput.jsx
//
// A list of short strings as removable chips. Enter or comma adds what's
// typed; pasting several lines adds each. Duplicates (case-insensitive) are
// ignored.
import { useState } from 'react';
import { X } from 'lucide-react';

const TagInput = ({
  value = [],
  onChange,
  placeholder = 'Type and press Enter',
  readOnly = false,
  emptyText = 'None yet.',
  ariaLabel,
  normalize = (text) => text.trim(),
}) => {
  const [draft, setDraft] = useState('');

  const add = (texts) => {
    const seen = new Set(value.map((v) => v.toLowerCase()));
    const additions = [];
    texts.forEach((raw) => {
      const tag = normalize(raw);
      if (tag && !seen.has(tag.toLowerCase())) {
        seen.add(tag.toLowerCase());
        additions.push(tag);
      }
    });
    if (additions.length) onChange([...value, ...additions]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-xs text-ink-subtle">{emptyText}</span>}
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-subtle px-2.5 py-0.5 text-xs text-ink-secondary"
          >
            {tag}
            {!readOnly && (
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
                className="rounded-full text-ink-subtle hover:text-ink"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!readOnly && (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              add([draft]);
            } else if (event.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add([draft])}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text');
            if (/[\n\t]/.test(text)) {
              event.preventDefault();
              add(text.split(/[\n\t]+/));
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="w-full rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink hover:border-line-strong"
        />
      )}
    </div>
  );
};

export default TagInput;
