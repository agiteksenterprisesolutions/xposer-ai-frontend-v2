import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  FileText,
  Settings,
  AlertTriangle,
  Layers,
  Filter,
  X,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { reportsAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import { tone } from '../../utils/tone';
import useSEO from '../../hooks/useSEO';

const ADMIN_TOUR_KEY = 'xposer_admin_dashboard_tour_seen';

const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#e11d48', '#4f46e5'];

const formatDateInput = (date) => date.toISOString().slice(0, 10);
const toStartOfDayIso = (dateString) => new Date(`${dateString}T00:00:00.000Z`).toISOString();
const toEndOfDayIso = (dateString) => new Date(`${dateString}T23:59:59.999Z`).toISOString();

const now = new Date();
const DEFAULT_FILTERS = {
  start_date: formatDateInput(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
  end_date: formatDateInput(now),
  interval: 'day'
};

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  // `filters` is what the page is showing; `draftFilters` is what the inputs
  // hold until Apply is pressed. Splitting them stops every keystroke in a
  // date field from firing a request.
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useSEO({
    title: 'Admin Dashboard',
    description: 'Platform-wide reporting activity, user counts, and category analytics.',
    noIndex: true,
  });

  const fetchStats = useCallback(async (activeFilters) => {
    setLoading(true);
    try {
      const data = await reportsAPI.getDetailedStats({
        start_date: toStartOfDayIso(activeFilters.start_date),
        end_date: toEndOfDayIso(activeFilters.end_date),
        interval: activeFilters.interval
      });
      setStats(data);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(filters);
  }, [fetchStats, filters]);

  // Helper to safely extract a value from the stats.summary array
  const getSummaryValue = (label) => {
    if (!stats?.summary) return '0';
    const item = stats.summary.find(s => s.label === label);
    return item ? item.value : '0';
  };

  // Every card drills into the page that lists what it counts, pre-filtered to
  // the same slice the number describes.
  const basePath = `/${user?.organization_slug}/staff`;
  const statCards = [
    {
      title: 'Total Reports',
      value: getSummaryValue('Total Reports'),
      change: '+12%',
      trend: 'up',
      icon: FileText,
      color: 'blue',
      to: `${basePath}/reports`
    },
    {
      title: 'Active Users',
      value: getSummaryValue('Active Users'),
      change: '+5%',
      trend: 'up',
      icon: Users,
      color: 'green',
      to: `${basePath}/users?status=active`
    },
    {
      title: 'Pending Cases',
      value: getSummaryValue('Pending'),
      change: '-2%',
      trend: 'down',
      icon: AlertTriangle,
      color: 'orange',
      to: `${basePath}/reports?status=pending`
    },
    {
      title: 'Anonymous Reports',
      value: getSummaryValue('Anonymous Reports'),
      change: '+8%',
      trend: 'up',
      icon: Settings,
      color: 'purple',
      to: `${basePath}/reports?anonymous=true`
    }
  ];

  // Removing the filter only makes sense once something has actually been
  // changed away from the default 30-day / daily view.
  const hasActiveFilters = Object.keys(DEFAULT_FILTERS).some(
    (key) => filters[key] !== DEFAULT_FILTERS[key]
  );

  // While the inputs differ from what is on screen, the button offers Apply
  // even if a filter is already active.
  const isDraftDirty = Object.keys(DEFAULT_FILTERS).some(
    (key) => draftFilters[key] !== filters[key]
  );

  const handleClearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
  };

  const totalReports = Number(getSummaryValue('Total Reports')) || 0;
  const reportTypeData = useMemo(() => {
    const list = stats?.report_types || [];
    return list
      .map((item) => ({
        // The stats payload has carried the type id under either key; keep
        // whichever is present so the drill-down can filter by id rather than
        // falling back to matching on the name.
        id: item.id || item.report_type_id || '',
        name: item.name || 'Unknown',
        total: Number(item.total) || 0
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [stats]);

  // Filter by id when the payload gives one, otherwise send the name and let
  // All Reports resolve it against its own report-type list.
  const openCategory = useCallback((type) => {
    if (!type?.id && !type?.name) return;
    const params = new URLSearchParams();
    if (type.id) params.set('report_type_id', type.id);
    else params.set('report_type', type.name);
    navigate(`${basePath}/reports?${params.toString()}`);
  }, [navigate, basePath]);

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-user"]',
        title: 'Welcome, Admin',
        content: 'This sidebar is your control center for managing the whole platform.',
        placement: 'right',
        skipBeacon: true,
      });
    }

    steps.push(
      {
        target: '[data-tour="admin-stats"]',
        title: 'Platform overview',
        content: 'A snapshot of total reports, active users, pending cases, and anonymous submissions — click any card to open the matching, pre-filtered list.',
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="admin-filters"]',
        title: 'Filter the period',
        content: 'Narrow every figure on this page to a date range and interval, then press Apply.',
        placement: 'bottom',
      }
    );

    if (isDesktop) {
      steps.push(
        {
          target: '[data-tour="sidebar-all-reports"]',
          title: 'All Reports',
          content: 'Review every report submitted across the organization.',
          placement: 'right',
        },
        {
          target: '[data-tour="sidebar-user-management"]',
          title: 'User Management',
          content: 'Create, edit, and deactivate user accounts.',
          placement: 'right',
        },
        {
          target: '[data-tour="sidebar-roles-permissions"]',
          title: 'Roles & Permissions',
          content: "Build your organization's roles and choose what each one is allowed to do.",
          placement: 'right',
        },
        {
          target: '[data-tour="sidebar-ai-agents"]',
          title: 'AI Agents',
          content: 'Define the AI agents that triage and summarize incoming reports, and what each may do.',
          placement: 'right',
        },
        {
          target: '[data-tour="sidebar-workflows"]',
          title: 'Workflows',
          content: 'Choose the stages a new report runs through, and where an agent hands over to a person.',
          placement: 'right',
        }
      );
    }

    steps.push(
      {
        target: '[data-tour="admin-categories"]',
        title: 'Reports by category',
        content: 'See which report types are driving volume over the selected period. Click a category to list its reports.',
        placement: 'top',
      },
      {
        target: '[data-tour="admin-distribution"]',
        title: 'Category distribution',
        content: 'The same breakdown as a share of the total — click a slice to drill into that category.',
        placement: 'top',
      },
      {
        target: '[data-tour="tour-user-menu"]',
        title: 'Your account',
        content: 'Manage your profile or log out from here.',
        placement: 'bottom',
      }
    );

    return steps;
  }, [isDesktop]);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-active rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => <div key={i} className="h-80 bg-active rounded-xl" />)}
      </div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <DashboardTour ref={tourRef} storageKey={ADMIN_TOUR_KEY} steps={tourSteps} />

      {/* Stat Cards — 2-up on phones so the row stays scannable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" data-tour="admin-stats">
        {statCards.map((stat, idx) => (
          <Card
            key={idx}
            hover
            shadow="sm"
            padding="small"
            role="button"
            tabIndex={0}
            aria-label={`${stat.title}: ${stat.value}. Open the filtered list.`}
            onClick={() => navigate(stat.to)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(stat.to);
              }
            }}
            className="min-w-0 sm:p-5 cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-ink-muted truncate">{stat.title}</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-ink mt-1 tabular-nums tracking-[-0.02em]">
                  {stat.value}
                </h3>
              </div>
              <span className={`inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-lg ${tone(stat.color).soft} ${tone(stat.color).fg}`}>
                <stat.icon className="h-4.5 w-4.5" />
              </span>
            </div>
            {/* <div className="flex items-baseline gap-1.5 mt-3">
              <span className={`text-xs font-semibold tabular-nums ${stat.trend === 'up' ? 'text-success-fg'
                  : stat.trend === 'down' ? 'text-danger-fg'
                    : 'text-ink-muted'
                }`}>
                {stat.change}
              </span>
              <span className="text-xs text-ink-subtle truncate">vs last month</span>
            </div> */}
          </Card>
        ))}
      </div>

      {/* The filter bar stays open: hiding it behind a toggle made it easy to
          forget the page was still scoped to a narrowed period. */}
      <Card shadow="sm" data-tour="admin-filters">
        <Card.Content>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink-secondary">Start Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-line-accent"
                value={draftFilters.start_date}
                max={draftFilters.end_date}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink-secondary">End Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-line-accent"
                value={draftFilters.end_date}
                min={draftFilters.start_date}
                max={formatDateInput(new Date())}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-ink-secondary">Interval</label>
              <select
                className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-line-accent"
                value={draftFilters.interval}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, interval: e.target.value }))}
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </div>
            {/* Once a non-default period is showing and the inputs match it,
                the only useful action left is clearing it. */}
            {hasActiveFilters && !isDraftDirty ? (
              <Button variant="secondary" startIcon={X} fullWidth onClick={handleClearFilters}>
                Remove Filter
              </Button>
            ) : (
              <Button
                variant="primary"
                startIcon={Filter}
                fullWidth
                disabled={!isDraftDirty}
                onClick={() => setFilters(draftFilters)}
              >
                Apply
              </Button>
            )}
          </div>
        </Card.Content>
      </Card>

      {/* min-w-0 on the grid children: without it a grid item's automatic
          minimum size is its content, so a long category name or a wide chart
          pushes the card past the container instead of shrinking. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <Card className="min-w-0" data-tour="admin-categories">
          <Card.Header>
            <Card.Title className="flex items-center">
              <Layers className="h-5 w-5 mr-2 shrink-0 text-accent-fg" />
              Reports by Category
            </Card.Title>
          </Card.Header>
          <Card.Content>
            {/* Scrolls internally so the card height stays fixed no matter how
                many categories come back. */}
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {reportTypeData.length > 0 ? (
                reportTypeData.map((type, i) => {
                  const percentage = totalReports > 0 ? Math.round((type.total / totalReports) * 100) : 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => openCategory(type)}
                      title={`View ${type.name} reports`}
                      className="w-full space-y-1.5 min-w-0 text-left rounded-md p-1 -m-1 cursor-pointer transition-colors hover:bg-hover focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium text-ink-secondary truncate" title={type.name}>{type.name}</span>
                        <span className="text-ink-muted shrink-0 tabular-nums">{type.total} cases</span>
                      </div>
                      <div className="w-full bg-active rounded-full h-2 text-left">
                        <div className="bg-accent h-2 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-8 text-ink-muted text-sm">No data available.</div>
              )}
            </div>
          </Card.Content>
        </Card>

        <Card className="min-w-0" data-tour="admin-distribution">
          <Card.Header>
            <Card.Title className="flex items-center">
              <PieChartIcon className="h-5 w-5 mr-2 shrink-0 text-accent-fg" />
              Category Distribution
            </Card.Title>
          </Card.Header>
          <Card.Content>
            {reportTypeData.length > 0 ? (
              <div className="min-w-0">
                {/* Percentage radii so the pie scales with the container, and a
                    shorter chart on phones. */}
                <div className="w-full h-56 sm:h-64 lg:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <Pie
                        data={reportTypeData}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={2}
                        cursor="pointer"
                        // Recharts hands the sector props through; depending on
                        // the shape the original row sits one or two levels deep.
                        onClick={(slice) => openCategory(slice?.payload?.payload || slice?.payload)}
                      >
                        {reportTypeData.map((entry, index) => (
                          <Cell key={`slice-${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} cases`, 'Reports']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Custom legend: recharts' own legend lays out in one un-scrollable
                    row and overflows once there are more than a handful of
                    categories. This one wraps, truncates, and scrolls. */}
                <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-32 overflow-y-auto pr-2">
                  {reportTypeData.map((entry, index) => (
                    <li key={`legend-${entry.name}-${index}`} className="min-w-0 text-xs">
                      <button
                        type="button"
                        onClick={() => openCategory(entry)}
                        title={`View ${entry.name} reports`}
                        className="flex w-full items-center gap-2 min-w-0 rounded-md px-1 py-0.5 -mx-1 text-left cursor-pointer transition-colors hover:bg-hover focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="truncate text-ink-secondary" title={entry.name}>{entry.name}</span>
                        <span className="ml-auto shrink-0 tabular-nums text-ink-muted">{entry.total}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="h-72 flex flex-col justify-center items-center text-center bg-subtle border-dashed border-2 border-line rounded-xl px-4">
                <PieChartIcon className="h-14 w-14 text-ink-subtle mb-3" />
                <h4 className="text-base font-semibold text-ink">No chart data available</h4>
                <p className="text-sm text-ink-muted mt-1">Submit more reports to visualize category distribution.</p>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>
    </div >
  );
};

export default AdminDashboard;
