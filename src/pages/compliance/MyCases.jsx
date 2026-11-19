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
import { reportsAPI } from '../../api';
import { useReportTypeNames } from '../../hooks/useReportTypeNames';
import { useAuthStore } from '../../store/authStore';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../utils/locale';
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
import { SlaCell, TierBadge, slaUrgency } from '../../components/reports/CaseGovernance';

// Column order here is the column order in the table. The trailing action
// column is not sortable, so it keeps a plain header.
const buildSortColumns = (typeNameFor, t) => ({
  report_number: { label: t('myCases.col.caseId'), defaultOrder: 'desc', value: byText('report_number') },
  report_type_name: {
    label: t('list.col.category'),
    defaultOrder: 'asc',
    value: (report) => (typeNameFor(report) || '').toLowerCase(),
  },
  priority: { label: t('list.col.priority'), defaultOrder: 'desc', value: byRank('priority', PRIORITY_RANK) },
  updated_at: { label: t('myCases.col.updated'), defaultOrder: 'desc', value: byDate('updated_at') },
  sla: { label: t('list.col.deadlines'), defaultOrder: 'asc', value: slaUrgency },
  status: { label: t('list.col.status'), defaultOrder: 'asc', value: byRank('status', STATUS_RANK) },
});

const MyCases = () => {
  const { t } = useTranslation('cases');
  useSEO({
    title: t('myCases.seoTitle'),
    description: t('myCases.seoDescription'),
    noIndex: true,
  });
  const { user } = useAuthStore();
  const [reports, setReports] = useState([]);
  // Names for the Category column, from the shared cached list of types —
  // loaded alongside the cases, never in front of them.
  const { typeName: typeNameFor } = useReportTypeNames();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const fetchMyCases = useCallback(async () => {
    setLoading(true);
    try {
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
  }, [user?.id, searchTerm]);

  useEffect(() => {
    fetchMyCases();
  }, [fetchMyCases]);

  const sortColumns = useMemo(() => buildSortColumns(typeNameFor, t), [typeNameFor, t]);
  const sort = useTableSort(reports, sortColumns, { defaultSortBy: 'updated_at' });
  const { sortedRows: sortedReports, getHeaderProps } = sort;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">{t('myCases.title')}</h2>
          <p className="text-sm text-ink-muted mt-1">{t('myCases.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Input
              placeholder={t('myCases.searchPlaceholder')}
              aria-label={t('myCases.search')}
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
              <Table.Head><span className="sr-only">{t('myCases.col.open')}</span></Table.Head>
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
                  <Skeleton.Badge key="sla" className="w-16" />,
                  <Skeleton.Badge key="s" className="w-20" />,
                  <Skeleton key="a" className="ms-auto h-8 w-10 rounded-lg" />,
                ]}
              />
            ) : sortedReports.length === 0 ? (
              <Table.Empty
                message={t('myCases.emptyTitle')}
                description={t('myCases.emptyBody')}
                icon={Briefcase}
              />
            ) : (
              sortedReports.map((report) => (
                <Table.Row key={report.id}>
                  <Table.Cell className="font-medium text-ink">
                    <div className="flex flex-col items-start gap-1">
                      <span dir="ltr">#{report.report_number}</span>
                      <TierBadge tier={report.confidentiality_tier} />
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ink-secondary" dir="auto">
                    {typeNameFor(report) ?? <Skeleton.Text className="w-24" />}
                  </Table.Cell>
                  <Table.Cell>
                    <PriorityBadge priority={report.priority} />
                  </Table.Cell>
                  <Table.Cell className="text-sm text-ink-muted">
                    {parseServerDate(report.updated_at)?.toLocaleDateString(intlLocale()) || t('detail.notAvailable')}
                  </Table.Cell>
                  <Table.Cell>
                    <SlaCell report={report} />
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge status={report.status} />
                  </Table.Cell>
                  <Table.Cell className="text-end">
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => navigate(`/${user?.organization_slug}/staff/cases/${report.id}`)}
                      aria-label={t('myCases.openCase', { number: report.report_number })}
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
          <div className="flex items-center gap-3 text-accent-fg">
            <Clock className="h-5 w-5" aria-hidden="true" />
            <span className="font-semibold">{t('myCases.awaiting')}</span>
          </div>
          <p className="text-2xl font-bold text-accent-fg mt-2">{reports.filter(r => r.status === 'pending').length}</p>
        </Card>
        <Card className="bg-warning-soft border-warning-line">
          <div className="flex items-center gap-3 text-warning-fg">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-semibold">{t('myCases.highPriority')}</span>
          </div>
          <p className="text-2xl font-bold text-warning-fg mt-2">{reports.filter(r => r.priority === 'high' || r.priority === 'critical').length}</p>
        </Card>
        <Card className="bg-success-soft border-success-line">
          <div className="flex items-center gap-3 text-success-fg">
            <CheckCircle className="h-5 w-5" aria-hidden="true" />
            <span className="font-semibold">{t('myCases.resolvedRecent')}</span>
          </div>
          <p className="text-2xl font-bold text-success-fg mt-2">{reports.filter(r => r.status === 'resolved').length}</p>
        </Card>
      </div>
    </div>
  );
};

export default MyCases;
