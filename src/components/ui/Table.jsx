import { Children, Fragment, isValidElement } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import Skeleton from './Skeleton';

// Children may arrive wrapped in fragments (e.g. `<TableLoading />` renders one),
// so flatten before matching element types.
const flattenChildren = (children) =>
  Children.toArray(children).flatMap((child) =>
    isValidElement(child) && child.type === Fragment
      ? flattenChildren(child.props.children)
      : [child]
  );

const findChild = (children, type) =>
  flattenChildren(children).find((child) => isValidElement(child) && child.type === type);

const isEmptyCell = (value) =>
  value === null || value === undefined || value === false || value === '';

// Reads the `<Table.Header>` / `<Table.Body>` tree so the compound form can be
// rendered as a label/value list on phones, the same way the columns/data form is.
const readCompoundTable = (children) => {
  const header = findChild(children, TableHeader);
  const body = findChild(children, TableBody);
  if (!header || !body) return null;

  const headerRow = findChild(header.props.children, TableRow);
  if (!headerRow) return null;

  const headers = flattenChildren(headerRow.props.children)
    .filter((cell) => isValidElement(cell) && cell.type === TableHead)
    .map((cell) => cell.props.children);

  const items = [];
  for (const child of flattenChildren(body.props.children)) {
    if (!isValidElement(child)) continue;
    if (child.type === TableRow) {
      items.push({ kind: 'row', element: child });
    } else if (child.type === TableEmpty) {
      items.push({ kind: 'empty', element: child });
    } else if (child.type === TableLoading) {
      items.push({ kind: 'loading', element: child });
    } else {
      // Unknown body content — bail out rather than silently dropping it.
      return null;
    }
  }

  return { headers, items };
};

const Table = ({ children, columns, data, onRowClick, getSortProps, className = '', ...props }) => {
  const compound = columns && data ? null : readCompoundTable(children);

  return (
    <>
      {columns && data ? (
        <>
          {/* Desktop/Tablet table view */}
          <div className="hidden md:block overflow-x-auto scrollbar-thin rounded-xl border border-line bg-surface">
            <table className={`min-w-160 lg:min-w-full w-full border-collapse ${className}`} {...props}>
              <TableHeader>
                <TableRow hover={false}>
                  {/* A column opts in with `sortable`, and `getSortProps` —
                      from `useTableSort` — supplies the direction and handler
                      for its `sortField` (defaulting to its accessor). */}
                  {columns.map((col, idx) => (
                    <TableHead
                      key={idx}
                      className={col.headerClassName || col.className}
                      {...(col.sortable && getSortProps
                        ? getSortProps(col.sortField || col.accessor)
                        : {})}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableEmpty />
                ) : (
                  data.map((row, rowIdx) => (
                    <TableRow
                      key={row.id || rowIdx}
                      onClick={() => onRowClick && onRowClick(row)}
                      className={onRowClick ? 'cursor-pointer' : ''}
                    >
                      {columns.map((col, colIdx) => (
                        <TableCell key={colIdx} className={col.cellClassName || col.className}>
                          {col.cell ? col.cell(row[col.accessor], row) : row[col.accessor]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </table>
          </div>

          {/* Mobile card-list view — a horizontally scrolling table is unusable
              on a phone, so each row becomes a label/value stack. */}
          <div className="block md:hidden space-y-3">
            {data.length === 0 ? (
              <div className="bg-surface rounded-xl border border-line p-6 text-center">
                <TableEmpty asRow={false} />
              </div>
            ) : (
              data.map((row, rowIdx) => (
                <div
                  key={row.id || rowIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`bg-surface rounded-xl border border-line p-4 shadow-xs transition-colors active:bg-hover ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map((col, colIdx) => (
                    <div
                      key={colIdx}
                      className="flex justify-between items-start gap-3 py-2 border-b border-line-subtle last:border-0 last:pb-0 first:pt-0"
                    >
                      <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.04em] mt-0.5 shrink-0">
                        {col.header}
                      </span>
                      <div className={`text-sm text-ink text-right min-w-0 ${col.cellClassName || col.className || ''}`}>
                        {col.cell ? col.cell(row[col.accessor], row) : row[col.accessor]}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div
            className={`${compound ? 'hidden md:block ' : ''}overflow-x-auto scrollbar-thin rounded-xl border border-line bg-surface`}
          >
            <table className={`min-w-160 lg:min-w-full w-full border-collapse ${className}`} {...props}>
              {children}
            </table>
          </div>

          {/* Mobile/tablet list view — a horizontally scrolling table is unusable
              on a narrow screen, so each row becomes a label/value stack. These
              sit inside the surrounding Card, hence dividers instead of borders. */}
          {compound && (
            <div className="md:hidden divide-y divide-line-subtle">
              {compound.items.map((item, itemIdx) => {
                if (item.kind === 'loading') {
                  const { rows = 5 } = item.element.props;
                  return Array.from({ length: rows }).map((_, rowIdx) => (
                    <div key={`loading-${itemIdx}-${rowIdx}`} className="px-4 py-4 space-y-2.5">
                      <div className="h-4 w-1/3 rounded bg-active animate-pulse" />
                      <div className="h-4 w-2/3 rounded bg-active animate-pulse" />
                    </div>
                  ));
                }

                if (item.kind === 'empty') {
                  return (
                    <TableEmpty
                      key={`empty-${itemIdx}`}
                      {...item.element.props}
                      asRow={false}
                    />
                  );
                }

                const row = item.element;
                const { onClick, className: rowClassName = '' } = row.props;
                const cells = flattenChildren(row.props.children).filter(
                  (cell) => isValidElement(cell) && (cell.type === TableCell || cell.type === TableActions)
                );

                return (
                  <div
                    key={row.key ?? `row-${itemIdx}`}
                    onClick={onClick}
                    role={onClick ? 'button' : undefined}
                    tabIndex={onClick ? 0 : undefined}
                    onKeyDown={
                      onClick
                        ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onClick(event);
                          }
                        }
                        : undefined
                    }
                    className={`px-4 py-3 bg-surface transition-colors ${onClick ? 'cursor-pointer active:bg-hover' : ''} ${rowClassName}`}
                  >
                    {cells.map((cell, cellIdx) => {
                      const label = compound.headers[cellIdx];
                      if (isEmptyCell(cell.props.children)) return null;
                      return (
                        <div
                          key={cellIdx}
                          className="flex justify-between items-start gap-3 py-1.5"
                        >
                          {!isEmptyCell(label) && (
                            <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.04em] mt-1 shrink-0">
                              {label}
                            </span>
                          )}
                          <div
                            className={`text-sm text-ink min-w-0 ${isEmptyCell(label) ? 'w-full' : 'text-right ml-auto'} ${cell.props.className || ''}`}
                          >
                            {cell.props.children}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
};

const TableHeader = ({ children, className = '', ...props }) => (
  <thead className={`bg-subtle ${className}`} {...props}>
    {children}
  </thead>
);

const TableBody = ({ children, className = '', ...props }) => (
  <tbody className={className} {...props}>
    {children}
  </tbody>
);

const TableFooter = ({ children, className = '', ...props }) => (
  <tfoot className={`bg-subtle ${className}`} {...props}>
    {children}
  </tfoot>
);

const TableRow = ({ children, className = '', hover = true, ...props }) => (
  <tr
    className={`border-b border-line-subtle last:border-0 transition-colors duration-150 ${hover ? 'hover:bg-hover' : ''} ${className}`}
    {...props}
  >
    {children}
  </tr>
);

const TableHead = ({
  children,
  className = '',
  sortable = false,
  sortDirection = null,
  onSort,
  ...props
}) => (
  <th
    className={`px-4 py-3 sm:px-5 text-left text-[10px] font-semibold text-ink-subtle uppercase tracking-wider whitespace-nowrap ${className}`}
    {...props}
  >
    {sortable ? (
      <button
        type="button"
        className="flex items-center gap-1.5 uppercase tracking-wider transition-colors hover:text-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onClick={onSort}
      >
        <span>{children}</span>
        <span className="flex flex-col">
          <ChevronUp
            className={`w-3 h-3 ${sortDirection === 'asc' ? 'text-accent-fg' : 'text-ink-subtle'}`}
          />
          <ChevronDown
            className={`w-3 h-3 -mt-1 ${sortDirection === 'desc' ? 'text-accent-fg' : 'text-ink-subtle'}`}
          />
        </span>
      </button>
    ) : (
      children
    )}
  </th>
);

const TableCell = ({ children, className = '', ...props }) => (
  <td className={`px-4 py-3 sm:px-5 sm:py-3.5 text-sm text-ink-secondary align-middle ${className}`} {...props}>
    {children}
  </td>
);

// Special table cell for actions
const TableActions = ({ children, className = '', ...props }) => (
  <td className={`px-4 py-3 sm:px-5 sm:py-3.5 whitespace-nowrap text-right text-sm font-medium ${className}`} {...props}>
    <div className="flex justify-end items-center gap-2">{children}</div>
  </td>
);

// Empty state for tables
const TableEmpty = ({
  message = 'No data available',
  description = 'There are no items to display.',
  icon: Icon,
  action,
  asRow = true,
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center">
      {Icon && (
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-xl bg-subtle border border-line-subtle mb-4">
          <Icon className="h-6 w-6 text-ink-subtle" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink mb-1">{message}</h3>
      <p className="text-sm text-ink-muted mb-4">{description}</p>
      {action}
    </div>
  );

  if (asRow) {
    return (
      <tr>
        <td colSpan="100" className="px-6 py-12 text-center">
          {content}
        </td>
      </tr>
    );
  }

  return <div className="py-12 text-center">{content}</div>;
};

// Loading state for tables. Pass `cells` — one placeholder node per column,
// shaped like that column's real content (an avatar with two lines, a badge,
// a row of action icons) — so the rows are the height the data will be.
// Without it each cell is one text-sm line.
const TableLoading = ({ colSpan = 1, rows = 5, cells = null }) => (
  <>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <tr key={rowIndex} className="border-b border-line-subtle last:border-0" aria-hidden="true">
        {(cells || Array.from({ length: colSpan })).map((cell, colIndex) => (
          <td key={colIndex} className="px-4 py-3 sm:px-5 sm:py-3.5 align-middle">
            {cells ? cell : <Skeleton.Text className="w-full max-w-32" />}
          </td>
        ))}
      </tr>
    ))}
  </>
);

Table.Header = TableHeader;
Table.Body = TableBody;
Table.Footer = TableFooter;
Table.Row = TableRow;
Table.Head = TableHead;
Table.Cell = TableCell;
Table.Actions = TableActions;
Table.Empty = TableEmpty;
Table.Loading = TableLoading;

export { TableEmpty, TableLoading };
export default Table;
