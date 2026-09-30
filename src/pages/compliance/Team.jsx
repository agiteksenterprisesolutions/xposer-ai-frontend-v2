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

// Only Member and Role are sortable: Workload, Avg. Time and Status are still
// hardcoded placeholders in the row markup, so ordering by them would sort
// every row by the same constant and imply data that isn't there yet.
const SORT_COLUMNS = {
  member: {
    label: 'Member',
    defaultOrder: 'asc',
    value: (m) => `${m.last_name || ''} ${m.first_name || ''} ${m.email || ''}`.trim().toLowerCase(),
  },
  // Roles have no rank any more; the page swaps in their display names.
  role: { label: 'Role', defaultOrder: 'asc', value: byText('role') },
  email: { label: 'Email', defaultOrder: 'asc', value: byText('email') },
};

const ComplianceTeam = () => {
  useSEO({
    title: 'Team',
    description: 'Members of your compliance team, their roles, and current case load.',
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
          avg_resolution: '4.2 days',
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
    ...SORT_COLUMNS,
    role: { ...SORT_COLUMNS.role, value: (member) => nameFor(member.role).toLowerCase() },
  }), [nameFor]);
  const sort = useTableSort(team, sortColumns, { defaultSortBy: 'member' });
  const { sortedRows: sortedTeam, getHeaderProps } = sort;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-accent text-on-accent border-none text-left">
          <div className="flex items-center space-x-3 opacity-80">
            <TrendingUp className="h-5 w-5" />
            <span className="text-sm font-medium">Avg. Resolution Time</span>
          </div>
          <p className="text-3xl font-bold mt-2">{stats?.avg_resolution}</p>
          <p className="text-xs mt-4 opacity-70 text-left">↓ 12% from last month</p>
        </Card>
        <Card>
          <div className="flex items-center space-x-3 text-ink-muted">
            <Activity className="h-5 w-5" />
            <span className="text-sm font-medium">Active Investigations</span>
          </div>
          <p className="text-3xl font-bold text-ink mt-2">{stats?.total_active}</p>
          <p className="text-xs text-success-fg mt-4 font-medium text-left">Optimal Distribution</p>
        </Card>
        <Card>
          <div className="flex items-center space-x-3 text-ink-muted">
            <Award className="h-5 w-5" />
            <span className="text-sm font-medium">Cases Resolved (YTD)</span>
          </div>
          <p className="text-3xl font-bold text-ink mt-2">{stats?.cases_resolved}</p>
          <p className="text-xs text-ink-muted mt-4 leading-relaxed text-left">System-wide resolution count</p>
        </Card>
      </div>

      <Card padding="none">
        <Card.Header className="p-6 border-b border-line-subtle flex items-center justify-between">
          <Card.Title className="flex items-center">
            <Users className="h-5 w-5 mr-2 text-accent-fg" />
            Compliance Personnel
          </Card.Title>
          <div className="flex items-center gap-2">
            <TableSortControl {...sort} id="team" className="shrink-0" />
            {can(ACCESS.roles) && (
              <Link to={staffPath(orgSlug, 'roles')}>
                <Button variant="secondary" size="small">Manage Roles</Button>
              </Link>
            )}
          </div>
        </Card.Header>
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              <Table.Head {...getHeaderProps('member')}>Member</Table.Head>
              <Table.Head {...getHeaderProps('role')}>Role</Table.Head>
              <Table.Head>Workload</Table.Head>
              <Table.Head>Avg. Time</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading colSpan={6} rows={5} />
            ) : sortedTeam.length === 0 ? (
              <Table.Empty message="No team members found" description="Personnel will appear here once assigned roles." icon={Users} />
            ) : (
              sortedTeam.map((member) => (
                <Table.Row key={member.id}>
                  <Table.Cell>
                    <div className="flex items-center space-x-3 text-left">
                      <div className="h-10 w-10 rounded-full bg-active flex items-center justify-center text-ink-muted font-bold uppercase shrink-0">
                        {member.first_name?.charAt(0)}{member.last_name?.charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-ink truncate">{member.first_name} {member.last_name}</span>
                        <span className="text-xs text-ink-muted flex items-center truncate">
                          <Mail className="h-3 w-3 mr-1 shrink-0" /> {member.email}
                        </span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="purple" size="small">{nameFor(member.role)}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col space-y-1 w-24">
                      <div className="flex justify-between text-[10px] text-ink-muted">
                        <span>3 Active</span>
                        <span>75%</span>
                      </div>
                      <div className="w-full bg-active rounded-full h-1">
                        <div className="bg-accent h-1 rounded-full" style={{ width: '75%' }} />
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ink-muted font-medium">
                    3.8 days
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center text-xs text-success-fg font-medium whitespace-nowrap">
                      <span className="h-1.5 w-1.5 rounded-full bg-success-solid mr-2" />
                      Online
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Button variant="ghost" size="small">
                      <ChevronRight className="h-4 w-4" />
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
