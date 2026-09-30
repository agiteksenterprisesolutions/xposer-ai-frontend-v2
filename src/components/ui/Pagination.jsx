import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import Button from './Button';

const Pagination = ({
  currentPage = 1,
  totalPages = 1,
  // Real counts from the API envelope; without them the range is estimated
  // from the page count alone.
  totalItems = null,
  pageSize = 20,
  onPageChange,
  showNumbers = true,
  showInfo = true,
  className = '',
  siblingCount = 1,
  boundaryCount = 1,
}) => {
  if (totalPages <= 1) return null;

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  };

  // Generate page numbers to display
  const range = (start, end) => {
    const length = end - start + 1;
    return Array.from({ length }, (_, idx) => idx + start);
  };

  const startPages = range(1, Math.min(boundaryCount, totalPages));
  const endPages = range(Math.max(totalPages - boundaryCount + 1, boundaryCount + 1), totalPages);

  const siblingsStart = Math.max(
    Math.min(
      currentPage - siblingCount,
      totalPages - boundaryCount - siblingCount * 2 - 1
    ),
    boundaryCount + 2
  );

  const siblingsEnd = Math.min(
    Math.max(
      currentPage + siblingCount,
      boundaryCount + siblingCount * 2 + 2
    ),
    endPages.length > 0 ? endPages[0] - 2 : totalPages - 1
  );

  const itemList = [
    ...startPages,
    ...(siblingsStart > boundaryCount + 2 ? ['start-ellipsis'] : boundaryCount + 1 < totalPages - boundaryCount ? [boundaryCount + 1] : []),
    ...range(siblingsStart, siblingsEnd),
    ...(siblingsEnd < totalPages - boundaryCount - 1 ? ['end-ellipsis'] : totalPages - boundaryCount > boundaryCount ? [totalPages - boundaryCount] : []),
    ...endPages,
  ];

  const getPageInfo = () => {
    const total = Number.isFinite(totalItems) ? totalItems : totalPages * pageSize;
    if (total === 0) return 'No items';
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, total);
    return `Showing ${start}-${end} of ${total}`;
  };

  return (
    // Stacks on mobile so the page numbers never collide with the range label
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}>
      {showInfo && (
        <div className="text-xs sm:text-sm text-ink-muted order-2 sm:order-1">
          {getPageInfo()}
        </div>
      )}

      <nav className="flex items-center gap-1 order-1 sm:order-2">
        <Button
          variant="ghost"
          size="small"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-8 px-0"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {showNumbers && itemList.map((item, index) => {
          if (item === 'start-ellipsis' || item === 'end-ellipsis') {
            return (
              <span
                key={`ellipsis-${index}`}
                className="flex items-center justify-center w-8 h-8 text-ink-subtle"
              >
                <MoreHorizontal className="w-4 h-4" />
              </span>
            );
          }

          const page = typeof item === 'number' ? item : parseInt(item);
          const isCurrent = page === currentPage;

          return (
            <Button
              key={`page-${page}`}
              variant={isCurrent ? 'primary' : 'ghost'}
              size="small"
              onClick={() => handlePageChange(page)}
              className="min-w-8 px-2 tabular-nums"
              aria-current={isCurrent ? 'page' : undefined}
            >
              {page}
            </Button>
          );
        })}

        <Button
          variant="ghost"
          size="small"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-8 px-0"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </nav>
    </div>
  );
};

export default Pagination;
