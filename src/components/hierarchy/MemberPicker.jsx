// src/components/hierarchy/MemberPicker.jsx
//
// Choose one person from the directory — a manager, usually. The directory
// can hold thousands, so this searches the server (GET /org-hierarchy/members
// ?search=) as the admin types instead of listing everyone in a <select>.
//
// `value` is an employee id (external_id). Its name is looked up on its own,
// so an existing choice reads as a name before anything is searched; an id
// that isn't on file reads "(not in directory)".
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useDebounce } from '../../hooks/useDebounce';
import { useMemberNames } from '../../hooks/useMemberNames';

const RESULTS = 20;

const MemberPicker = ({
  id,
  value,
  onChange,
  excludeId = null,
  emptyLabel = 'No manager on file',
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, 400);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef(null);
  const listId = useId();
  const { nameOf, lookup } = useMemberNames(value ? [value] : []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoading(true);
    orgHierarchyAPI
      .listMembers({ search: debounced, pageSize: RESULTS, quiet: true })
      .then(({ items }) => {
        if (!live) return;
        setResults(items.filter((m) => m.external_id !== excludeId && m.is_active !== false));
        setFailed(false);
        setCursor(0);
      })
      .catch(() => live && setFailed(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [open, debounced, excludeId]);

  useEffect(() => {
    if (!open) return;
    const close = (event) => !rootRef.current?.contains(event.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (member) => {
    onChange(member ? member.external_id : '', member);
    setOpen(false);
    setTerm('');
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (results[cursor]) choose(results[cursor]);
    }
  };

  const label = !value
    ? emptyLabel
    : nameOf(value) || (lookup.pending ? 'Loading…' : `${value} (not in directory)`);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 text-left ${className}`}
      >
        <span className={`truncate ${value ? '' : 'text-ink-muted'}`}>{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-subtle" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <label className="flex items-center gap-2 border-b border-line-subtle px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink-subtle" />
            <input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search name, email, title, employee id"
              aria-label="Search the directory"
              aria-controls={listId}
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
            />
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-subtle" />}
          </label>
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {value && (
              <li>
                <button
                  type="button"
                  onClick={() => choose(null)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-hover"
                >
                  <X className="h-3.5 w-3.5" />
                  {emptyLabel}
                </button>
              </li>
            )}
            {failed && <li className="px-3 py-2 text-xs text-danger-fg">Couldn't search the directory.</li>}
            {!failed && !loading && results.length === 0 && (
              <li className="px-3 py-2 text-xs text-ink-muted">No one matches.</li>
            )}
            {results.map((member, i) => (
              <li key={member.external_id} role="option" aria-selected={member.external_id === value}>
                <button
                  type="button"
                  onClick={() => choose(member)}
                  onMouseEnter={() => setCursor(i)}
                  className={`flex w-full flex-col px-3 py-1.5 text-left transition-colors ${
                    i === cursor ? 'bg-hover' : ''
                  } ${member.external_id === value ? 'font-semibold' : ''}`}
                >
                  <span className="truncate text-sm text-ink">{member.name}</span>
                  <span className="truncate text-[11px] text-ink-subtle">
                    {[member.designation, member.department].filter(Boolean).join(' · ') || member.external_id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MemberPicker;
