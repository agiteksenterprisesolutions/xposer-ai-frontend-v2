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
} from "lucide-react";
import { toast } from "react-toastify";
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

const STATUS_BADGE = { active: 'success', draft: 'default', inactive: 'warning' };
const STATUS_STYLE = {
  active: 'border-success-line bg-success-soft text-success-fg',
  draft: 'border-line-strong bg-surface text-ink-secondary',
  inactive: 'border-warning-line bg-warning-soft text-warning-fg',
};

const REPORT_TYPES_TOUR_KEY = 'xposer_report_types_tour_seen';

// Column order here is the column order in the table. Actions is not sortable,
// so it keeps a plain header.
const SORT_COLUMNS = {
  name: { label: 'Name', defaultOrder: 'asc', value: byText('name') },
  category: { label: 'Category', defaultOrder: 'asc', value: (type) => (type.category || 'General').toLowerCase() },
  // Active first, then drafts, then withdrawn.
  status: { label: 'Status', defaultOrder: 'asc', value: (type) => ({ active: 0, draft: 1, inactive: 2 })[reportTypeStatus(type)] },
  created_at: { label: 'Created On', defaultOrder: 'desc', value: byDate('created_at') },
};

// The API sends naive UTC timestamps ("2026-08-20T10:50:37.782000"), which
// parseServerDate normalizes before converting to the viewer's local time.
const formatCreatedAt = (dateString) => {
  const date = parseServerDate(dateString);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ReportTypes = () => {
  useSEO({
    title: 'Report Types',
    description: 'Manage the report categories and intake forms available to reporters.',
    noIndex: true,
  });
  const { user } = useAuthStore();
  const can = useCan();
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

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportTypesAPI.listReportTypes({
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
        activeOnly: showActiveOnly,
        search: debouncedSearch || undefined,
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
      toast.success(
        status === "active"
          ? `"${type.name}" is active — reporters can file it.`
          : status === "inactive"
            ? `"${type.name}" is withdrawn. Existing cases are unaffected.`
            : `"${type.name}" is a draft again — hidden from reporters.`,
      );
      if (showActiveOnly) fetchTypes();
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
      toast.success("Template downloaded");
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
      toast.success("Report types exported");
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
          `Imported ${result.imported} report type${result.imported === 1 ? "" : "s"}`
        );
        fetchTypes();
      } else {
        toast.warn(result.message || "No report types were created from this file");
      }
    } catch (error) {
      // A rejected import still carries the per-row problems worth showing.
      if (error.importResult) {
        setImportResult(error.importResult);
        toast.error(error.importResult.message || "Nothing was imported");
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
        t.category?.toLowerCase().includes(q)
      );
    })
    : types;

  // Ordering the current page: the endpoint paginates server-side, so this
  // sorts the rows on screen rather than every report type.
  const sort = useTableSort(matchingTypes, SORT_COLUMNS, { defaultSortBy: 'name' });
  const { sortedRows: filteredTypes, getHeaderProps } = sort;

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-report-types"]',
        title: 'Report Types',
        content: 'Define the categories reporters can choose from when filing a report.',
        placement: 'right',
        skipBeacon: true,
      });
    }

    steps.push(
      {
        target: '[data-tour="types-search"]',
        title: 'Search types',
        content: 'Quickly find a report type by name or category.',
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="types-toggle"]',
        title: 'Active Only filter',
        content: 'Toggle to show every type, or just the ones currently active.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="types-transfer"]',
        title: 'Import and export',
        content: 'Export your report types to Excel, or create several at once: download the blank template, fill in one row per question, then choose Import new types. Import only creates — it never updates an existing type.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="types-create"]',
        title: 'Create a new type',
        content: 'Add a new report category with its own custom questions.',
        placement: 'bottom',
      },
      {
        target: '[data-tour="types-table"]',
        title: 'Manage types',
        content: 'Edit a type, or toggle it active/inactive to control what reporters see.',
        placement: 'top',
      }
    );

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: 'Your account',
      content: 'Manage your profile or log out from here.',
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop]);

  return (
    <div className="space-y-6">
      <DashboardTour ref={tourRef} storageKey={REPORT_TYPES_TOUR_KEY} steps={tourSteps} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80" data-tour="types-search">
          <Input
            placeholder="Search by name or category..."
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
            title={showActiveOnly ? "Showing active report types only" : "Showing all report types"}
            data-tour="types-toggle"
          >
            <span>{showActiveOnly ? "Active Only" : "All Types"}</span>
            <div
              className={`w-10 h-5 rounded-full transition-all relative ${showActiveOnly ? "bg-success-solid" : "bg-active"
                }`}
            >
              <div
                className={`absolute top-1 w-3 h-3 rounded-full bg-surface shadow-sm transition-all ${showActiveOnly ? "left-6" : "left-1"
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
                    Import / Export
                  </Button>
                }
              >
                <Dropdown.Item
                  onClick={handleExport}
                  title={showActiveOnly ? "Export the active report types to Excel" : "Export every report type to Excel"}
                >
                  <Download className="w-4 h-4 shrink-0" />
                  {showActiveOnly ? "Export active types" : "Export all types"}
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item
                  onClick={() => fileInputRef.current?.click()}
                  title="Create new report types from a filled-in template. Existing types are not updated."
                >
                  <Upload className="w-4 h-4 shrink-0" />
                  Import new types
                </Dropdown.Item>
                <Dropdown.Item
                  onClick={handleDownloadTemplate}
                  title="Download a blank Excel template for bulk-importing report types"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" />
                  Download blank template
                </Dropdown.Item>
              </Dropdown>
              <Button
                variant="secondary"
                startIcon={Plus}
                onClick={() => navigate(`/${user?.organization_slug}/staff/create-report-type`)}
                data-tour="types-create"
              >
                Create New Type
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
              <Table.Head className="text-right">Actions</Table.Head>
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
                  <div key="a" className="flex items-center justify-end space-x-2">
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
                    ? 'No matching report types'
                    : showActiveOnly
                      ? "No active report types found"
                      : "No report types defined"
                }
                description={
                  searchTerm
                    ? 'Try a different search term.'
                    : showActiveOnly
                      ? "Turn off Active Only to view all report types"
                      : "Start by creating your first report category"
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
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="info" size="small">
                      {type.category || "General"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {canManage ? (
                      // Inside a clickable row, so the change must not open the type.
                      <div onClick={(e) => e.stopPropagation()}>
                        <select
                          aria-label={`Status of ${type.name}`}
                          value={reportTypeStatus(type)}
                          disabled={statusSaving === type.id}
                          onChange={(e) => handleStatusChange(type, e.target.value)}
                          title={REPORT_TYPE_STATUSES.find((s) => s.value === reportTypeStatus(type))?.hint}
                          className={`h-8 rounded-lg border px-2 text-xs font-semibold outline-none focus:border-line-accent disabled:opacity-60 ${STATUS_STYLE[reportTypeStatus(type)]}`}
                        >
                          {REPORT_TYPE_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <Badge
                        variant={STATUS_BADGE[reportTypeStatus(type)]}
                        dot
                        title={REPORT_TYPE_STATUSES.find((s) => s.value === reportTypeStatus(type))?.hint}
                      >
                        {REPORT_TYPE_STATUSES.find((s) => s.value === reportTypeStatus(type))?.label}
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-ink-muted whitespace-nowrap">
                      {formatCreatedAt(type.created_at)}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {/* Sits inside a clickable row, so these must not bubble.
                        The guard is on this wrapper rather than the cell: the
                        mobile card layout renders cell children without the
                        cell's own props. */}
                    <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="small"
                        title="View"
                        aria-label={`View ${type.name}`}
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
                            title="Edit"
                            aria-label={`Edit ${type.name}`}
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

      <Modal
        isOpen={Boolean(importResult)}
        onClose={() => setImportResult(null)}
        title="Import results"
        size="large"
        footer={
          <Button variant="secondary" onClick={() => setImportResult(null)}>
            Close
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
            <span>
              {importResult?.imported || 0} report type
              {importResult?.imported === 1 ? "" : "s"} imported
            </span>
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
            <Alert variant="error" title="Nothing was imported">
              The import is all-or-nothing, so none of the report types in this file were created. Fix the
              problems below and upload it again.
            </Alert>
          )}

          {importResult?.warnings?.length > 0 && (
            <Alert variant="warning" title={`Warnings (${importResult.warnings.length})`}>
              <ul className="list-disc space-y-1 pl-4">
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
                      About the whole file ({fileProblems.length})
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-ink-secondary marker:text-ink-subtle">
                      {fileProblems.flatMap((problem, index) =>
                        errorsOf(problem).map((err, errIndex) => <li key={`${index}-${errIndex}`}>{err}</li>),
                      )}
                    </ul>
                    {alreadyExists && (
                      <p className="text-xs text-ink-muted">
                        Importing never updates an existing type — it matches on the name. To replace one, delete it
                        here first, then import the file again.
                      </p>
                    )}
                  </div>
                )}
                {rowProblems.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <AlertTriangle className="h-4 w-4 text-warning-solid" />
                      In specific rows ({rowProblems.length})
                    </p>
                    <ul className="space-y-3 text-sm text-ink-secondary">
                      {rowProblems.map((problem, index) => (
                        <li key={index} className="space-y-1">
                          <p className="font-semibold text-ink">Row {problem.row}</p>
                          <ul className="list-disc space-y-1 pl-4 marker:text-ink-subtle">
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
                    Owner columns must name one of your roles, by code or name. Change the file to use an existing
                    role, or{" "}
                    {can(ACCESS.roles) ? (
                      <Link to={`/${user?.organization_slug}/staff/roles`} className="font-medium text-link hover:underline">
                        create the role
                      </Link>
                    ) : (
                      "ask an admin to create the role"
                    )}{" "}
                    first.
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
