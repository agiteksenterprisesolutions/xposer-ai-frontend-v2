import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Settings,
  Trash2,
  Eye,
  EyeOff,
  Layout,
  ClipboardList,
  ChevronRight,
  Edit,
  ToggleLeft,
  ToggleRight,
  Search,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  ArrowDownUp,
  ChevronDown,
  FileSpreadsheet,
  Package,
} from "lucide-react";
import { toast } from "react-toastify";
import { Trans, useTranslation } from "react-i18next";
import { intlLocale, isRtl } from "../../utils/locale";
import { REPORT_TYPE_STATUSES, reportTypeStatus } from "../../utils/reportTypes";
import { Link, useNavigate, useParams } from "react-router-dom";
import Card from "../../components/ui/Card";
import Table, { TableLoading } from "../../components/ui/Table";
import Skeleton from '../../components/ui/Skeleton';
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Input from "../../components/ui/Input";
import Modal from "../../components/ui/Modal";
import Dropdown from "../../components/ui/Dropdown";
import Alert from "../../components/ui/Alert";
import Pagination from "../../components/ui/Pagination";
import { reportTypesAPI } from "../../api";
import { useAuthStore } from "../../store/authStore";
import { useCan } from "../../hooks/useCan";
import { ACCESS, PERM } from "../../utils/permissions";
import { saveBlob } from "../../utils/download";
import DashboardTour from "../../components/tour/DashboardTour";
import { useIsDesktop } from "../../components/tour/useIsDesktop";
import useSEO from '../../hooks/useSEO';
import { DEFAULT_PAGE_SIZE, normalizeListResponse } from '../../utils/pagination';
import TableSortControl from '../../components/ui/TableSortControl';
import { useTableSort, byText, byDate } from '../../hooks/useTableSort';
import { parseServerDate } from '../../utils/formatters';
import SectorPackInstall from '../../components/reportTypes/SectorPackInstall';

const STATUS_BADGE = { active: 'success', draft: 'default', inactive: 'warning' };
const STATUS_STYLE = {
  active: 'border-success-line bg-success-soft text-success-fg',
  draft: 'border-line-strong bg-surface text-ink-secondary',
  inactive: 'border-warning-line bg-warning-soft text-warning-fg',
};

const REPORT_TYPES_TOUR_KEY = 'xposer_report_types_tour_seen';

// Column order here is the column order in the table. Actions is not sortable,
// so it keeps a plain header.
// Built per render so the labels follow the interface language.
const sortColumns = (t) => ({
  name: { label: t('list.columns.name'), defaultOrder: 'asc', value: byText('name') },
  category: { label: t('list.columns.category'), defaultOrder: 'asc', value: (type) => (type.category || 'General').toLowerCase() },
  // Active first, then drafts, then withdrawn.
  status: { label: t('list.columns.status'), defaultOrder: 'asc', value: (type) => ({ active: 0, draft: 1, inactive: 2 })[reportTypeStatus(type)] },
  created_at: { label: t('list.columns.createdOn'), defaultOrder: 'desc', value: byDate('created_at') },
});

// The API sends naive UTC timestamps ("2026-08-20T10:50:37.782000"), which
// parseServerDate normalizes before converting to the viewer's local time.
const formatCreatedAt = (dateString) => {
  const date = parseServerDate(dateString);
  if (!date) return '—';
  return date.toLocaleDateString(intlLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ReportTypes = () => {
  const { t, i18n } = useTranslation('reportTypes');
  useSEO({
    title: t('list.seoTitle'),
    description: t('list.seoDescription'),
    noIndex: true,
  });
  const { user } = useAuthStore();
  const can = useCan();
  // REPORT_TYPE_STATUSES carries English labels; show ours, keep its as fallback.
  const statusLabel = (value) =>
    t(`status.${value}`, { defaultValue: REPORT_TYPE_STATUSES.find((s) => s.value === value)?.label || value });
  const statusHint = (value) =>
    t(`statusHint.${value}`, { defaultValue: REPORT_TYPE_STATUSES.find((s) => s.value === value)?.hint || '' });
  // report_type:read opens this page; changing anything on it needs manage.
  const canManage = can(PERM.reportTypeManage);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTypes, setTotalTypes] = useState(0);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [installingPack, setInstallingPack] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();

  // Debounce the search term so we don't fire a request on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef(null);
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setCurrentPage(1);
    }, 400);
  };

  // A search must cover every type, not just the page on screen. When the
  // server supports `search` it filters and pages; until it does (older
  // backends ignore the parameter), every page is fetched once per term
  // (cached while paging through the matches), filtered here and paged here.
  const searchCache = useRef({ key: null, matches: [] });
  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const term = debouncedSearch.trim().toLowerCase();
      if (term && (await reportTypesAPI.supportsSearch())) {
        searchCache.current = { key: null, matches: [] };
        const response = await reportTypesAPI.listReportTypes({
          page: currentPage,
          pageSize: DEFAULT_PAGE_SIZE,
          activeOnly: showActiveOnly,
          search: debouncedSearch.trim(),
        });
        const { items, total, totalPages: pages } = normalizeListResponse(response);
        setTypes(items);
        setTotalPages(pages);
        setTotalTypes(total);
        return;
      }
      if (term) {
        const key = `${term}|${showActiveOnly}`;
        if (searchCache.current.key !== key) {
          const all = [];
          for (let page = 1; page <= 50; page += 1) {
            const data = await reportTypesAPI.listReportTypes({
              page,
              pageSize: 100,
              activeOnly: showActiveOnly,
              includeSections: false,
            });
            const { items, hasNext } = normalizeListResponse(data);
            all.push(...items);
            if (!hasNext || items.length === 0) break;
          }
          searchCache.current = {
            key,
            matches: all.filter((t) =>
              [t.name, t.category, t.code].some((v) => (v || '').toLowerCase().includes(term)),
            ),
          };
        }
        const { matches } = searchCache.current;
        setTypes(matches.slice((currentPage - 1) * DEFAULT_PAGE_SIZE, currentPage * DEFAULT_PAGE_SIZE));
        setTotalPages(Math.max(1, Math.ceil(matches.length / DEFAULT_PAGE_SIZE)));
        setTotalTypes(matches.length);
        return;
      }
      searchCache.current = { key: null, matches: [] };
      const response = await reportTypesAPI.listReportTypes({
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
        activeOnly: showActiveOnly,
      });
      const { items, total, totalPages: pages } = normalizeListResponse(response);
      setTypes(items);
      setTotalPages(pages);
      setTotalTypes(total);
    } catch (error) {
      console.error("Error fetching report types:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, showActiveOnly, debouncedSearch]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  // `status` is a type's whole availability: draft and inactive are both
  // offered to nobody; only active reaches reporters.
  const [statusSaving, setStatusSaving] = useState(null);
  const handleStatusChange = async (type, status) => {
    if (status === reportTypeStatus(type)) return;
    setStatusSaving(type.id);
    try {
      await reportTypesAPI.setReportTypeStatus(type.id, status);
      setTypes((prev) => prev.map((t) => (t.id === type.id ? { ...t, status } : t)));
      searchCache.current.matches = searchCache.current.matches.map((t) => (t.id === type.id ? { ...t, status } : t));
      toast.success(
        status === "active"
          ? t('list.toast.active', { name: type.name })
          : status === "inactive"
            ? t('list.toast.inactive', { name: type.name })
            : t('list.toast.draft', { name: type.name }),
      );
      if (showActiveOnly) {
        // It may have left the filter; re-read rather than trust the cache.
        searchCache.current.key = null;
        fetchTypes();
      }
    } catch (error) {
      console.error("Error changing report type status:", error);
    } finally {
      setStatusSaving(null);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const { blob, filename } = await reportTypesAPI.downloadImportTemplate();
      saveBlob(blob, filename);
      toast.success(t('list.toast.templateDownloaded'));
    } catch (error) {
      console.error("Error downloading report type template:", error);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Follows the Active Only toggle, so what is exported is what is on screen.
  const handleExport = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await reportTypesAPI.exportReportTypes({ activeOnly: showActiveOnly });
      saveBlob(blob, filename);
      toast.success(t('list.toast.exported'));
    } catch (error) {
      console.error("Error exporting report types:", error);
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file twice still fires onChange.
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const result = await reportTypesAPI.importReportTypes(file);
      setImportResult(result);
      if (result.imported > 0) {
        toast.success(
          result.message ||
          t('list.toast.imported', { count: result.imported })
        );
        fetchTypes();
      } else {
        toast.warn(result.message || t('list.toast.noneCreated'));
      }
    } catch (error) {
      // A rejected import still carries the per-row problems worth showing.
      if (error.importResult) {
        setImportResult(error.importResult);
        toast.error(error.importResult.message || t('list.import.nothingImported'));
      } else {
        console.error("Error importing report types:", error);
      }
    } finally {
      setImporting(false);
    }
  };

  const matchingTypes = searchTerm.trim()
    ? types.filter((t) => {
      const q = searchTerm.toLowerCase();
      return (
        t.name?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.code?.toLowerCase().includes(q)
      );
    })
    : types;

  // Ordering the current page: the endpoint paginates server-side, so this
  // sorts the rows on screen rather than every report type.
  const SORT_COLUMNS = useMemo(() => sortColumns(t), [t, i18n.resolvedLanguage]);
  const sort = useTableSort(matchingTypes, SORT_COLUMNS, { defaultSortBy: 'name' });
  const { sortedRows: filteredTypes, getHeaderProps } = sort;

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-report-types"]',
        title: t('list.tour.sidebarTitle'),
        content: t('list.tour.sidebarBody'),
        // The sidebar sits on the inline-start side; point away from it.
        placement: isRtl() ? 'left' : 'right',
        skipBeacon: true,
      });
    }

    steps.push(
      {
        target: '[data-tour="types-search"]',
        title: t('list.tour.searchTitle'),
        content: t('list.tour.searchBody'),
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="types-toggle"]',
        title: t('list.tour.toggleTitle'),
        content: t('list.tour.toggleBody'),
        placement: 'bottom',
      },
      {
        target: '[data-tour="types-transfer"]',
        title: t('list.tour.transferTitle'),
        content: t('list.tour.transferBody'),
        placement: 'bottom',
      },
      {
        target: '[data-tour="types-create"]',
        title: t('list.tour.createTitle'),
        content: t('list.tour.createBody'),
        placement: 'bottom',
      },
      {
        target: '[data-tour="types-table"]',
        title: t('list.tour.tableTitle'),
        content: t('list.tour.tableBody'),
        placement: 'top',
      }
    );

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: t('list.tour.accountTitle'),
      content: t('list.tour.accountBody'),
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop, t, i18n.resolvedLanguage]);

  return (
    <div className="space-y-6">
      <DashboardTour ref={tourRef} storageKey={REPORT_TYPES_TOUR_KEY} steps={tourSteps} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80" data-tour="types-search">
          <Input
            placeholder={t('list.searchPlaceholder')}
            aria-label={t('list.searchLabel')}
            value={searchTerm}
            onChange={handleSearchChange}
            startAdornment={<Search className="h-4 w-4 text-ink-subtle" />}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* <TableSortControl {...sort} id="report-types" className="shrink-0" /> */}
          <button
            type="button"
            onClick={() => {
              setShowActiveOnly((prev) => !prev);
              setCurrentPage(1);
            }}
            className="flex items-center gap-2 text-sm text-ink-secondary"
            title={showActiveOnly ? t('list.filter.showingActive') : t('list.filter.showingAll')}
            aria-pressed={showActiveOnly}
            data-tour="types-toggle"
          >
            <span>{showActiveOnly ? t('list.filter.activeOnly') : t('list.filter.allTypes')}</span>
            <div
              className={`w-10 h-5 rounded-full transition-all relative ${showActiveOnly ? "bg-success-solid" : "bg-active"
                }`}
            >
              <div
                className={`absolute top-1 w-3 h-3 rounded-full bg-surface shadow-sm transition-all ${showActiveOnly ? "start-6" : "start-1"
                  }`}
              />
            </div>
          </button>

          {canManage && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleImportFile}
              />
              {/* Import creates; it never updates. It matches on name, so
                  re-importing an edited export fails once per existing type —
                  the label says so rather than inviting "re-import to update". */}
              <Dropdown
                align="right"
                width="lg"
                trigger={
                  <Button
                    variant="outline"
                    startIcon={ArrowDownUp}
                    endIcon={ChevronDown}
                    isLoading={downloadingTemplate || exporting || importing}
                    aria-haspopup="menu"
                    data-tour="types-transfer"
                  >
                    {t('list.transfer.button')}
                  </Button>
                }
              >
                <Dropdown.Item
                  onClick={handleExport}
                  title={showActiveOnly ? t('list.transfer.exportActiveTitle') : t('list.transfer.exportAllTitle')}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  {showActiveOnly ? t('list.transfer.exportActive') : t('list.transfer.exportAll')}
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item
                  onClick={() => fileInputRef.current?.click()}
                  title={t('list.transfer.importTitle')}
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  {t('list.transfer.import')}
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={handleDownloadTemplate}
                  title={t('list.transfer.templateTitle')}
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  {t('list.transfer.template')}
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item
                  onClick={() => setInstallingPack(true)}
                  title={t('list.transfer.packTitle')}
                >
                  <Package className="w-4 h-4 shrink-0" />
                  {t('list.transfer.pack')}
                </Dropdown.Item>
              </Dropdown>
              <Button
                variant="secondary"
                startIcon={Plus}
                onClick={() => navigate(`/${user?.organization_slug}/staff/create-report-type`)}
                data-tour="types-create"
              >
                {t('list.create')}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card padding="none" data-tour="types-table">
        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              {Object.entries(SORT_COLUMNS).map(([field, column]) => (
                <Table.Head key={field} {...getHeaderProps(field)}>
                  {column.label}
                </Table.Head>
              ))}
              <Table.Head className="text-end">{t('list.columns.actions')}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading
                rows={5}
                cells={[
                  <Skeleton.Text key="n" className="w-56" />,
                  <Skeleton.Badge key="c" className="w-14" />,
                  <Skeleton.Badge key="s" tall className="w-16" />,
                  <Skeleton.Text key="d" size="xs" className="w-36" />,
                  <div key="a" className="flex items-center justify-end gap-2">
                    <Skeleton className="h-8 w-10 rounded-lg" />
                    {canManage && <Skeleton className="h-8 w-10 rounded-lg" />}
                    {canManage && <Skeleton className="h-10 w-18 rounded-lg" />}
                  </div>,
                ]}
              />
            ) : filteredTypes.length === 0 ? (
              <Table.Empty
                message={
                  searchTerm
                    ? t('list.empty.noMatch')
                    : showActiveOnly
                      ? t('list.empty.noActive')
                      : t('list.empty.none')
                }
                description={
                  searchTerm
                    ? t('list.empty.noMatchHint')
                    : showActiveOnly
                      ? t('list.empty.noActiveHint')
                      : t('list.empty.noneHint')
                }
                icon={ClipboardList}
              />
            ) : (
              filteredTypes.map((type) => (
                <Table.Row
                  key={type.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/${user?.organization_slug}/staff/report-types/${type.id}/view`)}
                >
                  <Table.Cell>
                    <p className="text-sm font-semibold text-ink capitalize">
                      {type.name}
                    </p>
                    {type.code && <p className="font-mono text-xs text-ink-subtle">{type.code}</p>}
                    {/* Installed from a sector pack; it's the organization's own now. */}
                    {type.sector_pack?.code && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                        <Package className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {type.sector_pack.version != null
                          ? t('list.fromPackVersion', { code: type.sector_pack.code, version: type.sector_pack.version })
                          : t('list.fromPack', { code: type.sector_pack.code })}
                      </p>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="info" size="small">
                      {type.category || t('list.generalCategory')}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {canManage ? (
                      // Inside a clickable row, so the change must not open the type.
                      <div onClick={(e) => e.stopPropagation()}>
                        <select
                          aria-label={t('list.statusOf', { name: type.name })}
                          value={reportTypeStatus(type)}
                          disabled={statusSaving === type.id}
                          onChange={(e) => handleStatusChange(type, e.target.value)}
                          title={statusHint(reportTypeStatus(type))}
                          className={`h-8 rounded-lg border px-2 text-xs font-semibold outline-none focus:border-line-accent disabled:opacity-60 ${STATUS_STYLE[reportTypeStatus(type)]}`}
                        >
                          {REPORT_TYPE_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {statusLabel(s.value)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <Badge
                        variant={STATUS_BADGE[reportTypeStatus(type)]}
                        dot
                        title={statusHint(reportTypeStatus(type))}
                      >
                        {statusLabel(reportTypeStatus(type))}
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-ink-muted whitespace-nowrap">
                      {formatCreatedAt(type.created_at)}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-end">
                    {/* Sits inside a clickable row, so these must not bubble.
                        The guard is on this wrapper rather than the cell: the
                        mobile card layout renders cell children without the
                        cell's own props. */}
                    <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="small"
                        title={t('list.view')}
                        aria-label={t('list.viewName', { name: type.name })}
                        onClick={() =>
                          navigate(`/${user?.organization_slug}/staff/report-types/${type.id}/view`)
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="small"
                            title={t('list.edit')}
                            aria-label={t('list.editName', { name: type.name })}
                            onClick={() =>
                              navigate(`/${user?.organization_slug}/staff/report-types/${type.id}`)
                            }
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>

        {totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-line">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalTypes}
              pageSize={DEFAULT_PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      <SectorPackInstall
        isOpen={installingPack}
        onClose={() => setInstallingPack(false)}
        onInstalled={() => fetchTypes()}
      />

      <Modal
        isOpen={Boolean(importResult)}
        onClose={() => setImportResult(null)}
        title={t('list.import.title')}
        size="large"
        footer={
          <Button variant="secondary" onClick={() => setImportResult(null)}>
            {t('common:actions.close')}
          </Button>
        }
      >
        <div className="space-y-5">
          {importResult?.message && (
            <p className="text-sm text-ink">{importResult.message}</p>
          )}

          <div className="flex items-center gap-2 text-sm text-ink">
            {importResult?.imported > 0 ? (
              <CheckCircle className="h-4 w-4 text-success-solid" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-warning-solid" />
            )}
            <span>{t('list.import.count', { count: importResult?.imported || 0 })}</span>
          </div>

          {importResult?.created?.length > 0 && (
            <ul className="space-y-1 text-sm text-ink-secondary">
              {importResult.created.map((item, index) => (
                <li key={item.id ?? index} className="flex items-center gap-2">
                  <ChevronRight className="h-3.5 w-3.5 text-ink-subtle" />
                  <span className="capitalize">{item.name}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Import is all-or-nothing: one bad row means no type was created. */}
          {importResult?.problems?.length > 0 && !(importResult?.imported > 0) && (
            <Alert variant="error" title={t('list.import.nothingImported')}>
              {t('list.import.allOrNothing')}
            </Alert>
          )}

          {importResult?.warnings?.length > 0 && (
            <Alert variant="warning" title={t('list.import.warnings', { count: importResult.warnings.length })}>
              <ul className="list-disc space-y-1 ps-4">
                {importResult.warnings.map((warning, index) => (
                  <li key={index}>
                    {typeof warning === "string" ? warning : warning?.message || JSON.stringify(warning)}
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {importResult?.problems?.length > 0 && (() => {
            const errorsOf = (problem) =>
              typeof problem === "string"
                ? [problem]
                : Array.isArray(problem?.errors)
                  ? problem.errors.map((err) => (typeof err === "string" ? err : err?.message || JSON.stringify(err)))
                  : [problem?.message || JSON.stringify(problem)];
            // row: null is a problem with the whole file, not one row.
            const fileProblems = importResult.problems.filter((p) => typeof p === "string" || p?.row == null);
            const rowProblems = importResult.problems.filter((p) => typeof p !== "string" && p?.row != null);
            // Import matches on name and never updates, so a re-import of a
            // corrected file fails once per existing type.
            const alreadyExists = importResult.problems.some((p) => errorsOf(p).some((e) => /already exists/i.test(e)));
            // Default Owner / Alternate Owner naming a role the organization
            // doesn't have. The usual fix is to create that role.
            const unknownOwner = importResult.problems.some((p) =>
              errorsOf(p).some((e) => /is not a role in this organization|cannot own cases/i.test(e)),
            );
            return (
              <div className="space-y-4">
                {fileProblems.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <AlertTriangle className="h-4 w-4 text-warning-solid" />
                      {t('list.import.wholeFile', { count: fileProblems.length })}
                    </p>
                    <ul className="list-disc space-y-1 ps-5 text-sm text-ink-secondary marker:text-ink-subtle">
                      {fileProblems.flatMap((problem, index) =>
                        errorsOf(problem).map((err, errIndex) => <li key={`${index}-${errIndex}`}>{err}</li>),
                      )}
                    </ul>
                    {alreadyExists && (
                      <p className="text-xs text-ink-muted">{t('list.import.alreadyExistsHint')}</p>
                    )}
                  </div>
                )}
                {rowProblems.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <AlertTriangle className="h-4 w-4 text-warning-solid" />
                      {t('list.import.inRows', { count: rowProblems.length })}
                    </p>
                    <ul className="space-y-3 text-sm text-ink-secondary">
                      {rowProblems.map((problem, index) => (
                        <li key={index} className="space-y-1">
                          <p className="font-semibold text-ink">{t('list.import.row', { row: problem.row })}</p>
                          <ul className="list-disc space-y-1 ps-4 marker:text-ink-subtle">
                            {errorsOf(problem).map((err, errIndex) => (
                              <li key={errIndex}>{err}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {unknownOwner && (
                  <p className="text-xs text-ink-muted">
                    {can(ACCESS.roles) ? (
                      <Trans
                        t={t}
                        i18nKey="list.import.unknownOwnerLink"
                        components={{
                          roleLink: (
                            <Link to={`/${user?.organization_slug}/staff/roles`} className="font-medium text-link hover:underline" />
                          ),
                        }}
                      />
                    ) : (
                      t('list.import.unknownOwnerAsk')
                    )}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
};

export default ReportTypes;
