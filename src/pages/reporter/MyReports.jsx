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
import LoadingSpinner from '../../components/layout/LoadingSpinner';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';
import { isDraftReport } from '../../utils/reports';

const MY_REPORTS_TOUR_KEY = 'xposer_my_reports_tour_seen';

// Matches the `sortField` on each sortable column below, plus the dates the
// table doesn't show a column for but are still useful to order by.
const SORT_COLUMNS = {
    created_at: { label: 'Newest', defaultOrder: 'desc', value: byDate('created_at') },
    updated_at: { label: 'Last Updated', defaultOrder: 'desc', value: byDate('updated_at') },
    report_number: { label: 'Report ID', defaultOrder: 'desc', value: byText('report_number') },
    status: { label: 'Processing Status', defaultOrder: 'asc', value: byRank('status', STATUS_RANK) },
    submission_status: { label: 'Submission Status', defaultOrder: 'asc', value: byText('submission_status') },
    priority: { label: 'Priority', defaultOrder: 'desc', value: byRank('priority', PRIORITY_RANK) },
};

const MyReports = () => {
    useSEO({
        title: 'My Reports',
        description: 'Every report you have submitted, with its current status and latest updates.',
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
        { value: '', label: 'All Status' },
        { value: 'pending', label: 'Pending' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'under_review', label: 'Under Review' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'closed', label: 'Closed' },
        { value: 'rejected', label: 'Rejected' },
    ];

    const priorityOptions = [
        { value: '', label: 'All Priority' },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
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

    const sort = useTableSort(filteredReports, SORT_COLUMNS, { defaultSortBy: 'created_at' });
    const { sortedRows: visibleReports, getHeaderProps } = sort;

    // Table columns definition
    const columns = [
        {
            header: 'Report ID',
            accessor: 'report_number',
            sortable: true,
            cell: (value) => (
                <span className="font-mono text-sm font-medium text-ink">
                    #{value}
                </span>
            ),
        },
        {
            header: 'Report No.',
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
            header: 'Processing Status',
            accessor: 'status',
            sortable: true,
            cell: (value) => <StatusBadge status={value} />,
        },
        {
            header: 'Submission Status',
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
        //             <MessageSquare className="w-4 h-4 mr-1.5" />
        //             <span className="text-sm">{value || 0}</span>
        //         </div>
        //     ),
        // },
        {
            header: 'Actions',
            cell: (_, row) => (
                <div className="flex justify-start gap-1">
                    <Link to={`/${user?.organization_slug}/reporter/reports/${row.id}`}>
                        <Button variant="ghost" size="small" aria-label="View Details">
                            <Eye className="w-4 h-4 text-ink-muted" />
                        </Button>
                    </Link>
                    {isDraftReport(row) && (
                        // Row clicks open the detail page, so keep the click here.
                        <Link
                            to={`/${user?.organization_slug}/reporter/reports/${row.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Button variant="ghost" size="small" aria-label="Edit Draft" title="Edit draft">
                                <Pencil className="w-4 h-4 text-accent-fg" />
                            </Button>
                        </Link>
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
                title: 'My Reports',
                content: 'Every report you have submitted lives here, with its status and history.',
                placement: 'right',
                skipBeacon: true,
            });
        }

        steps.push({
            target: '[data-tour="myreports-submit"]',
            title: 'Submit a new report',
            content: 'File a new report tied to your account at any time.',
            placement: 'bottom',
            skipBeacon: !isDesktop,
        });

        steps.push(
            {
                target: '[data-tour="myreports-filters"]',
                title: 'Search & filter',
                content: 'Search by ID, or narrow the list by status, priority, and sort order.',
                placement: 'bottom',
            },
            {
                target: '[data-tour="myreports-view-toggle"]',
                title: 'Switch views',
                content: 'Toggle between a compact table and a card grid, whichever you prefer.',
                placement: 'left',
            },
            {
                target: '[data-tour="myreports-results"]',
                title: 'Your reports',
                content: 'Click any report to view its full details and message the compliance team.',
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

    if (isLoading && !reports) {
        return <LoadingSpinner message="Loading reports..." />;
    }

    return (
        <div className="space-y-6">
            <DashboardTour ref={tourRef} storageKey={MY_REPORTS_TOUR_KEY} steps={tourSteps} />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-ink">My Reports</h1>
                    <p className="text-ink-muted mt-1">
                        Track status and communicate with the compliance team
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Link to={`/${user?.organization_slug}/reporter/submit`} data-tour="myreports-submit">
                        <Button variant="secondary" startIcon={Plus}>
                            Submit New Report
                        </Button>
                    </Link>
                </div>
            </div>

            <Card>
                {/* Filters and Search */}
                <div className="flex flex-col md:flex-row gap-4 mb-6" data-tour="myreports-filters">
                    <div className="flex-1">
                        <form onSubmit={handleSearch} className="relative">
                            {/* <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-subtle h-5 w-5" /> */}
                            <Input
                                placeholder="Search by ID or report number..."
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
                                placeholder="Status"
                            />
                        </div>
                        <div className="w-32 md:w-40">
                            <Select
                                options={priorityOptions}
                                value={filters.priority || ''}
                                onChange={(e) => handleFilterChange('priority', e.target.value)}
                                placeholder="Priority"
                            />
                        </div>
                        <TableSortControl {...sort} id="my-reports" />
                        {(filters.status || filters.priority || filters.search) && (
                            <Button
                                variant="ghost"
                                onClick={handleClearFilters}
                                className="text-ink-muted hover:text-danger-fg"
                                startIcon={X}
                                title="Clear Filters"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                </div>

                {/* View Toggle */}
                <div className="flex justify-end mb-4" data-tour="myreports-view-toggle">
                    <div className="flex bg-active p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'table'
                                ? 'bg-surface shadow-sm text-ink'
                                : 'text-ink-muted hover:text-ink-secondary'
                                }`}
                            title="Table View"
                        >
                            <div className="w-5 h-5 flex flex-col justify-center gap-1">
                                <div className="h-0.5 bg-current w-full" />
                                <div className="h-0.5 bg-current w-full" />
                                <div className="h-0.5 bg-current w-full" />
                            </div>
                        </button>
                        <button
                            onClick={() => setViewMode('card')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'card'
                                ? 'bg-surface shadow-sm text-ink'
                                : 'text-ink-muted hover:text-ink-secondary'
                                }`}
                            title="Grid View"
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
                    {visibleReports.length === 0 ? (
                        <TableEmpty
                            asRow={false}
                            message={
                                filters.search || filters.status || filters.priority
                                    ? "No reports found matching your filters."
                                    : "You haven't submitted any reports yet."
                            }
                            description={
                                !(filters.search || filters.status || filters.priority) &&
                                "Submit your first report to see it tracked here."
                            }
                            action={
                                !(filters.search || filters.status || filters.priority) && (
                                    <Link to={`/${user?.organization_slug}/reporter/submit`}>
                                        <Button size="small" className="mt-4" variant="secondary">
                                            Submit Report
                                        </Button>
                                    </Link>
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
