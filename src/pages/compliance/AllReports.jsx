import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  X
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { reportsAPI, reportTypesAPI, usersAPI } from '../../api';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import DashboardTour from '../../components/tour/DashboardTour';
import { parseServerDate } from '../../utils/formatters';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';
import { casePath } from '../../utils/navigation';
import { DEFAULT_PAGE_SIZE, normalizeListResponse } from '../../utils/pagination';
import TableSortControl from '../../components/ui/TableSortControl';
import {
  useTableSort,
  byDate,
  byText,
  byRank,
  PRIORITY_RANK,
  STATUS_RANK,
} from '../../hooks/useTableSort';

const ALL_REPORTS_TOUR_KEY = 'xposer_all_reports_tour_seen';

// Column order here is the column order in the table.
const buildSortColumns = (typeNameFor) => ({
  report_number: { label: 'Report ID', defaultOrder: 'desc', value: byText('report_number') },
  created_at: { label: 'Submitted On', defaultOrder: 'desc', value: byDate('created_at') },
  report_type_name: {
    label: 'Category',
    defaultOrder: 'asc',
    value: (report) => typeNameFor(report).toLowerCase(),
  },
  priority: { label: 'Priority', defaultOrder: 'desc', value: byRank('priority', PRIORITY_RANK) },
  assigned_by: {
    label: 'Assigned By',
    defaultOrder: 'asc',
    value: (report) => (report?.assigned_by?.username || '').toLowerCase(),
  },
  assigned_to: {
    label: 'Assigned To',
    defaultOrder: 'asc',
    value: (report) => (report?.assigned_to?.username || '').toLowerCase(),
  },
  status: { label: 'Status', defaultOrder: 'asc', value: byRank('status', STATUS_RANK) },
});

const AllReports = () => {
  useSEO({
    title: 'All Reports',
    description: 'Browse, filter, and open every report submitted to your organization.',
    noIndex: true,
  });
  const [reports, setReports] = useState([]);
  const [reportTypes, setReportTypes] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);
  // The query string is the source of truth for every filter, so a dashboard
  // link like ?status=pending lands here already narrowed — and the filtered
  // view survives a refresh or a shared URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = searchParams.get('status') || 'all';
  const typeIdParam = searchParams.get('report_type_id') || '';
  const typeNameParam = searchParams.get('report_type') || '';
  const priorityParam = searchParams.get('priority') || '';
  const anonymousOnly = searchParams.get('anonymous') === 'true';
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  // Search hits the server, so it is debounced rather than filtered locally.
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReports, setTotalReports] = useState(0);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();

  // Lookup data is fetched once. Keeping it inside the paged fetch made
  // fetchReports depend on the state it sets, which re-fired the effect on
  // every load.
  useEffect(() => {
    let cancelled = false;

    const fetchLookups = async () => {
      try {
        const types = await reportTypesAPI.getReportTypes();
        if (!cancelled) setReportTypes(normalizeListResponse(types).items);
      } catch (typesError) {
        console.warn('Unable to fetch report types:', typesError);
      }

      try {
        const usersResponse = await usersAPI.getAllUsers({ page_size: 100 });
        const usersMap = normalizeListResponse(usersResponse).items.reduce((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});
        if (!cancelled) setUsersById(usersMap);
      } catch (usersError) {
        console.warn('Unable to fetch users for assignment names:', usersError);
      }
    };

    fetchLookups();
    return () => {
      cancelled = true;
    };
  }, []);

  // Callers pass only the keys they touch; anything set to a falsy value is
  // dropped so the URL never carries empty filters.
  const updateFilters = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '' || value === false) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Dashboard links may only know a category by name, so resolve it against the
  // report types once they arrive.
  const resolvedTypeId = useMemo(() => {
    if (typeIdParam) return typeIdParam;
    if (!typeNameParam) return '';
    return reportTypes.find((t) => t.name === typeNameParam)?.id || '';
  }, [typeIdParam, typeNameParam, reportTypes]);

  const activeTypeName = useMemo(() => (
    reportTypes.find((t) => t.id === resolvedTypeId)?.name || typeNameParam
  ), [reportTypes, resolvedTypeId, typeNameParam]);

  // Both the Category column and its sort key need the same fallback chain.
  const typeNameFor = useCallback((report) => (
    report.report_type_name
    || reportTypes.find((t) => t.id === report.report_type_id)?.name
    || 'AI Assisstant'
  ), [reportTypes]);

  // The API filters and paginates; re-filtering here would hide rows that
  // matched on fields this page doesn't render. The one exception is the
  // anonymous flag: it is sent to the API, but older backends ignore the
  // parameter, so the rows are checked here too rather than showing named
  // reports under an "Anonymous only" chip.
  const visibleReports = useMemo(() => (
    anonymousOnly ? reports.filter((report) => report.is_anonymous) : reports
  ), [reports, anonymousOnly]);

  // The Category column sorts on the resolved type name, so the columns are
  // rebuilt whenever that resolver changes.
  const sortColumns = useMemo(() => buildSortColumns(typeNameFor), [typeNameFor]);

  // Sorting gets the same treatment as the anonymous filter: `sort_by`/`order`
  // go to the API, and the rows on screen are ordered here too so the column
  // still responds on a backend that ignores those parameters. Note this orders
  // the current page — with more than one page, the server decides which rows
  // land on it.
  const sort = useTableSort(visibleReports, sortColumns, { defaultSortBy: 'created_at' });
  const { sortBy, sortOrder, sortedRows: filteredReports, getHeaderProps } = sort;

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        page_size: DEFAULT_PAGE_SIZE,
        status: activeStatus !== 'all' ? activeStatus : undefined,
        search: searchQuery.trim() || undefined,
        report_type_id: resolvedTypeId || undefined,
        priority: priorityParam || undefined,
        is_anonymous: anonymousOnly ? true : undefined,
        sort_by: sortBy,
        order: sortOrder,
      };
      const response = await reportsAPI.getAllReports(params);

      const { items, total, totalPages: pages } = normalizeListResponse(response);
      setReports(items);
      setTotalPages(pages);
      setTotalReports(total);
    } catch (error) {
      console.error('Error fetching all reports:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, activeStatus, resolvedTypeId, priorityParam, anonymousOnly, sortBy, sortOrder]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Debounce keystrokes into the query that actually hits the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchTerm);
      setCurrentPage(1);
      updateFilters({ search: searchTerm.trim() });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, updateFilters]);

  // Any filter change puts us back on page 1 — page 4 of the old result set is
  // rarely a valid page of the new one.
  useEffect(() => {
    setCurrentPage(1);
  }, [activeStatus, resolvedTypeId, priorityParam, anonymousOnly, sortBy, sortOrder]);

  const statusTabs = [
    { id: 'all', label: 'All Reports' },
    { id: 'pending', label: 'Pending Review' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'closed', label: 'Closed' }
  ];

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (activeTypeName) {
      chips.push({
        key: 'category',
        label: `Category: ${activeTypeName}`,
        clear: () => updateFilters({ report_type_id: '', report_type: '' }),
      });
    }
    if (priorityParam) {
      chips.push({
        key: 'priority',
        label: `Priority: ${priorityParam}`,
        clear: () => updateFilters({ priority: '' }),
      });
    }
    if (anonymousOnly) {
      chips.push({
        key: 'anonymous',
        label: 'Anonymous only',
        clear: () => updateFilters({ anonymous: '' }),
      });
    }
    return chips;
  }, [activeTypeName, priorityParam, anonymousOnly, updateFilters]);

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-all-reports"]',
        title: 'All Reports',
        content: 'Every report submitted to your organization lives here, in one place.',
        placement: 'right',
        skipBeacon: true,
      });
    }

    steps.push(
      {
        target: '[data-tour="reports-search"]',
        title: 'Search reports',
        content: 'Look up a report by ID, category, or the reporter/assignee username.',
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="reports-sort"]',
        title: 'Order the list',
        content: 'Sort by date, report ID, category, priority, assignee, or status — or click a column header.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="reports-tabs"]',
        title: 'Filter by status',
        content: 'Quickly narrow the list to pending, in-progress, resolved, or closed reports.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="reports-table"]',
        title: 'Report list',
        content: 'Click any row to open the full case, review details, and take action.',
        placement: 'top',
      }
    );

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: 'Your account',
      content: 'Manage your profile or log out from here.',
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop]);

  return (
    <div className="space-y-6">
      <DashboardTour ref={tourRef} storageKey={ALL_REPORTS_TOUR_KEY} steps={tourSteps} />

      {/* Search and Global Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96" data-tour="reports-search">
          <Input
            placeholder="Search by ID, category, or reporter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          // startAdornment={<Search className="h-4 w-4 text-ink-subtle" />}
          />
        </div>
        {/* <div className="flex space-x-2 w-full sm:w-auto">
          <Button variant="secondary" startIcon={Download}>Export</Button>
          <Button variant="ghost" startIcon={Filter}>Advanced Filters</Button>
        </div> */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto">
          <TableSortControl {...sort} id="reports" className="shrink-0" data-tour="reports-sort" />
          {loading ? (
            <Skeleton.Text className="w-20" />
          ) : (
            <span className="text-sm text-ink-muted whitespace-nowrap tabular-nums">
              {totalReports} report{totalReports === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* Filters arriving from a dashboard drill-down. Status has its own tab
          row, so only the extra filters need a chip. */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">Filtered by</span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-accent bg-accent-soft px-3 py-1 text-xs font-medium text-accent-fg capitalize hover:bg-hover"
            >
              {chip.label}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => updateFilters({ report_type_id: '', report_type: '', priority: '', anonymous: '' })}
            className="text-xs font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-line" data-tour="reports-tabs">
        <nav className="-mb-px flex gap-6 sm:gap-8 overflow-x-auto overflow-y-hidden scrollbar-none">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => updateFilters({ status: tab.id === 'all' ? '' : tab.id })}
              className={`
                shrink-0 whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeStatus === tab.id
                  ? 'border-line-accent text-accent-fg'
                  : 'border-transparent text-ink-muted hover:text-ink-secondary hover:border-line-strong'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Reports Table */}
      <Card padding="none" data-tour="reports-table">
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              {Object.entries(sortColumns).map(([field, column]) => (
                <Table.Head key={field} {...getHeaderProps(field)}>
                  {column.label}
                </Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading
                rows={DEFAULT_PAGE_SIZE}
                cells={[
                  <Skeleton.Text key="id" className="w-20" />,
                  <Skeleton.Text key="d" className="w-20" />,
                  <Skeleton.Text key="c" className="w-24" />,
                  <Skeleton.Badge key="p" className="w-14" />,
                  <Skeleton.Text key="b" className="w-16" />,
                  <Skeleton.Text key="t" className="w-16" />,
                  <Skeleton.Badge key="s" className="w-20" />,
                ]}
              />
            ) : filteredReports.length === 0 ? (
              <Table.Empty
                message={searchTerm ? 'No matching reports' : 'No reports found'}
                description={searchTerm ? 'Try a different search term.' : 'Try adjusting your filters.'}
                icon={FileText}
              />
            ) : (
              filteredReports.map((report) => (
                <Table.Row
                  key={report.id}
                  onClick={() => navigate(casePath(user?.organization_slug, report.id))}
                  className="cursor-pointer"
                >
                  <Table.Cell className="font-medium text-ink">
                    #{report.report_number}
                  </Table.Cell>
                  <Table.Cell className="text-ink-muted">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 mr-1.5" />
                      {parseServerDate(report.created_at)?.toLocaleDateString() || 'N/A'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center space-x-2">
                      <Layers className="h-3 w-3 text-ink-subtle" />
                      <span className="text-sm text-ink-secondary">
                        {typeNameFor(report)}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <PriorityBadge priority={report.priority} />
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ink-muted">
                    <div className="flex items-center space-x-2">
                      <span>{report?.assigned_by?.username || ""}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ink-muted">
                    <div className="flex items-center space-x-2">
                      <span>{report?.assigned_to?.username || ""}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={report.status} />
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-line">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalReports}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={(page) => {
                setCurrentPage(page);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default AllReports;
