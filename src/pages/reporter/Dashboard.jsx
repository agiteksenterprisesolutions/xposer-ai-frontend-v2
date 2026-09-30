import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Eye,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useReports } from '../../hooks/useReports';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { ReportGridCard } from '../../components/reports/ReportCard';
import LoadingSpinner from '../../components/layout/LoadingSpinner';
import { formatRelativeTime, parseServerDate } from '../../utils/formatters';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';

const REPORTER_TOUR_KEY = 'xposer_reporter_dashboard_tour_seen';

const Dashboard = () => {
  const { user } = useAuthStore();
  const {
    fetchMyReports,
    reports,
    isLoading,
    fetchDashboardStats,
    stats
  } = useReports();
  const [filter, setFilter] = useState('all'); // all, pending, in_progress, resolved
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const navigate = useNavigate();
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();

  useSEO({
    title: 'My Dashboard',
    description: 'An overview of the reports you have submitted and their current status.',
    noIndex: true,
  });

  useEffect(() => {
    const initDashboard = async () => {
      // Only fetch if not anonymous
      if (user && !user.is_anonymous) {
        await fetchMyReports();
        await fetchDashboardStats();
      }
    };
    initDashboard();
  }, [fetchMyReports, fetchDashboardStats, user]);

  // Filter reports based on selected filter
  const filteredReports = React.useMemo(() => {
    if (!reports) return [];
    if (filter === 'all') return reports;
    return reports.filter(report => report.status === filter);
  }, [reports, filter]);

  // Use backend stats directly instead of local reduce
  const statusCounts = React.useMemo(() => {
    if (!stats) return { total: 0, pending: 0, in_progress: 0, resolved: 0, closed: 0 };
    return {
      total: stats.total || 0,
      pending: stats.pending || 0,
      in_progress: stats.in_progress || 0,
      resolved: stats.resolved || 0,
      closed: stats.closed || 0,
    };
  }, [stats]);

  // Get recent activity
  const recentActivity = React.useMemo(() => {
    if (!reports) return [];
    return reports
      .sort((a, b) => parseServerDate(b.updated_at) - parseServerDate(a.updated_at))
      .slice(0, 5);
  }, [reports]);

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push(
        {
          target: '[data-tour="sidebar-user"]',
          title: 'Welcome to Xposer AI',
          content: 'This sidebar is where you submit and track your reports.',
          placement: 'right',
          skipBeacon: true,
        },
        {
          target: '[data-tour="sidebar-submit-report"]',
          title: 'Submit a report',
          content: 'File a new report tied to your account for easier tracking and follow-up.',
          placement: 'right',
        }
      );
    }

    steps.push({
      target: '[data-tour="reporter-stats"]',
      title: 'Your report status',
      content: 'A quick summary of how many reports you have submitted, and where they stand.',
      placement: 'bottom',
      skipBeacon: !isDesktop,
    });

    steps.push({
      target: '[data-tour="reporter-reports"]',
      title: 'My Reports',
      content: 'All your reports live here — switch between grid and list view, or filter by status.',
      placement: 'top',
    });

    steps.push({
      target: '[data-tour="reporter-activity"]',
      title: 'Recent activity',
      content: 'See the latest updates on your reports as soon as they happen.',
      placement: 'left',
    });

    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-anonymous"]',
        title: 'Anonymous reporting',
        content: 'Prefer not to attach your identity? You can still file a report anonymously.',
        placement: 'right',
      });
    }

    steps.push({
      target: '[data-tour="reporter-security"]',
      title: 'Your data is protected',
      content: 'All reports and messages are end-to-end encrypted for your safety.',
      placement: 'left',
    });

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: 'Your account',
      content: 'Manage your profile or log out from here.',
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop]);

  if (isLoading) {
    return <LoadingSpinner message="Loading your dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <DashboardTour ref={tourRef} storageKey={REPORTER_TOUR_KEY} steps={tourSteps} />

      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            Welcome back, {user?.full_name || user?.username}!
          </h1>
          <p className="text-ink-muted mt-1">
            Here's what's happening with your reports.
          </p>
        </div>
      </div>

      {/* Stats Overview — each tile opens My Reports on the matching status. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="reporter-stats">
        {[
          {
            label: 'Total Reports',
            value: statusCounts.total || 0,
            icon: FileText,
            iconWrap: 'bg-accent-soft',
            iconColor: 'text-accent-fg',
            status: ''
          },
          {
            label: 'Pending',
            value: statusCounts.pending || 0,
            icon: Clock,
            iconWrap: 'bg-warning-soft',
            iconColor: 'text-warning-fg',
            status: 'pending'
          },
          {
            label: 'Resolved',
            value: statusCounts.resolved || 0,
            icon: CheckCircle,
            iconWrap: 'bg-success-soft',
            iconColor: 'text-success-fg',
            status: 'resolved'
          }
        ].map((tile) => {
          const target = `/${user?.organization_slug}/reporter/reports${tile.status ? `?status=${tile.status}` : ''}`;
          return (
            <Card
              key={tile.label}
              role="button"
              tabIndex={0}
              aria-label={`${tile.label}: ${tile.value}. Open the filtered list.`}
              onClick={() => navigate(target)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(target);
                }
              }}
              className="hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${tile.iconWrap} mr-4`}>
                  <tile.icon className={`w-6 h-6 ${tile.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-ink-muted">{tile.label}</p>
                  <p className="text-2xl font-bold text-ink">{tile.value}</p>
                </div>
              </div>
            </Card>
          );
        })}

        {/* <Card className="hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-accent-soft mr-4">
              <MessageSquare className="w-6 h-6 text-accent-fg" />
            </div>
            <div>
              <p className="text-sm text-ink-muted">Messages</p>
              <p className="text-2xl font-bold text-ink">
                {reports?.reduce((acc, r) => acc + (r.messages_count || 0), 0) || 0}
              </p>
            </div>
          </div>
        </Card> */}
      </div>

      {/* Reports Section */}
      <div>
        <Card data-tour="reporter-reports">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-ink">My Reports</h2>
            <div className="flex items-center space-x-3 mt-3 sm:mt-0">
              {/* View Toggle */}
              <div className="flex border border-line-strong rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'grid'
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface text-ink-secondary hover:bg-subtle'
                    } rounded-l-lg`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'list'
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface text-ink-secondary hover:bg-subtle'
                    } rounded-r-lg`}
                >
                  List
                </button>
              </div>

              {/* Filter */}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-line-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ring"
              >
                <option value="all">All Reports</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          {filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-ink-subtle mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-ink mb-2">
                No Reports Found
              </h3>
              <p className="text-ink-muted mb-6">
                {filter === 'all'
                  ? "You haven't submitted any reports yet."
                  : `No reports with status "${filter}" found.`}
              </p>
              <Link to={`/${user?.organization_slug}/reporter/submit`}>
                <Button startIcon={Plus}>
                  Submit Your First Report
                </Button>
              </Link>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid md:grid-cols-2 gap-4">
              {filteredReports.map((report) => (
                <ReportGridCard
                  key={report.id}
                  report={report}
                  onClick={() => navigate(`/${user ? user.organization_slug : ''}/reporter/reports/${report.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 bg-subtle rounded-lg hover:bg-active transition-colors cursor-pointer"
                  onClick={() => navigate(`/${user ? user.organization_slug : ''}/reporter/reports/${report.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-sm font-mono text-ink-muted">
                        #{report.report_number}
                      </span>
                      <StatusBadge status={report.status} />
                    </div>
                    <h4 className="text-sm font-medium text-ink truncate">
                      {report?.title?.split('-')[0]}
                    </h4>
                    <p className="text-xs text-ink-muted mt-1">
                      Last updated {formatRelativeTime(report.updated_at)}
                    </p>
                  </div>
                  <Eye className="w-5 h-5 text-ink-subtle" />
                </div>
              ))}
            </div>
          )}

          {filteredReports.length > 0 && (
            <div className="mt-6 pt-6 border-t border-line">
              <Link to={`/${user ? user.organization_slug : ''}/reporter/reports`}>
                <Button variant="secondary" className="w-full">
                  View All Reports
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Tips & Guidance */}
      <Card>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-soft rounded-full mb-3">
              <FileText className="h-6 w-6 text-accent-fg" />
            </div>
            <h4 className="font-semibold text-ink mb-2">Provide Details</h4>
            <p className="text-sm text-ink-muted">
              Include specific dates, times, and evidence for faster resolution.
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-success-soft rounded-full mb-3">
              <MessageSquare className="h-6 w-6 text-success-fg" />
            </div>
            <h4 className="font-semibold text-ink mb-2">Stay Engaged</h4>
            <p className="text-sm text-ink-muted">
              Respond to investigator questions promptly for efficient processing.
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-soft rounded-full mb-3">
              <Shield className="h-6 w-6 text-accent-fg" />
            </div>
            <h4 className="font-semibold text-ink mb-2">Protect Credentials</h4>
            <p className="text-sm text-ink-muted">
              Keep your login credentials secure and never share them with anyone.
            </p>
          </div>
        </div>
      </Card>

      {/* Empty State for New Users */}
      {/* {(!reports || reports.length === 0) && (
        <Card className="text-center">
          <FileText className="w-16 h-16 text-ink-subtle mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-ink mb-2">
            Ready to Submit Your First Report?
          </h3>
          <p className="text-ink-muted max-w-md mx-auto mb-6">
            Start by submitting a report. You can choose to submit anonymously or with your account for better tracking.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/reporter/submit">
              <Button startIcon={Plus}>
                Submit with Account
              </Button>
            </Link>
            <Link to="/submit-anonymous">
              <Button variant="secondary">
                Submit Anonymously
              </Button>
            </Link>
          </div>
        </Card> */}
      {/* )} */}
    </div>
  );
};

export default Dashboard;
