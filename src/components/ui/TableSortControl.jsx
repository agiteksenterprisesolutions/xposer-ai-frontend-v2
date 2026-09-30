import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';

/**
 * The "order by" control that pairs with `useTableSort`.
 *
 * Column headers sort too, but they disappear once a table collapses into the
 * card list on phones — this works at every width. Pass the values straight
 * through from the hook:
 *
 *   <TableSortControl {...sort} id="reports" />
 */
const TableSortControl = ({
  columns,
  sortBy,
  sortOrder,
  setSort,
  id = 'table',
  label = 'Order by',
  className = '',
  // Absorbed so the whole `useTableSort` return can be spread in without these
  // landing on the wrapper as unknown DOM attributes.
  sortedRows,
  handleSort,
  getHeaderProps,
  ...props
}) => {
  const entries = Object.entries(columns);
  if (entries.length === 0) return null;

  const selectId = `${id}-sort-by`;
  const nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';

  return (
    <div className={`flex items-center gap-1 ${className}`} {...props}>
      <label htmlFor={selectId} className="sr-only">{label}</label>
      <select
        id={selectId}
        value={sortBy}
        onChange={(e) => setSort(e.target.value, columns[e.target.value]?.defaultOrder || 'desc')}
        className="rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-line-accent"
      >
        {entries.map(([field, column]) => (
          <option key={field} value={field}>{column.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setSort(sortBy, nextOrder)}
        title={sortOrder === 'asc' ? 'Ascending — switch to descending' : 'Descending — switch to ascending'}
        aria-label={sortOrder === 'asc' ? 'Sorted ascending. Switch to descending.' : 'Sorted descending. Switch to ascending.'}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line-strong text-ink-muted transition-colors hover:text-ink hover:bg-hover focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {sortOrder === 'asc' ? <ArrowUpNarrowWide className="h-4 w-4" /> : <ArrowDownWideNarrow className="h-4 w-4" />}
      </button>
    </div>
  );
};

export default TableSortControl;
