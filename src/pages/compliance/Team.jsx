import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Mail,
  Briefcase,
  ChevronRight,
  TrendingUp,
  Activity,
  Award
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { usersAPI } from '../../api';
import useSEO from '../../hooks/useSEO';
import { normalizeListResponse } from '../../utils/pagination';
import TableSortControl from '../../components/ui/TableSortControl';
import { useTableSort, byText } from '../../hooks/useTableSort';
import { useOrgRoles, roleCanWorkReports } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { ACCESS } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { useTranslation } from 'react-i18next';

// Only Member and Role are sortable: Workload, Avg. Time and Status are still
// hardcoded placeholders in the row markup, so ordering by them would sort
// every row by the same constant and imply data that isn't there yet.
// Labels are filled in by the page, in the interface language.
const SORT_COLUMNS = {
  member: {
    defaultOrder: 'asc',
    value: (m) => `${m.last_name || ''} ${m.first_name || ''} ${m.email || ''}`.trim().toLowerCase(),
  },
  // Roles have no rank any more; the page swaps in their display names.
  role: { defaultOrder: 'asc', value: byText('role') },
  email: { defaultOrder: 'asc', value: byText('email') },
};

const ComplianceTeam = () => {
  const { t } = useTranslation('dashboards');
  useSEO({
    title: t('team.seo.title'),
    description: t('team.seo.description'),
    noIndex: true,
  });
  const can = useCan();
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const { roles, nameFor, loading: rolesLoading } = useOrgRoles();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const loading = usersLoading || rolesLoading;

  // The team is whoever can work cases — every role that can open reports,
  // whatever the organization has named it — not one fixed role code.
  const team = useMemo(() => {
    const caseRoles = new Set(roles.filter(roleCanWorkReports).map((role) => role.code));
    return users.filter((user) => caseRoles.has(user.role));
  }, [users, roles]);

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        const response = await usersAPI.getAllUsers({ is_active: true, page_size: 100 });
        setUsers(normalizeListResponse(response).items);

        // Mock stats
        setStats({
          avg_resolution: 4.2,
          total_active: 12,
          cases_resolved: 45
        });
      } catch (error) {
        console.error('Error fetching team data:', error);
      } finally {
        setUsersLoading(false);
      }
    };
    fetchTeamData();
  }, []);

  const sortColumns = useMemo(() => ({
    member: { ...SORT_COLUMNS.member, label: t('team.columns.member') },
    role: { ...SORT_COLUMNS.role, label: t('team.columns.role'), value: (member) => nameFor(member.role).toLowerCase() },
    email: { ...SORT_COLUMNS.email, label: t('team.columns.email') },
  }), [nameFor, t]);
  const sort = useTableSort(team, sortColumns, { defaultSortBy: 'member' });
  const { sortedRows: sortedTeam, getHeaderProps } = sort;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-accent! text-on-accent border-none text-start">
          <div className="flex items-center gap-3 opacity-80">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">{t('team.stats.avgResolution')}</span>
          </div>
          {stats ? (
            <p className="text-3xl font-bold mt-2">{t('team.days', { count: stats.avg_resolution })}</p>
          ) : (
            <Skeleton.Text size="3xl" className="mt-2 w-24" />
          )}
          <p className="text-xs mt-4 opacity-70 text-start">{t('team.stats.trend', { percent: 12 })}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-3 text-ink-muted">
            <Activity className="h-5 w-5" />
            <span className="text-sm font-medium">{t('team.stats.active')}</span>
          </div>
          {stats ? (
            <p className="text-3xl font-bold text-ink mt-2">{stats.total_active}</p>
          ) : (
            <Skeleton.Text size="3xl" className="mt-2 w-24" />
          )}
          <p className="text-xs text-success-fg mt-4 font-medium text-start">{t('team.stats.optimal')}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-3 text-ink-muted">
            <Award className="h-5 w-5" />
            <span className="text-sm font-medium">{t('team.stats.resolved')}</span>
          </div>
          {stats ? (
            <p className="text-3xl font-bold text-ink mt-2">{stats.cases_resolved}</p>
          ) : (
            <Skeleton.Text size="3xl" className="mt-2 w-24" />
          )}
          <p className="text-xs text-ink-muted mt-4 leading-relaxed text-start">{t('team.stats.resolvedHint')}</p>
        </Card>
      </div>

      <Card padding="none">
        <Card.Header className="p-4 sm:p-6 border-b border-line-subtle flex flex-wrap items-center justify-between gap-3">
          <Card.Title className="flex items-center">
            <Users className="h-5 w-5 me-2 text-accent-fg" />
            {t('team.title')}
          </Card.Title>
          <div className="flex flex-wrap items-center gap-2">
            <TableSortControl {...sort} id="team" className="shrink-0" />
            {can(ACCESS.roles) && (
              <Button variant="secondary" size="small" to={staffPath(orgSlug, 'roles')}>{t('team.manageRoles')}</Button>
            )}
          </div>
        </Card.Header>
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              <Table.Head {...getHeaderProps('member')}>{t('team.columns.member')}</Table.Head>
              <Table.Head {...getHeaderProps('role')}>{t('team.columns.role')}</Table.Head>
              <Table.Head>{t('team.columns.workload')}</Table.Head>
              <Table.Head>{t('team.columns.avgTime')}</Table.Head>
              <Table.Head>{t('team.columns.status')}</Table.Head>
              <Table.Head><span className="sr-only">{t('team.columns.actions')}</span></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading
                rows={8}
                cells={[
                  <div key="m" className="flex items-center gap-3">
                    <Skeleton.Circle />
                    <div className="space-y-0.5">
                      <Skeleton.Text className="w-28" />
                      <Skeleton.Text size="xs" className="w-40" />
                    </div>
                  </div>,
                  <Skeleton.Badge key="r" className="w-16" />,
                  <div key="w" className="w-24 space-y-1">
                    <Skeleton.Text size="2xs" className="w-full" />
                    <Skeleton className="h-1 w-full rounded-full" />
                  </div>,
                  <Skeleton.Text key="t" className="w-16" />,
                  <Skeleton.Text key="s" size="xs" className="w-14" />,
                  <Skeleton key="a" className="ms-auto h-8 w-10 rounded-lg" />,
                ]}
              />
            ) : sortedTeam.length === 0 ? (
              <Table.Empty message={t('team.emptyTitle')} description={t('team.emptyDescription')} icon={Users} />
            ) : (
              sortedTeam.map((member) => (
                <Table.Row key={member.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-3 text-start">
                      <div className="h-10 w-10 rounded-full bg-active flex items-center justify-center text-ink-muted font-bold uppercase shrink-0">
                        {member.first_name?.charAt(0)}{member.last_name?.charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-ink truncate">{member.first_name} {member.last_name}</span>
                        <span className="text-xs text-ink-muted flex items-center truncate">
                          <Mail className="h-3 w-3 me-1 shrink-0" /> {member.email}
                        </span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="purple" size="small">{nameFor(member.role)}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col gap-1 w-24">
                      <div className="flex justify-between text-[10px] text-ink-muted">
                        <span>{t('team.activeCount', { count: 3 })}</span>
                        <span>75%</span>
                      </div>
                      <div className="w-full bg-active rounded-full h-1">
                        <div className="bg-accent h-1 rounded-full" style={{ width: '75%' }} />
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ink-muted font-medium">
                    {t('team.days', { count: 3.8 })}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center text-xs text-success-fg font-medium whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-success-solid me-2" />
                      {t('team.online')}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-end">
                    <Button variant="ghost" size="small" aria-label={t('team.openMember', { name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email })}>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Card>
    </div>
  );
};

export default ComplianceTeam;
