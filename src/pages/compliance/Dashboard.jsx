import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  CheckCircle,
  Clock,
  BarChart3,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Table from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import { reportsAPI } from '../../api';
import { useReportTypeNames } from '../../hooks/useReportTypeNames';
import { useAuthStore } from '../../store/authStore';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import { parseServerDate } from '../../utils/formatters';
import { tone } from '../../utils/tone';
import useSEO from '../../hooks/useSEO';
import { normalizeReportsResponse } from '../../utils/reports';
import { useTranslation } from 'react-i18next';
import { intlLocale, isRtl } from '../../utils/locale';

// Tour placements are written for left-to-right; Arabic mirrors the sidebar.
const side = (placement) =>
  isRtl() ? ({ left: 'right', right: 'left' }[placement] || placement) : placement;

const COMPLIANCE_TOUR_KEY = 'xposer_compliance_dashboard_tour_seen';

const ComplianceDashboard = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  // Category names from the shared cached list; never holds up the dashboard.
  const { typeName, categoryFor } = useReportTypeNames();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();
  const { t, i18n } = useTranslation('dashboards');

  useSEO({
    title: t('compliance.seo.title'),
    description: t('compliance.seo.description'),
    noIndex: true,
  });
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsData, reportsData] = await Promise.all([
          reportsAPI.getDashboardStats(),
          reportsAPI.getAllReports({ page_size: 5 }),
        ]);
        setStats(statsData);
        setRecentReports(normalizeReportsResponse(reportsData).items);
      } catch (error) {
        console.error('Error fetching compliance dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Each card opens All Reports on the status it counts. Resolved/Closed spans
  // two statuses and the list filters on one, so it lands on Resolved.
  const reportsPath = `/${user?.organization_slug}/staff/reports`;
  const statCards = [
    {
      title: t('compliance.cards.total.title'),
      value: stats?.total || 0,
      icon: FileText,
      color: 'blue',
      description: t('compliance.cards.total.description'),
      to: reportsPath
    },
    {
      title: t('compliance.cards.pending.title'),
      value: stats?.pending || 0,
      icon: ShieldAlert,
      color: 'orange',
      description: t('compliance.cards.pending.description'),
      to: `${reportsPath}?status=pending`
    },
    {
      title: t('compliance.cards.active.title'),
      value: stats?.in_progress || 0,
      icon: Clock,
      color: 'indigo',
      description: t('compliance.cards.active.description'),
      to: `${reportsPath}?status=in_progress`
    },
    {
      title: t('compliance.cards.resolved.title'),
      value: (stats?.resolved || 0) + (stats?.closed || 0),
      icon: CheckCircle,
      color: 'green',
      description: t('compliance.cards.resolved.description'),
      to: `${reportsPath}?status=resolved`
    }
  ];

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-user"]',
        title: t('compliance.tour.welcome.title'),
        content: t('compliance.tour.welcome.content'),
        placement: side('right'),
        skipBeacon: true,
      });
    }

    steps.push({
      target: '[data-tour="compliance-stats"]',
      title: t('compliance.tour.stats.title'),
      content: t('compliance.tour.stats.content'),
      placement: 'bottom',
      skipBeacon: !isDesktop,
    });

    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-all-reports"]',
        title: t('compliance.tour.allReports.title'),
        content: t('compliance.tour.allReports.content'),
        placement: side('right'),
      });
    }

    steps.push(
      {
        target: '[data-tour="compliance-recent"]',
        title: t('compliance.tour.recent.title'),
        content: t('compliance.tour.recent.content'),
        placement: 'top',
      },
      {
        target: '[data-tour="compliance-category"]',
        title: t('compliance.tour.category.title'),
        content: t('compliance.tour.category.content'),
        placement: 'top',
      }
    );

    // if (isDesktop) {
    //   steps.push({
    //     target: '[data-tour="sidebar-help"]',
    //     title: 'Help & Support',
    //     content: 'Have a question? Find guidance and support resources here.',
    //     placement: 'right',
    //   });
    // }

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: t('compliance.tour.account.title'),
      content: t('compliance.tour.account.content'),
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop, t, i18n.resolvedLanguage]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-active rounded-xl" />)}
        </div>
        <div className="h-96 bg-active rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardTour ref={tourRef} storageKey={COMPLIANCE_TOUR_KEY} steps={tourSteps} />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-tour="compliance-stats">
        {statCards.map((stat, idx) => (
          <Card
            key={idx}
            hover
            shadow="sm"
            role="button"
            tabIndex={0}
            aria-label={t('compliance.cards.ariaLabel', { title: stat.title, value: stat.value })}
            onClick={() => navigate(stat.to)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(stat.to);
              }
            }}
            className="cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-ink-muted">{stat.title}</p>
                <h3 className="text-2xl font-bold text-ink mt-1">{stat.value}</h3>
              </div>
              <div className={`p-2 rounded-lg ${tone(stat.color).soft}`}>
                <stat.icon className={`h-6 w-6 ${tone(stat.color).fg}`} />
              </div>
            </div>
            <p className="text-xs text-ink-muted mt-4">{stat.description}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Reports Table */}
        <Card className="lg:col-span-2" padding="none" data-tour="compliance-recent">
          <Card.Header className="p-6 border-b border-line-subtle flex items-center justify-between">
            <Card.Title>{t('compliance.recent.title')}</Card.Title>
            <Link to={`/${user?.organization_slug}/staff/reports`} className="text-sm font-medium text-accent-fg hover:text-accent-fg flex items-center">
              {t('compliance.recent.viewAll')} <ArrowRight className="h-4 w-4 ms-1" />
            </Link>
          </Card.Header>
          <Table>
            <Table.Header>
              <Table.Row hover={false}>
                <Table.Head>{t('compliance.recent.columns.idDate')}</Table.Head>
                <Table.Head>{t('compliance.recent.columns.category')}</Table.Head>
                <Table.Head>{t('compliance.recent.columns.priority')}</Table.Head>
                <Table.Head>{t('compliance.recent.columns.status')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {recentReports.map((report) => (
                <Table.Row key={report.id} onClick={() => navigate(`/${user?.organization_slug}/staff/cases/${report.id}`)} className="cursor-pointer">
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span className="font-medium text-ink">#{report.report_number}</span>
                      <span className="text-xs text-ink-muted">{parseServerDate(report.created_at)?.toLocaleDateString(intlLocale()) || t('shared.notAvailable')}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm font-medium text-ink-secondary">
                      {typeName(report) ?? <Skeleton.Text className="w-24" />}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <PriorityBadge priority={report.priority} />
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={report.status} />
                  </Table.Cell>
                </Table.Row>
              ))}
              {recentReports.length === 0 && (
                <Table.Empty message={t('compliance.recent.emptyTitle')} description={t('compliance.recent.emptyDescription')} icon={FileText} />
              )}
            </Table.Body>
          </Table>
        </Card>

        {/* Priority Distribution Placeholder */}
        <Card className="lg:col-span-1" data-tour="compliance-category">
          <Card.Header>
            <Card.Title className="flex items-center">
              <BarChart3 className="h-5 w-5 me-2 text-accent-fg" />
              {t('compliance.category.title')}
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex flex-col gap-4">
              {stats?.by_report_type?.length > 0 ? (
                stats.by_report_type.slice(0, 5).map((item, i) => {
                  const percentage = stats.total > 0
                    ? Math.round((item.count / stats.total) * 100)
                    : 0;
                  const colors = ['bg-accent', 'bg-accent', 'bg-accent', 'bg-success-solid', 'bg-warning-solid'];
                  const color = colors[i % colors.length];

                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-ink-secondary truncate pe-2">
                          {categoryFor(item.report_type_id, item.report_type_name) ?? <Skeleton.Text className="w-28" />}
                        </span>
                        <span className="text-ink-muted shrink-0">{t('compliance.category.countPercent', { count: item.count, percent: percentage })}</span>
                      </div>
                      <div className="w-full bg-active rounded-full h-1.5">
                        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-ink-muted text-center py-4">{t('shared.noData')}</div>
              )}
            </div>
          </Card.Content>
          {/* {user?.role === 'admin' && (
            <Card.Footer>
              <Link to="/compliance/analytics" className="text-sm font-medium text-accent-fg hover:text-accent-fg">
                View Full Analytics →
              </Link>
            </Card.Footer>
          )} */}
        </Card>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
