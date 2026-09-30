import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Calendar,
  Layers,
  Map,
  Filter,
  Download,
  X
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { reportsAPI, analyticsAPI } from '../../api';
import { toast } from 'react-toastify';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import useSEO from '../../hooks/useSEO';

const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#e11d48', '#4f46e5'];

const formatDateInput = (date) => date.toISOString().slice(0, 10);
const toStartOfDayIso = (dateString) => new Date(`${dateString}T00:00:00.000Z`).toISOString();
const toEndOfDayIso = (dateString) => new Date(`${dateString}T23:59:59.999Z`).toISOString();

const ComplianceAnalytics = () => {
  useSEO({
    title: 'Analytics',
    description: 'Trends, resolution times, and category breakdowns across your reports.',
    noIndex: true,
  });
  const now = new Date();
  const defaultEndDate = formatDateInput(now);
  const defaultStartDate = formatDateInput(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    start_date: defaultStartDate,
    end_date: defaultEndDate,
    interval: 'day'
  });

  const fetchAnalytics = useCallback(async (activeFilters) => {
    setLoading(true);
    try {
      const stats = await reportsAPI.getDetailedStats({
        start_date: toStartOfDayIso(activeFilters.start_date),
        end_date: toEndOfDayIso(activeFilters.end_date),
        interval: activeFilters.interval
      });
      setData(stats);
    } catch (error) {
      console.error('Error fetching compliance analytics:', error);
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(filters);
  }, [fetchAnalytics, filters]);

  const handleExport = async () => {
    try {
      const blob = await analyticsAPI.exportAnalytics({
        start_date: toStartOfDayIso(filters.start_date),
        end_date: toEndOfDayIso(filters.end_date),
        interval: filters.interval
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Analytics report downloaded successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to download report');
    }
  };

  const handleLast30Days = () => {
    const endDate = formatDateInput(new Date());
    const startDate = formatDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    setFilters((prev) => ({
      ...prev,
      start_date: startDate,
      end_date: endDate
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      start_date: defaultStartDate,
      end_date: defaultEndDate,
      interval: 'day'
    });
  };

  const getSummaryValue = (label) => {
    if (!data?.summary) return '0';
    const item = data.summary.find(s => s.label === label);
    return item ? item.value : '0';
  };

  const totalReports = Number(getSummaryValue('Total Reports')) || 0;
  const reportTypeData = useMemo(() => {
    const list = data?.report_types || [];
    return list
      .map((item) => ({
        name: item.name || 'Unknown',
        total: Number(item.total) || 0
      }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const metrics = data ? [
    { label: 'Total Reports', value: getSummaryValue('Total Reports'), trend: '+5%', icon: BarChart3 },
    { label: 'Registered Reporters', value: getSummaryValue('Registered Reporters'), trend: '+2%', icon: TrendingUp },
    { label: 'Anonymous', value: getSummaryValue('Anonymous Reports'), trend: '+10%', icon: PieChartIcon },
    { label: 'Active Users', value: getSummaryValue('Active Users'), trend: '0%', icon: Map }
  ] : [
    { label: 'Total Reports', value: '0', trend: '0%', icon: BarChart3 },
    { label: 'Registered Reporters', value: '0', trend: '0%', icon: TrendingUp },
    { label: 'Anonymous', value: '0', trend: '0%', icon: PieChartIcon },
    { label: 'Active Users', value: '0', trend: '0%', icon: Map }
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-active rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => <div key={i} className="h-80 bg-active rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" startIcon={Filter} onClick={() => setShowFilters((prev) => !prev)}>
            {showFilters ? 'Hide Filters' : 'Filter'}
          </Button>
          <Button variant="ghost" startIcon={X} onClick={handleResetFilters}>Reset</Button>
        </div>
        {/* <Button
          variant="secondary"
          startIcon={Download}
          onClick={handleExport}
          disabled={loading}
        >
          Download Report
        </Button> */}
      </div>

      {showFilters && (
        <Card shadow="sm">
          <Card.Content>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-ink-secondary">Start Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-line-accent"
                  value={filters.start_date}
                  max={filters.end_date}
                  onChange={(e) => setFilters((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-ink-secondary">End Date</label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-line-accent"
                  value={filters.end_date}
                  min={filters.start_date}
                  max={formatDateInput(new Date())}
                  onChange={(e) => setFilters((prev) => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-ink-secondary">Interval</label>
                <select
                  className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-line-accent"
                  value={filters.interval}
                  onChange={(e) => setFilters((prev) => ({ ...prev, interval: e.target.value }))}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, idx) => (
          <Card key={idx} shadow="sm">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-accent-soft rounded-lg">
                <m.icon className="h-5 w-5 text-accent-fg" />
              </div>
              <span className={`text-xs font-medium ${m.trend.startsWith('+') ? 'text-success-fg' : 'text-accent-fg'}`}>
                {m.trend}
              </span>
            </div>
            <div className="mt-4 text-left">
              <h3 className="text-2xl font-bold text-ink">{m.value}</h3>
              <p className="text-sm text-ink-muted font-medium">{m.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* min-w-0 on the grid children: without it a grid item's automatic
          minimum size is its content, so a long category name or a wide chart
          pushes the card past the container instead of shrinking. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <Card className="min-w-0">
          <Card.Header>
            <Card.Title className="flex items-center">
              <Layers className="h-5 w-5 mr-2 shrink-0 text-accent-fg" />
              Reports by Category
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
              {reportTypeData.length > 0 ? (
                reportTypeData.map((type, i) => {
                  const percentage = totalReports > 0 ? Math.round((type.total / totalReports) * 100) : 0;
                  return (
                    <div key={i} className="space-y-1.5 min-w-0">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium text-ink-secondary truncate" title={type.name}>{type.name}</span>
                        <span className="text-ink-muted shrink-0 tabular-nums">{type.total} cases</span>
                      </div>
                      <div className="w-full bg-active rounded-full h-2 text-left">
                        <div className="bg-accent h-2 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-ink-muted text-sm">No data available.</div>
              )}
            </div>
          </Card.Content>
        </Card>

        <Card className="min-w-0">
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
                    <li key={`legend-${entry.name}-${index}`} className="flex items-center gap-2 min-w-0 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="truncate text-ink-secondary" title={entry.name}>{entry.name}</span>
                      <span className="ml-auto shrink-0 tabular-nums text-ink-muted">{entry.total}</span>
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
    </div>
  );
};

export default ComplianceAnalytics;
