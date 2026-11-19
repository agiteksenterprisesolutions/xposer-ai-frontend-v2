import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  EyeOff,
  X
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { reportsAPI, usersAPI } from '../../api';
import { useReportTypeNames } from '../../hooks/useReportTypeNames';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { intlLocale, isRtl } from '../../utils/locale';
import { useAuthStore } from '../../store/authStore';
import DashboardTour from '../../components/tour/DashboardTour';
import { parseServerDate } from '../../utils/formatters';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';
import { casePath } from '../../utils/navigation';
import { DEFAULT_PAGE_SIZE, normalizeListResponse } from '../../utils/pagination';
import TableSortControl from '../../components/ui/TableSortControl';
import { OwnerCell, SLA_CLOCKS, SLA_FILTERS, SlaBadge, SlaCell, TierBadge, ownerName, slaClock, slaUrgency } from '../../components/reports/CaseGovernance';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useOrgJurisdiction } from '../../hooks/useOrgJurisdiction';
import FlagBadge, { flagLabel } from '../../components/reports/FlagBadge';
import FlagFilter from '../../components/reports/FlagFilter';
import {
  useTableSort,
  byDate,
  byText,
  byRank,
  PRIORITY_RANK,
  STATUS_RANK,
} from '../../hooks/useTableSort';

const ALL_REPORTS_TOUR_KEY = 'xposer_all_reports_tour_seen';

// Who filed: ?anonymous=true (no account behind it) or false (filed from an
// account), sent to the API as is_anonymous.
// Labels: cases:list.filedBy.<value> and cases:list.filedByChip.<value>.
const FILED_BY = [{ value: 'true' }, { value: 'false' }];

/**
 * A report on a phone: what it is, where it stands and when it came in. A
 * third line appears only when something needs attention: high or critical
 * priority, or a deadline overdue or due soon. Everything else (owner, tier,
 * anonymity, routine priority) is on the case and in the desktop table.
 */
const URGENT_SLA = ['breached', 'due_soon'];
const URGENT_PRIORITY = ['high', 'critical'];

const ReportSummary = ({ report, typeName }) => {
  const urgentClocks = SLA_CLOCKS.map(({ key, short }) => ({ key, short, clock: slaClock(report, key) }))
    .filter(({ clock }) => URGENT_SLA.includes(clock?.state));
  const urgentPriority = URGENT_PRIORITY.includes(report.priority);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink" dir="ltr">#{report.report_number}</span>
        <StatusBadge status={report.status} />
      </div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-ink-secondary" dir="auto">{typeName ?? <Skeleton.Text className="w-32" />}</span>
        <span className="shrink-0 text-xs text-ink-muted">
          {parseServerDate(report.created_at)?.toLocaleDateString(intlLocale()) || ''}
        </span>
      </div>
      {(urgentPriority || urgentClocks.length > 0 || report.flags?.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {urgentPriority && <PriorityBadge priority={report.priority} />}
          {(report.flags || []).map((flag, i) => <FlagBadge key={`${flag.code}-${i}`} flag={flag} />)}
          {urgentClocks.map(({ key, short, clock }) => (
            <SlaBadge key={key} clock={clock} prefix={short} />
          ))}
        </div>
      )}
    </div>
  );
};

// Column order here is the column order in the table.
const buildSortColumns = (typeNameFor, nameFor, t) => ({
  report_number: { label: t('list.col.reportId'), defaultOrder: 'desc', value: byText('report_number') },
  created_at: { label: t('list.col.submittedOn'), defaultOrder: 'desc', value: byDate('created_at') },
  report_type_name: {
    label: t('list.col.category'),
    defaultOrder: 'asc',
    value: (report) => (typeNameFor(report) || '').toLowerCase(),
  },
  priority: { label: t('list.col.priority'), defaultOrder: 'desc', value: byRank('priority', PRIORITY_RANK) },
  assigned_to: {
    label: t('list.col.owner'),
    defaultOrder: 'asc',
    value: (report) => ownerName(report, nameFor).toLowerCase(),
  },
  sla: {
    label: t('list.col.deadlines'),
    defaultOrder: 'asc',
    // Overdue first, then due soon, then everything else.
    value: slaUrgency,
  },
  status: { label: t('list.col.status'), defaultOrder: 'asc', value: byRank('status', STATUS_RANK) },
});

const AllReports = () => {
  const { t, i18n } = useTranslation('cases');
  useSEO({
    title: t('list.seoTitle'),
    description: t('list.seoDescription'),
    noIndex: true,
  });
  const [reports, setReports] = useState([]);
  // Names for the Category column, from the shared cached list of types.
  const { types: reportTypes, typeName: typeNameFor } = useReportTypeNames();
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
  const filedBy = FILED_BY.find((f) => f.value === searchParams.get('anonymous'));
  // Cases with either deadline in this state (breached = overdue).
  const slaParam = searchParams.get('sla') || '';
  // Cases carrying one flag code (ROUTING_RULES.md §7).
  const flagParam = searchParams.get('flag') || '';
  // One person's cases, from the Users page after a role change strands them.
  const assigneeParam = searchParams.get('assigned_to') || '';
  const assigneeName = searchParams.get('assignee') || '';
  const { nameFor } = useOrgRoles();
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

  // The Category column sorts on the resolved type name, so the columns are
  // rebuilt whenever that resolver changes.
  const sortColumns = useMemo(() => buildSortColumns(typeNameFor, nameFor, t), [typeNameFor, nameFor, t]);

  // The API filters and paginates; re-filtering here would hide rows that
  // matched on fields this page doesn't render. Sorting is different:
  // `sort_by`/`order` go to the API, and the rows on screen are ordered here too so the column
  // still responds on a backend that ignores those parameters. Note this orders
  // the current page — with more than one page, the server decides which rows
  // land on it.
  // Flag filter suggestions: the org pack's regulatory triggers plus any flag
  // on the cases loaded so far (labels from whichever has one).
  const { pack: orgPack } = useOrgJurisdiction();
  const flagOptions = useMemo(() => {
    const byCode = new Map();
    (orgPack?.regulatory_triggers || []).forEach((trg) => trg?.code && byCode.set(String(trg.code).toUpperCase(), { ...trg, code: String(trg.code).toUpperCase() }));
    reports.forEach((r) => (r.flags || []).forEach((f) => f?.code && !byCode.has(f.code) && byCode.set(f.code, f)));
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [orgPack, reports]);

  const sort = useTableSort(reports, sortColumns, { defaultSortBy: 'created_at' });
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
        is_anonymous: filedBy ? filedBy.value === 'true' : undefined,
        sla: slaParam || undefined,
        flag: flagParam || undefined,
        assigned_to: assigneeParam || undefined,
        // The deadlines column is ordered on this page only.
        sort_by: sortBy === 'sla' ? undefined : sortBy,
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
  }, [currentPage, searchQuery, activeStatus, resolvedTypeId, priorityParam, filedBy, slaParam, flagParam, assigneeParam, sortBy, sortOrder]);

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
  }, [activeStatus, resolvedTypeId, priorityParam, filedBy, slaParam, flagParam, assigneeParam, sortBy, sortOrder]);

  const statusTabs = ['all', 'pending', 'in_progress', 'resolved', 'closed'].map((id) => ({
    id,
    label: t(`list.tab.${id}`),
  }));

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (activeTypeName) {
      chips.push({
        key: 'category',
        label: t('list.chip.category', { value: activeTypeName }),
        clear: () => updateFilters({ report_type_id: '', report_type: '' }),
      });
    }
    if (priorityParam) {
      chips.push({
        key: 'priority',
        label: t('list.chip.priority', { value: t(`common:priority.${priorityParam}`, { defaultValue: priorityParam }) }),
        clear: () => updateFilters({ priority: '' }),
      });
    }
    if (assigneeParam) {
      chips.push({
        key: 'assignee',
        label: t('list.chip.assignee', { value: assigneeName || t('list.chip.onePerson') }),
        clear: () => updateFilters({ assigned_to: '', assignee: '' }),
      });
    }
    if (flagParam) {
      const known = flagOptions.find((f) => f.code === flagParam);
      chips.push({
        key: 'flag',
        label: t('list.chip.flag', { value: known ? flagLabel(known, i18n.resolvedLanguage) : flagParam }),
        clear: () => updateFilters({ flag: '' }),
      });
    }
    if (filedBy) {
      chips.push({
        key: 'anonymous',
        label: t(`list.filedByChip.${filedBy.value}`),
        clear: () => updateFilters({ anonymous: '' }),
      });
    }
    return chips;
  }, [activeTypeName, priorityParam, assigneeParam, assigneeName, filedBy, flagParam, flagOptions, updateFilters, t, i18n.resolvedLanguage]);

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-all-reports"]',
        title: t('list.tour.allTitle'),
        content: t('list.tour.allBody'),
        placement: isRtl() ? 'left' : 'right',
        skipBeacon: true,
      });
    }

    steps.push(
      {
        target: '[data-tour="reports-search"]',
        title: t('list.tour.searchTitle'),
        content: t('list.tour.searchBody'),
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="reports-sort"]',
        title: t('list.tour.sortTitle'),
        content: t('list.tour.sortBody'),
        placement: 'bottom',
      },
      {
        target: '[data-tour="reports-tabs"]',
        title: t('list.tour.tabsTitle'),
        content: t('list.tour.tabsBody'),
        placement: 'bottom',
      },
      {
        target: '[data-tour="reports-table"]',
        title: t('list.tour.tableTitle'),
        content: t('list.tour.tableBody'),
        placement: 'top',
      }
    );

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: t('list.tour.accountTitle'),
      content: t('list.tour.accountBody'),
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop, t]);

  return (
    <div className="space-y-6">
      <DashboardTour ref={tourRef} storageKey={ALL_REPORTS_TOUR_KEY} steps={tourSteps} />

      {/* Search and Global Actions */}
      {/* Below lg the search takes its own row and the filters wrap. */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 lg:gap-4">
        <div className="relative w-full lg:w-96" data-tour="reports-search">
          <Input
            placeholder={t('list.searchPlaceholder')}
            aria-label={t('list.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          // startAdornment={<Search className="h-4 w-4 text-ink-subtle" />}
          />
        </div>
        {/* <div className="flex space-x-2 w-full sm:w-auto">
          <Button variant="secondary" startIcon={Download}>Export</Button>
          <Button variant="ghost" startIcon={Filter}>Advanced Filters</Button>
        </div> */}
        <div className="flex flex-wrap items-center lg:justify-end gap-2 sm:gap-3 min-w-0">
          <select
            aria-label={t('list.col.deadlines')}
            value={slaParam}
            onChange={(e) => updateFilters({ sla: e.target.value })}
            className={`h-9 shrink-0 rounded-lg border bg-surface px-2.5 text-sm outline-none focus:border-line-accent ${
              slaParam ? 'border-line-accent text-accent-fg' : 'border-line-strong text-ink-secondary'
            }`}
          >
            <option value="">{t('list.anyDeadline')}</option>
            {SLA_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <FlagFilter value={flagParam} onChange={(code) => updateFilters({ flag: code })} options={flagOptions} />
          <select
            aria-label={t('list.filedByLabel')}
            value={filedBy?.value || ''}
            onChange={(e) => updateFilters({ anonymous: e.target.value })}
            className={`h-9 shrink-0 rounded-lg border bg-surface px-2.5 text-sm outline-none focus:border-line-accent ${
              filedBy ? 'border-line-accent text-accent-fg' : 'border-line-strong text-ink-secondary'
            }`}
          >
            <option value="">{t('list.anyone')}</option>
            {FILED_BY.map((f) => (
              <option key={f.value} value={f.value}>
                {t(`list.filedBy.${f.value}`)}
              </option>
            ))}
          </select>
          <TableSortControl {...sort} id="reports" className="shrink-0" data-tour="reports-sort" />
          {loading ? (
            <Skeleton.Text className="w-20" />
          ) : (
            <span className="ms-auto lg:ms-0 text-sm text-ink-muted whitespace-nowrap tabular-nums">
              {t('list.count', { count: totalReports })}
            </span>
          )}
        </div>
      </div>

      {/* Filters arriving from a dashboard drill-down. Status has its own tab
          row, so only the extra filters need a chip. */}
      {activeFilterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">{t('list.filteredBy')}</span>
          {activeFilterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              aria-label={t('list.removeFilter', { filter: chip.label })}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-accent bg-accent-soft px-3 py-1 text-xs font-medium text-accent-fg hover:bg-hover"
            >
              <span dir="auto">{chip.label}</span>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => updateFilters({ report_type_id: '', report_type: '', priority: '', anonymous: '', assigned_to: '', assignee: '' })}
            className="text-xs font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            {t('list.clearAll')}
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
                  <Skeleton.Text key="t" className="w-20" />,
                  <Skeleton.Badge key="sla" className="w-16" />,
                  <Skeleton.Badge key="s" className="w-20" />,
                ]}
              />
            ) : filteredReports.length === 0 ? (
              <Table.Empty
                message={searchTerm ? t('list.emptySearch') : slaParam ? t(`list.emptySla.${slaParam}`, { defaultValue: t('list.empty') }) : t('list.empty')}
                description={searchTerm ? t('list.emptySearchHint') : t('list.emptyHint')}
                icon={FileText}
              />
            ) : (
              filteredReports.map((report) => (
                <Table.Row
                  key={report.id}
                  onClick={() => navigate(casePath(user?.organization_slug, report.id))}
                  className="cursor-pointer"
                  mobile={<ReportSummary report={report} typeName={typeNameFor(report)} />}
                >
                  <Table.Cell className="font-medium text-ink">
                    <div className="flex flex-col items-start gap-1">
                      <span dir="ltr">#{report.report_number}</span>
                      <TierBadge tier={report.confidentiality_tier} />
                      {report.is_anonymous && (
                        <span className="inline-flex items-center gap-1 text-xs font-normal text-ink-muted">
                          <EyeOff className="h-3 w-3" aria-hidden="true" />
                          {t('list.anonymous')}
                        </span>
                      )}
                      {report.flags?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {report.flags.map((flag, i) => <FlagBadge key={`${flag.code}-${i}`} flag={flag} />)}
                        </div>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-ink-muted">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 me-1.5" aria-hidden="true" />
                      {parseServerDate(report.created_at)?.toLocaleDateString(intlLocale()) || t('detail.notAvailable')}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Layers className="h-3 w-3 text-ink-subtle" aria-hidden="true" />
                      <span className="text-sm text-ink-secondary" dir="auto">
                        {typeNameFor(report) ?? <Skeleton.Text className="w-24" />}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <PriorityBadge priority={report.priority} />
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ink-secondary">
                    <OwnerCell report={report} nameFor={nameFor} />
                  </Table.Cell>
                  <Table.Cell>
                    <SlaCell report={report} />
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
