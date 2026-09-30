import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseServerDate } from '../utils/formatters';

/**
 * Shared ordering for the app's tables.
 *
 * Sort state lives in the query string next to the filters, so an ordered view
 * is as shareable and refresh-safe as a filtered one, and the column headers,
 * the `<TableSortControl>` dropdown, and any deep link all read and write the
 * same place.
 *
 * A column map looks like:
 *
 *   { created_at: { label: 'Submitted On', defaultOrder: 'desc', value: (row) => ... } }
 *
 * `value` pulls the sort key out of a row. `defaultOrder` is the direction a
 * fresh click on that column starts in — newest-first for dates, most-severe
 * first for ranked columns, A-Z for names.
 *
 * The map must be referentially stable: define it at module scope, or wrap it
 * in `useMemo` when its `value` functions close over component state.
 */

// Ranked columns sort by severity/lifecycle order, not alphabetically —
// A-Z would put "critical" next to "high" and read as noise.
export const PRIORITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };
export const STATUS_RANK = { pending: 0, in_progress: 1, resolved: 2, closed: 3, rejected: 4 };
export const ROLE_RANK = { reporter: 0, reviewer: 1, officer: 2, manager: 3, admin: 4 };

// Numbers compare numerically; report numbers and names need a locale-aware
// comparison so "#10" sorts after "#9" rather than before it. Blanks sort last
// in both directions — an empty assignee is not "before A".
const BLANK = Symbol('blank');
const normalize = (value) => {
  if (value === null || value === undefined || value === '') return BLANK;
  return value;
};

export const compareValues = (rawA, rawB) => {
  const a = normalize(rawA);
  const b = normalize(rawB);
  if (a === BLANK && b === BLANK) return 0;
  if (a === BLANK) return 1;
  if (b === BLANK) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

// Convenience builders for the value functions the column maps repeat most.
export const byDate = (field) => (row) => parseServerDate(row[field])?.getTime() ?? null;
export const byText = (field) => (row) => (row[field] || '').toLowerCase();
export const byRank = (field, ranks) => (row) => ranks[row[field]] ?? -1;

export const useTableSort = (rows, columns, options = {}) => {
  const {
    // Falls back to the first column in the map, so a caller only has to name
    // a default when it is not the leftmost one.
    defaultSortBy = Object.keys(columns)[0],
    defaultOrder,
    // Distinguishes the params when a page carries more than one sorted table.
    paramPrefix = '',
  } = options;

  const sortByParam = paramPrefix ? `${paramPrefix}_sort_by` : 'sort_by';
  const orderParam = paramPrefix ? `${paramPrefix}_order` : 'order';

  const [searchParams, setSearchParams] = useSearchParams();

  // An unknown column in the URL falls back to the default rather than
  // rendering an unsorted table with no active header.
  const requested = searchParams.get(sortByParam);
  const sortBy = columns[requested] ? requested : defaultSortBy;

  const urlOrder = searchParams.get(orderParam);
  const sortOrder = urlOrder === 'asc' || urlOrder === 'desc'
    ? urlOrder
    : (defaultOrder || columns[sortBy]?.defaultOrder || 'desc');

  const setSort = useCallback((field, order) => {
    if (!columns[field]) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(sortByParam, field);
      next.set(orderParam, order);
      return next;
    }, { replace: true });
  }, [columns, setSearchParams, sortByParam, orderParam]);

  // Clicking the sorted column flips direction; clicking a new one starts at
  // that column's natural direction.
  const handleSort = useCallback((field) => {
    const column = columns[field];
    if (!column) return;
    const nextOrder = field === sortBy
      ? (sortOrder === 'asc' ? 'desc' : 'asc')
      : (column.defaultOrder || 'desc');
    setSort(field, nextOrder);
  }, [columns, sortBy, sortOrder, setSort]);

  const sortedRows = useMemo(() => {
    const column = columns[sortBy];
    if (!column || !Array.isArray(rows)) return rows;
    const direction = sortOrder === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => direction * compareValues(column.value(a), column.value(b)));
  }, [rows, columns, sortBy, sortOrder]);

  // Spread onto a `<Table.Head>` to make it a sort control.
  const getHeaderProps = useCallback((field) => {
    if (!columns[field]) return {};
    const isActive = sortBy === field;
    return {
      sortable: true,
      sortDirection: isActive ? sortOrder : null,
      onSort: () => handleSort(field),
      'aria-sort': isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none',
    };
  }, [columns, sortBy, sortOrder, handleSort]);

  return { sortBy, sortOrder, sortedRows, handleSort, setSort, getHeaderProps, columns };
};

export default useTableSort;
