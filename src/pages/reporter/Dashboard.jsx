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
import { ReportGridCard, ReportGridCardSkeleton } from '../../components/reports/ReportCard';
import Skeleton from '../../components/ui/Skeleton';
import { formatRelativeTime, parseServerDate } from '../../utils/formatters';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';
import { useTranslation } from 'react-i18next';
import { isRtl } from '../../utils/locale';

// Tour placements are written for left-to-right; Arabic mirrors the sidebar.
const side = (placement) =>
  isRtl() ? ({ left: 'right', right: 'left' }[placement] || placement) : placement;

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
  const { t, i18n } = useTranslation('reporter');

  useSEO({
    title: t('seo.dashboardTitle'),
    description: t('seo.dashboardDescription'),
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
          title: t('tour.welcomeTitle'),
          content: t('tour.welcomeContent'),
          placement: side('right'),
          skipBeacon: true,
        },
        {
          target: '[data-tour="sidebar-submit-report"]',
          title: t('tour.submitTitle'),
          content: t('tour.submitContent'),
          placement: side('right'),
        }
      );
    }

    steps.push({
      target: '[data-tour="reporter-stats"]',
      title: t('tour.statsTitle'),
      content: t('tour.statsContent'),
      placement: 'bottom',
      skipBeacon: !isDesktop,
    });

    steps.push({
      target: '[data-tour="reporter-reports"]',
      title: t('tour.reportsTitle'),
      content: t('tour.reportsContent'),
      placement: 'top',
    });

    steps.push({
      target: '[data-tour="reporter-activity"]',
      title: t('tour.activityTitle'),
      content: t('tour.activityContent'),
      placement: side('left'),
    });

    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-anonymous"]',
        title: t('tour.anonymousTitle'),
        content: t('tour.anonymousContent'),
        placement: side('right'),
      });
    }

    steps.push({
      target: '[data-tour="reporter-security"]',
      title: t('tour.securityTitle'),
      content: t('tour.securityContent'),
      placement: side('left'),
    });

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: t('tour.accountTitle'),
      content: t('tour.accountContent'),
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop, t, i18n.resolvedLanguage]);

  return (
    <div className="space-y-6">
      <DashboardTour ref={tourRef} storageKey={REPORTER_TOUR_KEY} steps={tourSteps} />

      {/* Welcome Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {t('dashboard.welcome', { name: user?.full_name || user?.username })}
          </h1>
          <p className="text-ink-muted mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>
      </div>

      {/* Stats Overview — each tile opens My Reports on the matching status. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="reporter-stats">
        {[
          {
            key: 'total',
            label: t('dashboard.totalReports'),
            value: statusCounts.total || 0,
            icon: FileText,
            iconWrap: 'bg-accent-soft',
            iconColor: 'text-accent-fg',
            status: ''
          },
          {
            key: 'pending',
            label: t('dashboard.pending'),
            value: statusCounts.pending || 0,
            icon: Clock,
            iconWrap: 'bg-warning-soft',
            iconColor: 'text-warning-fg',
            status: 'pending'
          },
          {
            key: 'resolved',
            label: t('dashboard.resolved'),
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
              key={tile.key}
              role="button"
              tabIndex={0}
              aria-label={t('dashboard.tileLabel', { label: tile.label, value: tile.value })}
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
                <div className={`p-2 rounded-lg ${tile.iconWrap} me-4`}>
                  <tile.icon className={`w-6 h-6 ${tile.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-ink-muted">{tile.label}</p>
                  {isLoading ? (
                    <Skeleton.Text size="2xl" className="w-10" />
                  ) : (
                    <p className="text-2xl font-bold text-ink">{tile.value}</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {/* <Card className="hover:shadow-lg transition-shadow">
          <div className="flex items-center">
            <div className="p-2 rounded-lg bg-accent-soft me-4">
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
            <h2 className="text-lg font-semibold text-ink">{t('dashboard.myReports')}</h2>
            <div className="flex items-center gap-3 mt-3 sm:mt-0">
              {/* View Toggle */}
              <div className="flex border border-line-strong rounded-lg" role="group" aria-label={t('dashboard.viewMode')}>
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'grid'
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface text-ink-secondary hover:bg-subtle'
                    } rounded-s-lg`}
                >
                  {t('dashboard.grid')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  className={`px-3 py-1.5 text-sm ${viewMode === 'list'
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface text-ink-secondary hover:bg-subtle'
                    } rounded-e-lg`}
                >
                  {t('dashboard.list')}
                </button>
              </div>

              {/* Filter */}
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label={t('dashboard.filterLabel')}
                className="border border-line-strong rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ring"
              >
                <option value="all">{t('dashboard.allReports')}</option>
                {['pending', 'in_progress', 'under_review', 'resolved', 'closed'].map((status) => (
                  <option key={status} value={status}>{t(`common:reportStatus.${status}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-4" aria-busy="true">
              <ReportGridCardSkeleton />
              <ReportGridCardSkeleton />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-ink-subtle mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-ink mb-2">
                {t('dashboard.emptyTitle')}
              </h3>
              <p className="text-ink-muted mb-6">
                {filter === 'all'
                  ? t('dashboard.emptyNone')
                  : t('dashboard.emptyFiltered', { status: t(`common:reportStatus.${filter}`, { defaultValue: filter }) })}
              </p>
              <Button startIcon={Plus} to={`/${user?.organization_slug}/reporter/submit`}>
                  {t('dashboard.submitFirst')}
                </Button>
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
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-ink-muted">
                        #{report.report_number}
                      </span>
                      <StatusBadge status={report.status} />
                    </div>
                    <h4 className="text-sm font-medium text-ink truncate">
                      {report?.title?.split('-')[0]}
                    </h4>
                    <p className="text-xs text-ink-muted mt-1">
                      {t('dashboard.lastUpdated', { time: formatRelativeTime(report.updated_at) })}
                    </p>
                  </div>
                  <Eye className="w-5 h-5 text-ink-subtle" />
                </div>
              ))}
            </div>
          )}

          {(isLoading || filteredReports.length > 0) && (
            <div className="mt-6 pt-6 border-t border-line">
              <Button variant="secondary" className="w-full" to={`/${user ? user.organization_slug : ''}/reporter/reports`}>
                  {t('dashboard.viewAll')}
                </Button>
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
            <h4 className="font-semibold text-ink mb-2">{t('dashboard.tipDetailsTitle')}</h4>
            <p className="text-sm text-ink-muted">
              {t('dashboard.tipDetailsBody')}
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-success-soft rounded-full mb-3">
              <MessageSquare className="h-6 w-6 text-success-fg" />
            </div>
            <h4 className="font-semibold text-ink mb-2">{t('dashboard.tipEngagedTitle')}</h4>
            <p className="text-sm text-ink-muted">
              {t('dashboard.tipEngagedBody')}
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-soft rounded-full mb-3">
              <Shield className="h-6 w-6 text-accent-fg" />
            </div>
            <h4 className="font-semibold text-ink mb-2">{t('dashboard.tipCredentialsTitle')}</h4>
            <p className="text-sm text-ink-muted">
              {t('dashboard.tipCredentialsBody')}
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
            <Button startIcon={Plus} to="/reporter/submit">
                Submit with Account
              </Button>
            <Button variant="secondary" to="/submit-anonymous">
                Submit Anonymously
              </Button>
          </div>
        </Card> */}
      {/* )} */}
    </div>
  );
};

export default Dashboard;
