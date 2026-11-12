// src/components/forms/ReportTypePicker.jsx
//
// How a reporter reaches the right form: category first, a search box over
// every type, a description under each one, and "Other / not sure" as a
// choice of its own. With `exits`, a deflection popup opens first and points
// things that aren't whistleblowing reports (customer complaints, HR
// requests) to their own route; closing it carries on to the categories.
//
// Clicks to a form: close the popup → category → type is three; a category
// with one type, "Other / not sure" with one type, and a search result each
// save a click.
import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, ExternalLink, HelpCircle, Search, ShieldCheck, X } from 'lucide-react';
import Card from '../ui/Card';
import Alert from '../ui/Alert';
import Skeleton from '../ui/Skeleton';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { localized } from '../../api/jurisdiction';

const GENERAL = 'General';
const isOtherCategory = (category) => /\bother\b|not\s*sure/i.test(category || '');
const isOtherType = (type) => isOtherCategory(type.category) || /not\s*sure/i.test(type.name || '');

const haystackOf = (type) => [type.name, type.description, type.category, type.code].filter(Boolean).join(' ').toLowerCase();

/** Types containing every word; failing that, those containing any, most words first. */
export function searchReportTypes(types, words) {
  if (!words.length) return [];
  const scored = types
    .map((type) => {
      const haystack = haystackOf(type);
      return { type, hits: words.filter((w) => haystack.includes(w)).length };
    })
    .filter((x) => x.hits > 0);
  const all = scored.filter((x) => x.hits === words.length);
  const pool = all.length ? all : scored;
  return pool.sort((a, b) => b.hits - a.hits || a.type.name.localeCompare(b.type.name)).map((x) => x.type);
}

/** Types grouped by category (alphabetical), with the "Other / not sure" types kept apart. */
export function groupReportTypes(types) {
  const other = [];
  const byCategory = new Map();
  for (const type of types) {
    if (isOtherType(type)) {
      other.push(type);
      continue;
    }
    const key = type.category?.trim() || GENERAL;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(type);
  }
  const categories = [...byCategory.entries()]
    .map(([name, list]) => ({ name, types: [...list].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => (a.name === GENERAL) - (b.name === GENERAL) || a.name.localeCompare(b.name));
  return { categories, other };
}

const RowButton = ({ onClick, disabled, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`group flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left transition-[border-color,box-shadow] hover:border-line-accent hover:shadow-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  >
    <span className="min-w-0 flex-1">{children}</span>
    <ChevronRight className="h-5 w-5 shrink-0 text-ink-subtle transition-colors group-hover:text-accent-fg" />
  </button>
);

const TypeRow = ({ type, onSelect, disabled, showCategory }) => (
  <RowButton onClick={() => onSelect(type)} disabled={disabled}>
    <span className="block font-semibold leading-snug text-ink">{type.name}</span>
    <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
      {type.description || 'Report a concern of this kind.'}
    </span>
    {showCategory && type.category && <span className="mt-1.5 block text-xs text-ink-subtle">{type.category}</span>}
  </RowButton>
);

const BackLink = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
  >
    <ArrowLeft className="h-4 w-4" /> {children}
  </button>
);

// A link from pack data opens only if it's a web, email or phone address, never javascript: or data:.
const safeUrl = (url) => (typeof url === 'string' && /^(https?:|mailto:|tel:)/i.test(url.trim()) ? url.trim() : null);

/** The exits on their own, for a page that shows them before the picker (the anonymous credentials step). */
export const DeflectionExits = ({ exits }) => (
  <ul className="space-y-2">
    {exits.map((exit) => {
      const label = localized(exit.label) || exit.code;
      const description = localized(exit.description);
      const url = safeUrl(exit.url);
      const body = (
        <>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            {label}
            {url && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />}
          </span>
          {description && <span className="mt-0.5 block text-sm text-ink-muted">{description}</span>}
        </>
      );
      return (
        <li key={exit.code}>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border border-line px-4 py-3 transition-colors hover:border-line-strong hover:bg-hover"
            >
              {body}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            <div className="rounded-lg border border-line px-4 py-3">{body}</div>
          )}
        </li>
      );
    })}
  </ul>
);

const PickerBody = ({ types, loading = false, error = null, onSelect, disabled = false, onReopenDeflection = null, wide = true }) => {
  const grid = `grid gap-3 sm:grid-cols-2 ${wide ? 'lg:grid-cols-3' : ''}`;
  const [step, setStep] = useState('categories');
  const [category, setCategory] = useState(null); // a category name, or 'other' / 'all'
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  const { categories, other } = useMemo(() => groupReportTypes(types || []), [types]);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = useMemo(
    () => searchReportTypes(types || [], words),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [types, query],
  );

  const openCategory = (name, list) => {
    // One type in it: that type is the answer, so skip the list.
    if (list.length === 1) return onSelect(list[0]);
    setCategory(name);
    setStep('types');
  };

  const openOther = () => {
    if (other.length) return openCategory('other', other);
    // No "not sure" type configured: let the reporter browse everything.
    setCategory('all');
    setStep('types');
  };

  if (loading) {
    return (
      <div className={grid} aria-busy="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-4">
            <Skeleton.Text size="base" className="mb-2 w-2/3" />
            <Skeleton.Lines lines={2} />
          </div>
        ))}
      </div>
    );
  }

  if (error) return <Alert variant="error">{error}</Alert>;

  if (!types?.length) {
    return (
      <Card>
        <Alert variant="warning">
          <p className="font-medium">No report types available</p>
          <p className="mt-1 text-sm">Please check back later, or contact the organization if this persists.</p>
        </Alert>
      </Card>
    );
  }

  if (step === 'types') {
    const list =
      category === 'other' ? other : category === 'all' ? [...types].sort((a, b) => a.name.localeCompare(b.name)) : categories.find((c) => c.name === category)?.types || [];
    const title = category === 'other' ? 'Other / not sure' : category === 'all' ? 'All report types' : category;
    return (
      <div>
        <BackLink
          onClick={() => {
            setStep('categories');
            setCategory(null);
          }}
        >
          All categories
        </BackLink>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">Choose the one that fits best. The team can re-classify it later if needed.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((type) => (
            <TypeRow key={type.id} type={type} onSelect={onSelect} disabled={disabled} showCategory={category === 'all'} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-ink">What is your concern about?</h2>
      <p className="mt-1 mb-4 text-sm text-ink-muted">
        Pick a category, or search if you know what you’re looking for.
        {onReopenDeflection && (
          <>
            {' '}
            <button type="button" onClick={onReopenDeflection} className="font-medium text-link hover:underline">
              Not sure this is the right place?
            </button>
          </>
        )}
      </p>

      <div className="relative mb-5" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search, e.g. bribery, data leak, harassment"
          aria-label="Search report types"
          className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-9 pr-10 text-sm text-ink placeholder:text-ink-subtle focus:border-line-accent focus:outline-none focus:ring-2 focus:ring-accent-ring [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              searchRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-subtle hover:bg-hover hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {words.length > 0 ? (
        <div aria-live="polite">
          <p className="mb-3 text-sm text-ink-muted">
            {results.length ? `${results.length} matching report type${results.length === 1 ? '' : 's'}` : 'No report type matches that.'}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {results.map((type) => (
              <TypeRow key={type.id} type={type} onSelect={onSelect} disabled={disabled} showCategory />
            ))}
          </div>
          {!results.length && (
            <RowButton onClick={openOther} disabled={disabled} className="border-dashed">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <HelpCircle className="h-4 w-4 text-accent-fg" /> Other / not sure
              </span>
              <span className="mt-1 block text-sm text-ink-muted">Describe it in your own words. The team will classify it.</span>
            </RowButton>
          )}
        </div>
      ) : (
        <div className={grid}>
          {categories.map((c) => (
            <RowButton key={c.name} onClick={() => openCategory(c.name, c.types)} disabled={disabled}>
              <span className="block font-semibold leading-snug text-ink">{c.name}</span>
              <span className="mt-1 block text-sm text-ink-muted line-clamp-2">
                {c.types.length === 1
                  ? c.types[0].description || c.types[0].name
                  : `${c.types.slice(0, 2).map((t) => t.name).join(', ')}${c.types.length > 2 ? ` and ${c.types.length - 2} more` : ''}`}
              </span>
            </RowButton>
          ))}
          <RowButton onClick={openOther} disabled={disabled} className="border-dashed bg-subtle-solid">
            <span className="flex items-center gap-2 font-semibold text-ink">
              <HelpCircle className="h-4 w-4 text-accent-fg" /> Other / not sure
            </span>
            <span className="mt-1 block text-sm text-ink-muted">
              {other.length === 1 && other[0].description
                ? other[0].description
                : 'Nothing fits, or you’re unsure? Describe it in your own words and the team will classify it.'}
            </span>
          </RowButton>
        </div>
      )}
    </div>
  );
};

/**
 * "Is this the right place?" as a popup. Closing it, by the button, the X or
 * Escape, is how the reporter carries on.
 */
export const DeflectionModal = ({ isOpen, onClose, exits }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Is this the right place?"
    size="large"
    footer={
      <div className="flex justify-end">
        <Button startIcon={ShieldCheck} onClick={onClose} className="w-full sm:w-auto">
          Continue to report a concern
        </Button>
      </div>
    }
  >
    <div className="space-y-4" data-tour="picker-deflection">
      <p className="text-sm leading-relaxed text-ink-muted">
        This channel is for reporting misconduct: fraud, bribery, harassment, safety risks, data misuse, retaliation and
        similar concerns. Some things have a better route:
      </p>
      <DeflectionExits exits={exits} />
      <Alert variant="info">
        If your complaint or HR matter involves misconduct, such as harassment, discrimination or someone being punished for
        speaking up, report it here.
      </Alert>
    </div>
  </Modal>
);

/** The picker, with the deflection popup open on arrival when `exits` are given (unless `openDeflection` is false). */
const ReportTypePicker = ({ exits = null, openDeflection = true, ...props }) => {
  const hasExits = Boolean(exits?.length);
  const [deflecting, setDeflecting] = useState(hasExits && openDeflection);
  return (
    <>
      <PickerBody {...props} onReopenDeflection={hasExits ? () => setDeflecting(true) : null} />
      {hasExits && <DeflectionModal isOpen={deflecting} onClose={() => setDeflecting(false)} exits={exits} />}
    </>
  );
};

export default ReportTypePicker;
