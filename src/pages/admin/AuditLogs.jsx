import React, { useEffect, useState, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  Calendar,
  User,
  Activity,
  Download
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Pagination from '../../components/ui/Pagination';
import { analyticsAPI } from '../../api';
import { parseServerDate } from '../../utils/formatters';
import useSEO from '../../hooks/useSEO';
import TableSortControl from '../../components/ui/TableSortControl';
import { useTableSort, byDate, byText } from '../../hooks/useTableSort';

// Column order here is the column order in the table.
const SORT_COLUMNS = {
  created_at: { label: 'Time', defaultOrder: 'desc', value: byDate('created_at') },
  user: {
    label: 'User',
    defaultOrder: 'asc',
    value: (log) => (log.user_email || log.username || 'System').toLowerCase(),
  },
  action: { label: 'Action', defaultOrder: 'asc', value: byText('action') },
  entity_type: { label: 'Entity', defaultOrder: 'asc', value: (log) => (log.entity_type || 'System').toLowerCase() },
  details: { label: 'Details', defaultOrder: 'asc', value: byText('details') },
};

const AuditLogs = () => {
  useSEO({
    title: 'Audit Logs',
    description: 'A record of every significant action taken across the platform.',
    noIndex: true,
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await analyticsAPI.getActivityTimeline({
        page: currentPage,
        q: searchTerm
      });
      setLogs(response.activities || []);
      setTotalPages(response.total_pages || 1);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Ordering the current page: the endpoint paginates server-side, so this
  // sorts the rows on screen rather than the whole log.
  const sort = useTableSort(logs, SORT_COLUMNS, { defaultSortBy: 'created_at' });
  const { sortedRows: sortedLogs, getHeaderProps } = sort;

  const getLogVariant = (action) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('delete') || actionLower.includes('remove') || actionLower.includes('error')) return 'danger';
    if (actionLower.includes('create') || actionLower.includes('add')) return 'success';
    if (actionLower.includes('update') || actionLower.includes('change')) return 'warning';
    return 'info';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-96">
          <Input
            placeholder="Search logs by user or action..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            startAdornment={<Search className="h-4 w-4 text-ink-subtle" />}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <TableSortControl {...sort} id="audit-logs" className="shrink-0" />
          <Button variant="secondary" startIcon={Download}>Export CSV</Button>
          <Button variant="ghost" startIcon={Filter}>Filters</Button>
        </div>
      </div>

      <Card padding="none">
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              {Object.entries(SORT_COLUMNS).map(([field, column]) => (
                <Table.Head key={field} {...getHeaderProps(field)}>
                  {column.label}
                </Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading
                rows={8}
                cells={[
                  <Skeleton.Text key="t" size="xs" className="w-36" />,
                  <div key="u" className="flex items-center space-x-2">
                    <Skeleton.Circle size="h-6 w-6" />
                    <Skeleton.Text className="w-36" />
                  </div>,
                  <Skeleton.Badge key="a" className="w-16" />,
                  <Skeleton key="e" className="h-5 w-16 rounded" />,
                  <Skeleton.Text key="d" className="w-56" />,
                ]}
              />
            ) : sortedLogs.length === 0 ? (
              <Table.Empty
                message="No activity logs found"
                description="Activity within the system will appear here"
                icon={Activity}
              />
            ) : (
              sortedLogs.map((log, idx) => (
                <Table.Row key={log.id || idx}>
                  <Table.Cell className="whitespace-nowrap">
                    <div className="flex items-center text-xs text-ink-muted">
                      <Calendar className="h-3 w-3 mr-1.5" />
                      {parseServerDate(log.created_at)?.toLocaleString() || 'N/A'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-full bg-active flex items-center justify-center">
                        <User className="h-3 w-3 text-ink-muted" />
                      </div>
                      <span className="text-sm font-medium text-ink">{log.user_email || log.username || 'System'}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={getLogVariant(log.action)} size="small">
                      {log.action}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs font-mono bg-subtle px-1.5 py-0.5 rounded border border-line-subtle">
                      {log.entity_type || 'System'}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <p className="text-sm text-ink-muted max-w-md truncate" title={log.details}>
                      {log.details}
                    </p>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-line">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default AuditLogs;
