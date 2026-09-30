// src/components/reports/ReportStats.jsx
import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  Calendar,
  Target,
} from 'lucide-react';
import Card from '../ui/Card';
import { formatNumber, formatDate } from '../../utils/formatters';
import { tone } from '../../utils/tone';

const ReportStats = ({ stats = {}, period = 'month', onPeriodChange }) => {
  const {
    total_reports = 0,
    open_reports = 0,
    closed_reports = 0,
    average_resolution_time = 0,
    reports_by_status = {},
    reports_by_priority = {},
    reports_by_type = {},
    reports_over_time = [],
    top_reporters = [],
    top_assignees = [],
    recent_activities = [],
  } = stats;

  // Each series needs its own fill — two categories sharing one color makes
  // the distribution bars unreadable.
  const statusData = [
    { label: 'Pending', value: reports_by_status.pending || 0, color: 'bg-warning-solid' },
    { label: 'In Progress', value: reports_by_status.in_progress || 0, color: 'bg-accent' },
    { label: 'Under Review', value: reports_by_status.under_review || 0, color: 'bg-info-solid' },
    { label: 'Resolved', value: reports_by_status.resolved || 0, color: 'bg-success-solid' },
    { label: 'Closed', value: reports_by_status.closed || 0, color: 'bg-ink-subtle' },
    { label: 'Rejected', value: reports_by_status.rejected || 0, color: 'bg-danger-solid' },
  ];

  const priorityData = [
    { label: 'Low', value: reports_by_priority.low || 0, color: 'bg-ink-subtle' },
    { label: 'Medium', value: reports_by_priority.medium || 0, color: 'bg-accent' },
    { label: 'High', value: reports_by_priority.high || 0, color: 'bg-warning-solid' },
    { label: 'Critical', value: reports_by_priority.critical || 0, color: 'bg-danger-solid' },
  ];

  const calculatePercentage = (value, total) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const StatCard = ({ icon: Icon, label, value, change, color = 'primary' }) => (
    <Card hover shadow="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-ink-muted truncate">{label}</p>
          {/* "Avg Resolution" passes a pre-formatted string like "4.2d";
              running that through formatNumber() yields NaN */}
          <p className="text-2xl sm:text-3xl font-bold text-ink mt-1 tabular-nums tracking-[-0.02em]">
            {typeof value === 'number' ? formatNumber(value) : value}
          </p>
          {change !== undefined && (
            <p className={`text-xs mt-1.5 font-medium tabular-nums ${change >= 0 ? 'text-success-fg' : 'text-danger-fg'}`}>
              {change >= 0 ? '+' : ''}{change}%
              <span className="text-ink-subtle font-normal"> from last period</span>
            </p>
          )}
        </div>
        <span className={`inline-flex items-center justify-center h-9 w-9 shrink-0 rounded-lg ${tone(color).soft} ${tone(color).fg}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
      </div>
    </Card>
  );

  const ProgressBar = ({ label, value, max, color, percentage }) => (
    <div>
      <div className="flex justify-between items-baseline gap-2 mb-1.5">
        <span className="text-sm text-ink-secondary truncate">{label}</span>
        <span className="text-xs font-medium text-ink-muted tabular-nums shrink-0">
          {formatNumber(value)} <span className="text-ink-subtle">({percentage}%)</span>
        </span>
      </div>
      <div className="w-full bg-subtle rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out-xp ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-lg font-semibold text-ink tracking-[-0.01em]">Report Statistics</h2>
        {/* Segmented control; scrolls rather than wrapping on narrow screens */}
        <div className="flex gap-1 p-1 rounded-lg bg-subtle border border-line overflow-x-auto scrollbar-thin">
          {['day', 'week', 'month', 'quarter', 'year'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPeriodChange && onPeriodChange(p)}
              aria-pressed={period === p}
              className={`shrink-0 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-accent text-on-accent'
                  : 'text-ink-muted hover:text-ink hover:bg-hover'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={BarChart3}
          label="Total Reports"
          value={total_reports}
          change={10}
          color="primary"
        />
        <StatCard
          icon={Activity}
          label="Open Reports"
          value={open_reports}
          change={-5}
          color="cyan"
        />
        <StatCard
          icon={CheckCircle}
          label="Closed Reports"
          value={closed_reports}
          change={15}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Avg Resolution"
          value={`${average_resolution_time}d`}
          change={-8}
          color="amber"
        />
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Status Distribution */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="text-base font-semibold text-ink tracking-[-0.01em]">
              Status Distribution
            </h3>
            <Target className="w-4 h-4 text-ink-subtle shrink-0" />
          </div>
          <div className="space-y-4">
            {statusData.map((item) => (
              <ProgressBar
                key={item.label}
                label={item.label}
                value={item.value}
                max={total_reports}
                color={item.color}
                percentage={calculatePercentage(item.value, total_reports)}
              />
            ))}
          </div>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-5">
            <h3 className="text-base font-semibold text-ink tracking-[-0.01em]">
              Priority Distribution
            </h3>
            <AlertTriangle className="w-4 h-4 text-ink-subtle shrink-0" />
          </div>
          <div className="space-y-4">
            {priorityData.map((item) => (
              <ProgressBar
                key={item.label}
                label={item.label}
                value={item.value}
                max={total_reports}
                color={item.color}
                percentage={calculatePercentage(item.value, total_reports)}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Top Reporters */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-ink tracking-[-0.01em]">
              Top Reporters
            </h3>
            <Users className="w-4 h-4 text-ink-subtle shrink-0" />
          </div>
          <div className="divide-y divide-line-subtle">
            {top_reporters.slice(0, 5).map((reporter, index) => (
              <div key={reporter.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-subtle text-[10px] font-semibold text-ink-muted tabular-nums">
                    {index + 1}
                  </span>
                  <span className="text-sm text-ink truncate">
                    {reporter.full_name || reporter.username}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {reporter.report_count}
                  </span>
                  <span className="text-xs text-ink-subtle">reports</span>
                </div>
              </div>
            ))}
            {top_reporters.length === 0 && (
              <p className="text-ink-subtle text-sm text-center py-6">
                No reporter data available
              </p>
            )}
          </div>
        </Card>

        {/* Top Assignees */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-ink tracking-[-0.01em]">
              Top Assignees
            </h3>
            <Users className="w-4 h-4 text-ink-subtle shrink-0" />
          </div>
          <div className="divide-y divide-line-subtle">
            {top_assignees.slice(0, 5).map((assignee, index) => (
              <div key={assignee.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-subtle text-[10px] font-semibold text-ink-muted tabular-nums">
                    {index + 1}
                  </span>
                  <span className="text-sm text-ink truncate">
                    {assignee.full_name || assignee.username}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {assignee.assigned_count}
                  </span>
                  <span className="text-xs text-ink-subtle">assigned</span>
                </div>
              </div>
            ))}
            {top_assignees.length === 0 && (
              <p className="text-ink-subtle text-sm text-center py-6">
                No assignee data available
              </p>
            )}
          </div>
        </Card>

        {/* Recent Activity */}
        <Card className="md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-ink tracking-[-0.01em]">
              Recent Activity
            </h3>
            <Activity className="w-4 h-4 text-ink-subtle shrink-0" />
          </div>
          <div className="space-y-3.5">
            {recent_activities.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                    activity.type === 'created' ? 'bg-success-solid'
                      : activity.type === 'updated' ? 'bg-accent'
                        : activity.type === 'closed' ? 'bg-danger-solid'
                          : 'bg-ink-subtle'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-secondary leading-snug">
                    {activity.description}
                  </p>
                  <p className="text-xs text-ink-subtle mt-1">
                    {formatDate(activity.created_at, 'MMM dd, HH:mm')}
                  </p>
                </div>
              </div>
            ))}
            {recent_activities.length === 0 && (
              <p className="text-ink-subtle text-sm text-center py-6">
                No recent activity
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Time Series Chart */}
      {reports_over_time.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3 mb-6">
            <h3 className="text-base font-semibold text-ink tracking-[-0.01em]">
              Reports Over Time
            </h3>
            <TrendingUp className="w-4 h-4 text-ink-subtle shrink-0" />
          </div>
          {/* Scrolls horizontally so a long series keeps readable bar widths */}
          <div className="overflow-x-auto scrollbar-thin">
            <div className="flex items-end gap-1 h-56 min-w-full" style={{ minWidth: `${reports_over_time.length * 28}px` }}>
              {reports_over_time.map((item, index) => {
                const maxValue = Math.max(...reports_over_time.map(i => i.count));
                const height = maxValue > 0 ? (item.count / maxValue) * 100 : 0;

                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center justify-end h-full min-w-6 group"
                    title={`${item.date}: ${item.count}`}
                  >
                    <div className="text-[10px] font-medium text-ink-muted tabular-nums mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.count}
                    </div>
                    {/* min-h keeps zero-value days visible as a hairline */}
                    <div
                      className="w-full bg-accent rounded-t transition-colors group-hover:bg-accent-hover"
                      style={{ height: `${height}%`, minHeight: '2px' }}
                    />
                    <div className="mt-2 text-[10px] text-ink-subtle whitespace-nowrap tabular-nums">
                      {item.date.slice(5)} {/* Show only month-day */}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// Mini stats for dashboard
export const ReportMiniStats = ({ stats }) => {
  const tiles = [
    { icon: BarChart3, label: 'Total', value: formatNumber(stats.total_reports || 0), color: 'primary' },
    { icon: Activity, label: 'Open', value: formatNumber(stats.open_reports || 0), color: 'cyan' },
    { icon: CheckCircle, label: 'Closed', value: formatNumber(stats.closed_reports || 0), color: 'green' },
    { icon: Clock, label: 'Avg Time', value: `${stats.average_resolution_time || 0}d`, color: 'amber' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {tiles.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-surface rounded-xl border border-line p-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg ${tone(color).soft} ${tone(color).fg}`}>
              <Icon className="w-[18px] h-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-ink-muted truncate">{label}</p>
              <p className="text-lg font-semibold text-ink tabular-nums">
                {value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReportStats;
