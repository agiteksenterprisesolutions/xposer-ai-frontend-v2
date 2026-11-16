import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
    Eye,
    Pencil,
    Plus,
    X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useReports } from '../../hooks/useReports';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Select } from '../../components/ui/Input';
import ReportCard from '../../components/reports/ReportCard';
import Table, { TableEmpty } from '../../components/ui/Table';
import TableSortControl from '../../components/ui/TableSortControl';
import {
    useTableSort,
    byDate,
    byText,
    byRank,
    PRIORITY_RANK,
    STATUS_RANK,
} from '../../hooks/useTableSort';
import { StatusBadge } from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import { ReportGridCardSkeleton } from '../../components/reports/ReportCard';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';
import { isDraftReport } from '../../utils/reports';
import { useTranslation } from 'react-i18next';
import { isRtl } from '../../utils/locale';

// Tour placements are written for left-to-right; Arabic mirrors the sidebar.
const side = (placement) =>
    isRtl() ? ({ left: 'right', right: 'left' }[placement] || placement) : placement;

const MY_REPORTS_TOUR_KEY = 'xposer_my_reports_tour_seen';

// Matches the `sortField` on each sortable column below, plus the dates the
// table doesn't show a column for but are still useful to order by. Labels
// are read when the page renders, so they follow the interface language.
const sortColumns = (t) => ({
    created_at: { label: t('myReports.sortNewest'), defaultOrder: 'desc', value: byDate('created_at') },
    updated_at: { label: t('myReports.sortLastUpdated'), defaultOrder: 'desc', value: byDate('updated_at') },
    report_number: { label: t('myReports.colReportId'), defaultOrder: 'desc', value: byText('report_number') },
    status: { label: t('myReports.colProcessingStatus'), defaultOrder: 'asc', value: byRank('status', STATUS_RANK) },
    submission_status: { label: t('myReports.colSubmissionStatus'), defaultOrder: 'asc', value: byText('submission_status') },
    priority: { label: t('myReports.sortPriority'), defaultOrder: 'desc', value: byRank('priority', PRIORITY_RANK) },
});

const MyReports = () => {
    const { t, i18n } = useTranslation('reporter');
    useSEO({
        title: t('seo.myReportsTitle'),
        description: t('seo.myReportsDescription'),
        noIndex: true,
    });
    const { user } = useAuthStore();
    const {
        fetchMyReports,
        reports,
        isLoading,
        filters,
        setFilters,
        clearFilters
    } = useReports();
    const [searchParams, setSearchParams] = useSearchParams();
    const [viewMode, setViewMode] = useState('table');
    const [selectedReports, setSelectedReports] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const tourRef = useRef(null);
    const isDesktop = useIsDesktop();

    // Initialize filters from URL
    useEffect(() => {
        const status = searchParams.get('status');
        const priority = searchParams.get('priority');
        const search = searchParams.get('search');

        const newFilters = {};
        if (status) newFilters.status = status;
        if (priority) newFilters.priority = priority;
        if (search) {
            newFilters.search = search;
            setSearchQuery(search);
        }

        if (Object.keys(newFilters).length > 0) {
            setFilters(newFilters);
        }

        if (user && !user.is_anonymous) {
            fetchMyReports();
        }
    }, [user]);

    // Update URL when filters change. This merges into the existing query
    // string rather than replacing it — rebuilding from scratch dropped the
    // sort params on the first render and on every filter change.
    useEffect(() => {
        const next = new URLSearchParams(searchParams);
        const apply = (key, value) => {
            if (value) next.set(key, value);
            else next.delete(key);
        };
        apply('status', filters.status);
        apply('priority', filters.priority);
        apply('search', filters.search);

        // Writing an identical query string would still push a history entry.
        if (next.toString() !== searchParams.toString()) {
            setSearchParams(next, { replace: true });
        }
    }, [filters, searchParams, setSearchParams]);

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchQuery(value);
        setFilters({ ...filters, search: value });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        setFilters({ ...filters, search: searchQuery });
    };

    const handleFilterChange = (key, value) => {
        setFilters({ ...filters, [key]: value });
    };

    const handleClearFilters = () => {
        clearFilters();
        setSearchQuery('');
    };

    const handleSelectReport = (reportId) => {
        setSelectedReports(prev =>
            prev.includes(reportId)
                ? prev.filter(id => id !== reportId)
                : [...prev, reportId]
        );
    };

    const handleSelectAll = () => {
        if (selectedReports.length === reports.length) {
            setSelectedReports([]);
        } else {
            setSelectedReports(reports.map(r => r.id));
        }
    };

    const statusOptions = [
        { value: '', label: t('myReports.allStatuses') },
        ...['pending', 'in_progress', 'under_review', 'resolved', 'closed', 'rejected'].map((value) => ({
            value,
            label: t(`common:reportStatus.${value}`),
        })),
    ];

    const priorityOptions = [
        { value: '', label: t('myReports.allPriorities') },
        ...['low', 'medium', 'high', 'critical'].map((value) => ({
            value,
            label: t(`common:priority.${value}`),
        })),
    ];


    // Filter reports based on search query
    const filteredReports = React.useMemo(() => {
        if (!reports) return [];

        let result = [...reports];

        // Apply status filter
        if (filters.status) {
            result = result.filter(report => report.status === filters.status);
        }

        // Apply priority filter
        if (filters.priority) {
            result = result.filter(report => report.priority === filters.priority);
        }

        // Apply search filter
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            result = result.filter(report =>
                (report?.title?.split('-')[0] || "").toLowerCase().includes(searchLower) ||
                (report.description || "").toLowerCase().includes(searchLower) ||
                (report.report_number || "").toLowerCase().includes(searchLower) ||
                (report.report_type_name || "").toLowerCase().includes(searchLower) ||
                (report.status || "").toLowerCase().includes(searchLower) ||
                report.tags?.some(tag => tag?.toLowerCase().includes(searchLower))
            );
        }

        // Ordering is handled by `useTableSort` below, so that the column
        // headers, the order-by control, and the card view all read one state.
        return result;
    }, [reports, filters]);

    const SORT_COLUMNS = useMemo(() => sortColumns(t), [t, i18n.resolvedLanguage]);
    const sort = useTableSort(filteredReports, SORT_COLUMNS, { defaultSortBy: 'created_at' });
    const { sortedRows: visibleReports, getHeaderProps } = sort;

    // Table columns definition
    const columns = [
        {
            header: t('myReports.colReportId'),
            accessor: 'report_number',
            sortable: true,
            cell: (value) => (
                <span className="font-mono text-sm font-medium text-ink">
                    #{value}
                </span>
            ),
        },
        {
            header: t('myReports.colReportNo'),
            accessor: 'report_number',
            sortable: true,
            className: 'w-1/3',
            cell: (value, row) => (
                <div>
                    <div className="text-sm font-medium text-ink truncate max-w-xs" title={value}>
                        {value}
                    </div>

                </div>
            ),
        },
        {
            header: t('myReports.colProcessingStatus'),
            accessor: 'status',
            sortable: true,
            cell: (value) => <StatusBadge status={value} />,
        },
        {
            header: t('myReports.colSubmissionStatus'),
            accessor: 'submission_status',
            sortable: true,
            cell: (value) => <StatusBadge status={value} />,
        },
        // {
        //     header: 'Priority',
        //     accessor: 'priority',
        //     cell: (value) => <PriorityBadge priority={value} />,
        // },
        // {
        //     header: 'Messages',
        //     accessor: 'messages_count',
        //     cell: (value) => (
        //         <div className="flex items-center text-ink-muted">
        //             <MessageSquare className="w-4 h-4 me-1.5" />
        //             <span className="text-sm">{value || 0}</span>
        //         </div>
        //     ),
        // },
        {
            key: 'actions',
            header: t('myReports.colActions'),
            cell: (_, row) => (
                <div className="flex justify-start gap-1">
                    <Button variant="ghost" size="small" aria-label={t('myReports.viewDetails')} to={`/${user?.organization_slug}/reporter/reports/${row.id}`}>
                            <Eye className="w-4 h-4 text-ink-muted" />
                        </Button>
                    {isDraftReport(row) && (
                        // Row clicks open the detail page, so keep the click here.
                        <Button variant="ghost" size="small" aria-label={t('myReports.editDraft')} title={t('myReports.editDraft')} to={`/${user?.organization_slug}/reporter/reports/${row.id}/edit`} onClick={(e) => e.stopPropagation()}>
                                <Pencil className="w-4 h-4 text-accent-fg" />
                            </Button>
                    )}
                </div>
            ),
        },
    ];

    const tourSteps = useMemo(() => {
        const steps = [];
        if (isDesktop) {
            steps.push({
                target: '[data-tour="sidebar-my-reports"]',
                title: t('tour.reportsTitle'),
                content: t('tour.myReportsNavContent'),
                placement: side('right'),
                skipBeacon: true,
            });
        }

        steps.push({
            target: '[data-tour="myreports-submit"]',
            title: t('tour.newReportTitle'),
            content: t('tour.newReportContent'),
            placement: 'bottom',
            skipBeacon: !isDesktop,
        });

        steps.push(
            {
                target: '[data-tour="myreports-filters"]',
                title: t('tour.filtersTitle'),
                content: t('tour.filtersContent'),
                placement: 'bottom',
            },
            {
                target: '[data-tour="myreports-view-toggle"]',
                title: t('tour.viewsTitle'),
                content: t('tour.viewsContent'),
                placement: side('left'),
            },
            {
                target: '[data-tour="myreports-results"]',
                title: t('tour.resultsTitle'),
                content: t('tour.resultsContent'),
                placement: 'top',
            }
        );

        steps.push({
            target: '[data-tour="tour-user-menu"]',
            title: t('tour.accountTitle'),
            content: t('tour.accountContent'),
            placement: 'bottom',
        });

        return steps;
    }, [isDesktop, t, i18n.resolvedLanguage]);

    // First load: the same table (or cards), with placeholder rows — never the
    // empty state, which would say there are no reports before we know.
    const firstLoad = isLoading && !(reports && reports.length);
    const SKELETON_CELLS = {
        report_number: <Skeleton.Text className="w-20" />,
        status: <Skeleton.Badge className="w-16" />,
        submission_status: <Skeleton.Badge className="w-20" />,
    };
    const skeletonColumns = columns.map((column, index) => ({
        ...column,
        cell: () =>
            column.key === 'actions' ? (
                <div className="flex gap-1">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
            ) : index === 1 ? (
                <Skeleton.Text className="w-24" />
            ) : (
                SKELETON_CELLS[column.accessor] || <Skeleton.Text className="w-20" />
            ),
    }));
    const skeletonRows = Array.from({ length: 5 }, (_, id) => ({ id: `skeleton-${id}` }));

    return (
        <div className="space-y-6">
            <DashboardTour ref={tourRef} storageKey={MY_REPORTS_TOUR_KEY} steps={tourSteps} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-ink">{t('myReports.title')}</h1>
                    <p className="text-ink-muted mt-1">
                        {t('myReports.subtitle')}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="secondary" startIcon={Plus} to={`/${user?.organization_slug}/reporter/submit`} data-tour="myreports-submit">
                            {t('myReports.submitNew')}
                        </Button>
                </div>
            </div>

            <Card>
                {/* Filters and Search */}
                <div className="flex flex-col md:flex-row gap-4 mb-6" data-tour="myreports-filters">
                    <div className="flex-1">
                        <form onSubmit={handleSearch} className="relative">
                            {/* <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-ink-subtle h-5 w-5" /> */}
                            <Input
                                placeholder={t('myReports.searchPlaceholder')}
                                aria-label={t('myReports.searchLabel')}
                                className="w-full"
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
                        </form>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="w-32 md:w-40">
                            <Select
                                options={statusOptions}
                                value={filters.status || ''}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                placeholder={t('myReports.statusPlaceholder')}
                                aria-label={t('myReports.statusPlaceholder')}
                            />
                        </div>
                        <div className="w-32 md:w-40">
                            <Select
                                options={priorityOptions}
                                value={filters.priority || ''}
                                onChange={(e) => handleFilterChange('priority', e.target.value)}
                                placeholder={t('myReports.priorityPlaceholder')}
                                aria-label={t('myReports.priorityPlaceholder')}
                            />
                        </div>
                        <TableSortControl {...sort} id="my-reports" />
                        {(filters.status || filters.priority || filters.search) && (
                            <Button
                                variant="ghost"
                                onClick={handleClearFilters}
                                className="text-ink-muted hover:text-danger-fg"
                                startIcon={X}
                                title={t('myReports.clearFilters')}
                            >
                                {t('myReports.clear')}
                            </Button>
                        )}
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex justify-end mb-4" data-tour="myreports-view-toggle">
                    <div className="flex bg-active p-1 rounded-lg" role="group" aria-label={t('myReports.viewToggle')}>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            aria-pressed={viewMode === 'table'}
                            aria-label={t('myReports.tableView')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'table'
                                ? 'bg-surface shadow-sm text-ink'
                                : 'text-ink-muted hover:text-ink-secondary'
                                }`}
                            title={t('myReports.tableView')}
                        >
                            <div className="w-5 h-5 flex flex-col justify-center gap-1">
                                <div className="h-0.5 bg-current w-full" />
                                <div className="h-0.5 bg-current w-full" />
                                <div className="h-0.5 bg-current w-full" />
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('card')}
                            aria-pressed={viewMode === 'card'}
                            aria-label={t('myReports.gridView')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'card'
                                ? 'bg-surface shadow-sm text-ink'
                                : 'text-ink-muted hover:text-ink-secondary'
                                }`}
                            title={t('myReports.gridView')}
                        >
                            <div className="w-5 h-5 grid grid-cols-2 gap-0.5">
                                <div className="bg-current rounded-sm" />
                                <div className="bg-current rounded-sm" />
                                <div className="bg-current rounded-sm" />
                                <div className="bg-current rounded-sm" />
                            </div>
                        </button>
                    </div>
                </div>

                {/* Reports Content */}
                <div data-tour="myreports-results">
                    {firstLoad ? (
                        viewMode === 'table' ? (
                            <div className="overflow-hidden rounded-lg border border-line" aria-busy="true">
                                <Table columns={skeletonColumns} data={skeletonRows} getSortProps={getHeaderProps} />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true">
                                <ReportGridCardSkeleton />
                                <ReportGridCardSkeleton />
                            </div>
                        )
                    ) : visibleReports.length === 0 ? (
                        <TableEmpty
                            asRow={false}
                            message={
                                filters.search || filters.status || filters.priority
                                    ? t('myReports.emptyFiltered')
                                    : t('myReports.emptyNone')
                            }
                            description={
                                !(filters.search || filters.status || filters.priority) &&
                                t('myReports.emptyDescription')
                            }
                            action={
                                !(filters.search || filters.status || filters.priority) && (
                                    <Button size="small" className="mt-4" variant="secondary" to={`/${user?.organization_slug}/reporter/submit`}>
                                            {t('myReports.submitReport')}
                                        </Button>
                                )
                            }
                        />
                    ) : viewMode === 'table' ? (
                        <div className="overflow-hidden rounded-lg border border-line">
                            <Table
                                columns={columns}
                                data={visibleReports}
                                getSortProps={getHeaderProps}
                                onRowClick={(row) => navigate(`/${user ? user.organization_slug : ''}/reporter/reports/${row.id}`)}
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {visibleReports.map((report) => (
                                <ReportCard
                                    key={report.id}
                                    report={report}
                                    onClick={() => navigate(`/${user ? user.organization_slug : ''}/reporter/reports/${report.id}`)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default MyReports;
