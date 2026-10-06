import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Briefcase,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Filter
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import { reportsAPI, reportTypesAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, useParams } from 'react-router-dom';
import { parseServerDate } from '../../utils/formatters';
import useSEO from '../../hooks/useSEO';
import { normalizeReportsResponse } from '../../utils/reports';
import TableSortControl from '../../components/ui/TableSortControl';
import {
  useTableSort,
  byDate,
  byText,
  byRank,
  PRIORITY_RANK,
  STATUS_RANK,
} from '../../hooks/useTableSort';

// Column order here is the column order in the table. The trailing action
// column is not sortable, so it keeps a plain header.
const buildSortColumns = (typeNameFor) => ({
  report_number: { label: 'Case ID', defaultOrder: 'desc', value: byText('report_number') },
  report_type_name: {
    label: 'Category',
    defaultOrder: 'asc',
    value: (report) => typeNameFor(report).toLowerCase(),
  },
  priority: { label: 'Priority', defaultOrder: 'desc', value: byRank('priority', PRIORITY_RANK) },
  updated_at: { label: 'Last Updated', defaultOrder: 'desc', value: byDate('updated_at') },
  status: { label: 'Status', defaultOrder: 'asc', value: byRank('status', STATUS_RANK) },
});

const MyCases = () => {
  useSEO({
    title: 'My Cases',
    description: 'The cases currently assigned to you for investigation.',
    noIndex: true,
  });
  const { user } = useAuthStore();
  const [reports, setReports] = useState([]);
  const [reportTypes, setReportTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const fetchMyCases = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch report types for name mapping
      if (reportTypes.length === 0) {
        const types = await reportTypesAPI.getReportTypes();
        setReportTypes(types);
      }

      const response = await reportsAPI.getAllReports({
        assigned_to: user?.id,
        search: searchTerm || undefined,
      });

      setReports(normalizeReportsResponse(response).items);
    } catch (error) {
      console.error('Error fetching my cases:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, searchTerm, reportTypes.length]);

  useEffect(() => {
    fetchMyCases();
  }, [fetchMyCases]);

  // Both the Category column and its sort key need the same fallback chain.
  const typeNameFor = useCallback((report) => (
    report.report_type_name
    || reportTypes.find((t) => t.id === report.report_type_id)?.name
    || 'AI Assisstant'
  ), [reportTypes]);

  const sortColumns = useMemo(() => buildSortColumns(typeNameFor), [typeNameFor]);
  const sort = useTableSort(reports, sortColumns, { defaultSortBy: 'updated_at' });
  const { sortedRows: sortedReports, getHeaderProps } = sort;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">My Assigned Cases</h2>
          <p className="text-sm text-ink-muted mt-1">Manage and update your active investigations</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Input
              placeholder="Search my cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              startAdornment={<Search className="h-4 w-4 text-ink-subtle" />}
            />
          </div>
          <TableSortControl {...sort} id="my-cases" className="shrink-0" />
        </div>
      </div>

      <Card padding="none">
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              {Object.entries(sortColumns).map(([field, column]) => (
                <Table.Head key={field} {...getHeaderProps(field)}>
                  {column.label}
                </Table.Head>
              ))}
              <Table.Head></Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading
                rows={5}
                cells={[
                  <Skeleton.Text key="id" className="w-20" />,
                  <Skeleton.Text key="c" className="w-24" />,
                  <Skeleton.Badge key="p" className="w-14" />,
                  <Skeleton.Text key="u" className="w-20" />,
                  <Skeleton.Badge key="s" className="w-20" />,
                  <Skeleton key="a" className="ml-auto h-8 w-10 rounded-lg" />,
                ]}
              />
            ) : sortedReports.length === 0 ? (
              <Table.Empty
                message="No assigned cases"
                description="You don't have any cases assigned to you at the moment."
                icon={Briefcase}
              />
            ) : (
              sortedReports.map((report) => (
                <Table.Row key={report.id}>
                  <Table.Cell className="font-medium text-ink">
                    #{report.report_number}
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ink-secondary">
                    {typeNameFor(report)}
                  </Table.Cell>
                  <Table.Cell>
                    <PriorityBadge priority={report.priority} />
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ink-muted">
                    {parseServerDate(report.updated_at)?.toLocaleDateString() || 'N/A'}
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={report.status} />
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => navigate(`/${user?.organization_slug}/staff/cases/${report.id}`)}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Card>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-accent-soft border-line-accent">
          <div className="flex items-center space-x-3 text-accent-fg">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Awaiting Action</span>
          </div>
          <p className="text-2xl font-bold text-accent-fg mt-2">{reports.filter(r => r.status === 'pending').length}</p>
        </Card>
        <Card className="bg-warning-soft border-warning-line">
          <div className="flex items-center space-x-3 text-warning-fg">
            <AlertCircle className="h-5 w-5" />
            <span className="font-semibold">High Priority</span>
          </div>
          <p className="text-2xl font-bold text-warning-fg mt-2">{reports.filter(r => r.priority === 'high' || r.priority === 'critical').length}</p>
        </Card>
        <Card className="bg-success-soft border-success-line">
          <div className="flex items-center space-x-3 text-success-fg">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">Resolved (Recent)</span>
          </div>
          <p className="text-2xl font-bold text-success-fg mt-2">{reports.filter(r => r.status === 'resolved').length}</p>
        </Card>
      </div>
    </div>
  );
};

export default MyCases;
