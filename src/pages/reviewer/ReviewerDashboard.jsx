import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Badge, { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import Table, { TableLoading } from '../../components/ui/Table';
import { reportsAPI, reportTypesAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import { parseServerDate } from '../../utils/formatters';
import { tone } from '../../utils/tone';
import useSEO from '../../hooks/useSEO';
import { normalizeReportsResponse } from '../../utils/reports';

const REVIEWER_TOUR_KEY = 'xposer_reviewer_dashboard_tour_seen';

const ReviewerDashboard = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [reportTypes, setReportTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();

  useSEO({
    title: 'Reviewer Dashboard',
    description: 'Reports assigned to you for review, with status and category breakdowns.',
    noIndex: true,
  });
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsData, reportsData, typesData] = await Promise.all([
          reportsAPI.getDashboardStats(),
          reportsAPI.getAllReports({ page_size: 5 }),
          reportTypesAPI.getReportTypes()
        ]);
        setStats(statsData);
        setRecentReports(normalizeReportsResponse(reportsData).items);
        setReportTypes(typesData);
      } catch (error) {
        console.error('Error fetching reviewer dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Each card opens the reports list on the status it counts. Resolved/Closed
  // spans two statuses and the list filters on one, so it lands on Resolved.
  const reportsPath = `/${user?.organization_slug || ''}/staff/reports`;
  const statCards = [
    {
      title: 'Total Assigned',
      value: stats?.total || 0,
      icon: FileText,
      color: 'blue',
      description: 'Total reports assigned to you',
      to: reportsPath
    },
    {
      title: 'Pending Review',
      value: stats?.pending || 0,
      icon: ShieldAlert,
      color: 'orange',
      description: 'Awaiting your initial review',
      to: `${reportsPath}?status=pending`
    },
    {
      title: 'Active Cases',
      value: stats?.in_progress || 0,
      icon: Clock,
      color: 'indigo',
      description: 'Currently being investigated',
      to: `${reportsPath}?status=in_progress`
    },
    {
      title: 'Resolved/Closed',
      value: (stats?.resolved || 0) + (stats?.closed || 0),
      icon: CheckCircle,
      color: 'green',
      description: 'Successfully resolved or closed',
      to: `${reportsPath}?status=resolved`
    }
  ];

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-user"]',
        title: 'Welcome, Reviewer',
        content: 'This sidebar is where you navigate between your dashboard and all reports.',
        placement: 'right',
        skipBeacon: true,
      });
    }

    steps.push({
      target: '[data-tour="reviewer-stats"]',
      title: 'Case overview',
      content: 'Track total, pending, active, and resolved reports assigned to you.',
      placement: 'bottom',
      skipBeacon: !isDesktop,
    });

    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-all-reports"]',
        title: 'All Reports',
        content: 'Browse and open every report you have access to review.',
        placement: 'right',
      });
    }

    steps.push(
      {
        target: '[data-tour="reviewer-recent"]',
        title: 'Recent submissions',
        content: 'The newest reports land here first — click any row to open the case.',
        placement: 'top',
      },
      {
        target: '[data-tour="reviewer-category"]',
        title: 'Reports by category',
        content: 'See how reports break down by type, so you can spot trends quickly.',
        placement: 'top',
      }
    );

    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-help"]',
        title: 'Help & Support',
        content: 'Have a question? Find guidance and support resources here.',
        placement: 'right',
      });
    }

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: 'Your account',
      content: 'Manage your profile or log out from here.',
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop]);

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
      <DashboardTour ref={tourRef} storageKey={REVIEWER_TOUR_KEY} steps={tourSteps} />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-tour="reviewer-stats">
        {statCards.map((stat, idx) => (
          <Card
            key={idx}
            hover
            shadow="sm"
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
        <Card className="lg:col-span-2" padding="none" data-tour="reviewer-recent">
          <Card.Header className="p-6 border-b border-line-subtle flex items-center justify-between">
            <Card.Title>Recent Submissions</Card.Title>
            <Link to={reportsPath} className="text-sm font-medium text-accent-fg hover:text-accent-fg flex items-center">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Card.Header>
          <Table>
            <Table.Header>
              <Table.Row hover={false}>
                <Table.Head>ID & Date</Table.Head>
                <Table.Head>Category</Table.Head>
                <Table.Head>Priority</Table.Head>
                <Table.Head>Status</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {recentReports.map((report) => (
                <Table.Row key={report.id} onClick={() => navigate(`/${user ? user?.organization_slug : ''}/staff/cases/${report.id}`)} className="cursor-pointer">
                  <Table.Cell>
                    <div className="flex flex-col">
                      <span className="font-medium text-ink">#{report.report_number}</span>
                      <span className="text-xs text-ink-muted">{parseServerDate(report.created_at)?.toLocaleDateString() || 'N/A'}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-sm font-medium text-ink-secondary">
                      {report.report_type_name ||
                        reportTypes.find(t => t.id === report.report_type_id)?.name ||
                        'AI Assisstant'}
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
                <Table.Empty message="No reports found" description="New reports will appear here." icon={FileText} />
              )}
            </Table.Body>
          </Table>
        </Card>

        {/* Priority Distribution Placeholder */}
        <Card className="lg:col-span-1" data-tour="reviewer-category">
          <Card.Header>
            <Card.Title className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-accent-fg" />
              Reports by Category
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="flex flex-col space-y-4">
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
                        <span className="font-medium text-ink-secondary truncate pr-2">{item.report_type_name}</span>
                        <span className="text-ink-muted shrink-0">{item.count} ({percentage}%)</span>
                      </div>
                      <div className="w-full bg-active rounded-full h-1.5">
                        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-ink-muted text-center py-4">No data available</div>
              )}
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
};

export default ReviewerDashboard;