import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Shield,
  FileText,
  Download,
  Loader,
  Lock,
  MessageSquare,
  Clock,
  Send,
  Sparkles,
  Route,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Skeleton from '../../components/ui/Skeleton';
import Button from "../../components/ui/Button";
import Badge, { StatusBadge, PriorityBadge } from "../../components/ui/Badge";
import { Textarea } from "../../components/ui/Input";
import { reportsAPI, reportTypesAPI, messagesAPI, usersAPI } from "../../api";
import { useCan } from "../../hooks/useCan";
import { useOrgRoles, roleCanWorkReports } from "../../hooks/useOrgRoles";
import { PERM } from "../../utils/permissions";
import { parseServerDate } from "../../utils/formatters";
import VoiceAnswers from '../../components/reports/VoiceAnswers';
import DigestPanel from '../../components/reports/DigestPanel';
import EscalationPreview from '../../components/reports/EscalationPreview';
import EscalationRecord, { hasEscalationRecord } from '../../components/reports/EscalationRecord';
import { staffPath } from '../../utils/navigation';
import { getReportDescription, getReportTitle } from '../../utils/reports';
import toast from "react-hot-toast";
import { formatFileSize, formatRelativeTime, formatDateTime, formatDate } from "../../utils/formatters";
import useSEO from "../../hooks/useSEO";
import { normalizeListResponse } from '../../utils/pagination';
import { formatCurrencyAnswer, isCurrencyAnswer } from '../../utils/reportTypes';

const STATUS_OPTIONS = [
  // { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

/** The case page while it loads: the same cards and grid, data stubbed. */
const CaseDetailSkeleton = ({ showDigest, showEscalation, showActions, onBack }) => (
  <div className="space-y-6" aria-busy="true">
    <Button variant="ghost" size="small" onClick={onBack}>
      <ArrowLeft className="h-4 w-4 mr-1" /> Back
    </Button>
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="flex flex-col">
        <Skeleton.Text size="xl" className="w-44" />
        <Skeleton.Text className="w-28" />
      </div>
      <div className="flex space-x-2">
        {showActions && <Skeleton.Button className="w-24" />}
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {showDigest && (
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-fg" />
                AI summary
              </Card.Title>
              <Card.Description>A factual digest of the evidence files on this report.</Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-11/12" />
                <Skeleton className="h-3 w-4/6" />
              </div>
            </Card.Content>
          </Card>
        )}

        <Card>
          <Card.Header>
            <Card.Title>Original Submission</Card.Title>
            <Skeleton.Text className="w-56" />
          </Card.Header>
          <Card.Content className="space-y-4">
            <Skeleton.Text size="base" className="w-2/3" />
            <div className="bg-subtle p-4 rounded-lg border border-line-subtle">
              <Skeleton.Lines size="base" lines={4} />
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-lg bg-subtle px-3 py-2.5">
                  <Skeleton.Text size="xs" className="w-28" />
                  <Skeleton.Text className="w-3/4" />
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex items-center justify-between border-b border-line-subtle">
            <Card.Title className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-accent-fg" />
              Case Timeline
            </Card.Title>
          </Card.Header>
          <Card.Content className="pt-6">
            <div className="flex space-x-3">
              <Skeleton.Circle size="h-8 w-8" />
              <div className="flex-1">
                <Skeleton.Text className="w-32" />
                <Skeleton.Text size="xs" className="mt-0.5 w-40" />
                <Skeleton.Text className="mt-2 w-3/4" />
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <Card.Header>
            <Card.Title>Case Details</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-6">
            {['Status', 'Priority', 'Assigned By', 'Assigned To'].map((label, index) => (
              <div key={label} className="space-y-1">
                <p className="text-xs font-semibold text-ink-muted uppercase">{label}</p>
                {index < 2 ? <Skeleton.Badge className="w-20" /> : <Skeleton.Text className="w-28" />}
              </div>
            ))}
          </Card.Content>
        </Card>

        {showEscalation && (
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <Route className="h-4 w-4 text-accent-fg" />
                Escalation route
              </Card.Title>
              <Card.Description>
                Who this report would go to, based on the people it names and your reporting hierarchy. Nothing is changed.
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton.Button className="w-full" />
                <Skeleton.Text size="xs" className="w-48" />
              </div>
            </Card.Content>
          </Card>
        )}

        <Card>
          <Card.Header>
            <Card.Title className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-accent-fg" />
              Evidence & Files
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <Skeleton.Text className="w-40" />
          </Card.Content>
        </Card>
      </div>
    </div>
  </div>
);

const CaseDetail = () => {
  const { id, orgSlug } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [reportTypes, setReportTypes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [loading, setLoading] = useState(true);
  // A 404 is an ordinary "not found". It is also what a person locked out of
  // a case by an escalation rule gets, so nothing here may hint otherwise.
  const [notFound, setNotFound] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const can = useCan();
  const canAssignReports = can(PERM.reportManage);
  const canUpdateStatus = can(PERM.reportManage);
  // Roles are organization-defined, so who can take a case comes from the
  // organization's own role list rather than a fixed table: anyone whose role
  // can open the report once it is theirs.
  const { roles: orgRoles } = useOrgRoles({ enabled: canAssignReports });
  const assignableUsers = useMemo(() => {
    const assigneeRoles = new Set(orgRoles.filter(roleCanWorkReports).map((role) => role.code));
    return users.filter((user) => assigneeRoles.has(user.role));
  }, [users, orgRoles]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const [reportData, typesData] = await Promise.all([
        reportsAPI.getReport(id),
        reportTypes.length === 0
          ? reportTypesAPI.getReportTypes()
          : Promise.resolve(reportTypes),
      ]);

      setReport(reportData);
      if (reportTypes.length === 0) setReportTypes(typesData);
      const reportNumber = reportData?.report_number || reportData?.reportNumber || id;
      const messagesData = await messagesAPI.getReportMessages(reportNumber, true);
      setMessages(messagesData);

      // Users for assignee/assigner display and the assignment modal. Loaded
      // in the background so the case shows without waiting on the whole
      // user list; fail-soft for roles that can't list users.
      usersAPI
        .getAllUsers()
        .then((usersData) => setUsers(normalizeListResponse(usersData).items))
        .catch(() => setUsers([]));
    } catch (error) {
      if (error?.response?.status === 404) {
        setNotFound(true);
      } else {
        console.error("Error fetching report detail:", error);
        toast.error("Failed to load case details");
      }
    } finally {
      setLoading(false);
    }
  }, [id, reportTypes.length]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleUpdateStatus = async (newStatus) => {
    if (!canUpdateStatus) {
      toast.error("You are not allowed to update status");
      return;
    }
    if (!STATUS_OPTIONS.some((status) => status.value === newStatus)) {
      toast.error("Invalid status");
      return;
    }
    if (report?.status === newStatus) {
      return;
    }

    setUpdating(true);
    try {
      await reportsAPI.updateReport(report?.id || id, { status: newStatus });
      toast.success("Status updated");
      fetchReport();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const getUserNameFromRef = useCallback((userRef) => {
    if (!userRef) return "Unassigned";
    if (typeof userRef === "object") {
      return userRef.full_name || userRef.username || userRef.email || "Unknown User";
    }
    const foundUser = users.find((user) => String(user.id) === String(userRef));
    return foundUser?.full_name || foundUser?.username || String(userRef);
  }, [users]);

  const formatFormValue = (value) => {
    if (isCurrencyAnswer(value)) return formatCurrencyAnswer(value) || "N/A";
    if (value === null || value === undefined || value === "") return "N/A";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.length ? value.join(", ") : "N/A";
    if (typeof value === "object") return JSON.stringify(value);

    const str = String(value);

    // Match ISO 8601 date/time patterns:
    //   2026-06-27T14:15:29+05:00
    //   2026-06-27T09:15:29Z
    //   2026-06-27T09:15:29.000Z
    //   2026-06-27 (date-only)
    const iso8601Regex =
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

    if (iso8601Regex.test(str.trim())) {
      // Use date-only format when there's no time component
      const hasTime = str.includes("T");
      return hasTime ? formatDateTime(str) : formatDate(str);
    }

    return str;
    // return String(value);
  };

  const resolveMessageTimestamp = (msg) => {
    const raw =
      msg?.timestamp ??
      msg?.created_at ??
      msg?.createdAt ??
      msg?.updated_at ??
      msg?.updatedAt;
    if (!raw) return null;

    return parseServerDate(raw);
  };

  const handleDownloadAttachment = async (file) => {
    if (!report?.report_number || !file?.key) return;
    setDownloadingKey(file.key);
    try {
      const result = await reportsAPI.getAttachmentDownloadUrl(report.report_number, file.key);
      if (result?.download_url) {
        window.open(result.download_url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Download URL not available");
      }
    } catch (error) {
      console.error("Failed to download attachment:", error);
      toast.error("Failed to download file");
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    if (!report?.report_number) {
      toast.error("Report number not available");
      return;
    }

    setSendingMessage(true);
    try {
      const payload = {
        content: messageText.trim(),
        report_number: report.report_number,
        is_internal: isInternal,
      };
      const created = await messagesAPI.sendMessage(payload);
      setMessages((prev) =>
        [...prev, created].sort(
          (a, b) => (a?.timestamp || 0) - (b?.timestamp || 0),
        ),
      );
      setMessageText("");
      toast.success(isInternal ? "Internal note added" : "Message sent");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAssign = async (userId) => {
    if (!canAssignReports) {
      toast.error("You are not allowed to assign cases");
      return;
    }

    if (!assignableUsers.some((user) => String(user.id) === String(userId))) {
      toast.error("You cannot assign this case to the selected role");
      return;
    }

    setUpdating(true);
    try {
      await reportsAPI.updateReport(report?.id || id, { assigned_to: userId });
      setShowAssignModal(false);
      toast.success("Case assigned");
      fetchReport();
    } catch (error) {
      console.error("Error assigning case:", error);
      toast.error("Failed to assign case");
    } finally {
      setUpdating(false);
    }
  };

  // Dynamic title/description. Using the hook (instead of <SEO />) keeps it out
  // of the early-return branches below, so it stays mounted across loading states.
  useSEO({
    enabled: !loading && !!report,
    title: report
      ? [`Case #${report.report_number || id}`, getReportTitle(report)].filter(Boolean).join(' — ')
      : '',
    description: report?.description,
    noIndex: true, // authenticated case data must never be indexed
  });

  // Only the first load shows the skeleton; a refresh after a change keeps
  // the case on screen.
  if (loading && !report) {
    return (
      <CaseDetailSkeleton
        showDigest={can(PERM.agentSummaryRead)}
        showEscalation={can(PERM.hierarchyRead)}
        showActions={canAssignReports}
        onBack={() => navigate(-1)}
      />
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-base font-semibold text-ink">{notFound ? "Case not found" : "This case couldn't be loaded"}</p>
        <p className="mt-1 text-sm text-ink-muted">
          {notFound ? "Check the link, or find the case from the reports list." : "Try again in a moment."}
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 text-sm font-semibold text-link hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  // Both optional: written by the voice agent when it files a report, absent
  // on plenty of others. Shown only when present.
  const reportTitle = getReportTitle(report);
  const reportDescription = getReportDescription(report);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Button variant="ghost" size="small" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-ink">
              Case #{report.report_number}
            </h2>
            <p className="text-sm text-ink-muted">
              {report.report_type_name ||
                reportTypes.find((t) => t.id === report.report_type_id)?.name ||
                "AI Assisstant"}
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          {canAssignReports && (
            <Button
              variant="secondary"
              startIcon={UserPlus}
              onClick={() => setShowAssignModal(true)}
            >
              Assign
            </Button>
          )}
          <select
            className="border-line-strong rounded-lg shadow-sm focus:ring-accent-ring focus:border-line-accent text-sm px-3 py-2"
            value={report.status}
            onChange={(e) => handleUpdateStatus(e.target.value)}
            disabled={updating || !canUpdateStatus}
          >
            {STATUS_OPTIONS.map((statusOption) => (
              <option key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* The AI digest — agent:summary_read, deliberately not agent:read:
              reading a case's summary is not administering the agents. */}
          {can(PERM.agentSummaryRead) && <DigestPanel reportId={report?.id || id} attachmentCount={report ? (report.attachments || []).length : null} />}

          {/* Report Summary */}
          <Card>
            <Card.Header>
              <Card.Title>Original Submission</Card.Title>
              <Card.Description>
                Submitted on {parseServerDate(report.created_at)?.toLocaleString() || 'N/A'}
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-4">
              {reportTitle && (
                <h3 className="text-base font-semibold text-ink wrap-break-word">
                  {reportTitle}
                </h3>
              )}

              {reportDescription && (
                <div className="bg-subtle p-4 rounded-lg border border-line-subtle">
                  <p className="text-ink whitespace-pre-wrap wrap-break-word">
                    {reportDescription}
                  </p>
                </div>
              )}

              {/* Collected by the voice agent. Preferred over the flat
                  form_data map: it keeps the question as it was asked and
                  distinguishes a declined answer from a missing one. */}
              <VoiceAnswers report={report} />

              {/* Custom Questionnaire Answers */}
              {report.form_data && Object.keys(report.form_data).length > 0 && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-semibold text-ink">
                    Additional Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(report.form_data).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <p className="text-xs font-medium text-ink-muted uppercase">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm text-ink wrap-break-word">{formatFormValue(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card.Content>
          </Card>

          {/* Investigation Timeline */}
          <Card>
            <Card.Header className="flex items-center justify-between border-b border-line-subtle">
              <Card.Title className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-accent-fg" />
                Case Timeline
              </Card.Title>
            </Card.Header>
            <Card.Content className="pt-6">
              <div className="flow-root">
                <ul className="-mb-8">
                  {messages.length === 0 ? (
                    <li className="text-center py-4 text-ink-muted text-sm italic">No timeline events yet.</li>
                  ) : (
                    messages.map((msg, idx) => (
                      <li key={msg.id || idx}>
                        <div className="relative pb-8">
                          {idx !== messages.length - 1 && (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-active" aria-hidden="true" />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-surface ${msg.is_internal ? 'bg-warning-soft' : 'bg-accent-soft'
                                }`}>
                                {msg.is_internal ? (
                                  <Lock className="h-4 w-4 text-warning-fg" />
                                ) : (
                                  <MessageSquare className="h-4 w-4 text-accent-fg" />
                                )}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-sm">
                                    <span className="font-medium text-ink">
                                      {msg?.sender?.name ||
                                        msg?.sender_name ||
                                        msg?.sender?.email ||
                                        msg?.sender?.id ||
                                        "System"}
                                    </span>
                                    {msg.is_internal && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-warning-soft text-warning-fg">
                                        INTERNAL
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-0.5 text-xs text-ink-muted">
                                    {formatDateTime(resolveMessageTimestamp(msg))}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 text-sm text-ink-secondary">
                                <p className="whitespace-pre-wrap wrap-break-word">
                                  {msg.content || msg.text || "No message content"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {/* Add Note Input */}
              <div className="mt-8 pt-6 border-t border-line-subtle">
                <div className="flex items-start space-x-4">
                  <div className="flex-1">
                    {can(PERM.messageReadInternal) && (
                      <div className="flex items-center space-x-4 mb-2">
                        <label className="flex items-center text-xs font-medium text-ink-secondary cursor-pointer">
                          <input
                            type="radio"
                            className="mr-1 text-accent-fg focus:ring-accent-ring"
                            checked={isInternal}
                            onChange={() => setIsInternal(true)}
                          />
                          Internal Note
                        </label>
                        <label className="flex items-center text-xs font-medium text-ink-secondary cursor-pointer">
                          <input
                            type="radio"
                            className="mr-1 text-accent-fg focus:ring-accent-ring"
                            checked={!isInternal}
                            onChange={() => setIsInternal(false)}
                          />
                          Public Message
                        </label>
                      </div>
                    )}
                    <Textarea
                      placeholder={
                        isInternal
                          ? "Add an internal note (only visible to team)..."
                          : "Send a message to the reporter..."
                      }
                      rows={3}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                    />
                    <div className="flex justify-between items-center mt-3">
                      <Button
                        variant="secondary"
                        size="small"
                        startIcon={Send}
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !messageText.trim()}
                        isLoading={sendingMessage}
                      >
                        {isInternal ? 'Add Note' : 'Send Message'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <Card.Header>
              <Card.Title>Case Details</Card.Title>
            </Card.Header>
            <Card.Content className="space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-ink-muted uppercase">
                  Status
                </p>
                <StatusBadge status={report.status} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-ink-muted uppercase">
                  Priority
                </p>
                <PriorityBadge priority={report.priority} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-ink-muted uppercase">Assigned By</p>
                <p className="text-sm font-medium text-ink wrap-break-word">
                  {getUserNameFromRef(report.assigned_by || report.assigned_by_user)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-ink-muted uppercase">Assigned To</p>
                <p className="text-sm font-medium text-ink wrap-break-word">
                  {getUserNameFromRef(report.assigned_to || report.assigned_to_user)}
                </p>
                {report.assigned_at && (
                  <p className="text-xs text-ink-muted">Assigned {formatRelativeTime(report.assigned_at)}</p>
                )}
              </div>

            </Card.Content>
            {/* <Card.Footer>
              <Button variant="ghost" fullWidth className="text-danger-fg hover:bg-danger-soft">
                <AlertTriangle className="h-4 w-4 mr-2" /> Report Conflict
              </Button>
            </Card.Footer> */}
          </Card>

          {/* What escalation routing did to this case */}
          {hasEscalationRecord(report) && (
            <EscalationRecord report={report} canReadHierarchy={can(PERM.hierarchyRead)} />
          )}

          {/* Who the people named in this report escalate to */}
          {can(PERM.hierarchyRead) && (
            <EscalationPreview
              report={report}
              hierarchyPath={staffPath(report?.organization_slug || orgSlug, 'hierarchy')}
            />
          )}

          {/* Evidence Card */}
          <Card>
            <Card.Header>
              <Card.Title className="flex items-center">
                <FileText className="h-5 w-5 mr-2 text-accent-fg" />
                Evidence & Files
              </Card.Title>
            </Card.Header>
            <Card.Content>
              {report.attachments && report.attachments.length > 0 ? (
                <ul className="divide-y divide-line-subtle">
                  {report.attachments.map((file, idx) => (
                    <li
                      key={idx}
                      className="py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-active rounded">
                          <FileText className="h-4 w-4 text-ink-muted" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-ink-secondary truncate max-w-30">
                            {file.filename || "Unnamed file"}
                          </span>
                          <span className="text-xs text-ink-muted">
                            {formatFileSize(file.size || 0)}
                          </span>
                          {file.uploaded_at && (
                            <span className="text-xs text-ink-subtle">
                              Uploaded {formatRelativeTime(file.uploaded_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => handleDownloadAttachment(file)}
                        disabled={downloadingKey === file.key}
                      >
                        {downloadingKey === file.key ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-6 text-ink-muted">
                  <p className="text-sm">No evidence attached.</p>
                </div>
              )}
            </Card.Content>
          </Card>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl">
            <Card.Header>
              <Card.Title>Assign Case</Card.Title>
              <Card.Description>
                Select an assignee. Only people whose role can open reports are listed.
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-4">
              <div className="max-h-60 overflow-y-auto divide-y divide-line-subtle">
                {assignableUsers.length === 0 && (
                  <div className="p-3 text-sm text-ink-muted">
                    No eligible assignees available.
                  </div>
                )}
                {assignableUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAssign(user.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-subtle rounded-lg transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-accent-soft flex items-center justify-center text-accent-fg font-bold">
                        {user.full_name?.charAt(0) ||
                          user.username?.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-ink group-hover:text-accent-fg transition-colors">
                          {user.full_name || user.username}
                        </p>
                        <p className="text-xs text-ink-muted uppercase">
                          {user.role}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink-subtle group-hover:text-accent-fg" />
                  </button>
                ))}
              </div>
            </Card.Content>
            <Card.Footer className="flex justify-end space-x-3 bg-subtle p-4">
              <Button variant="ghost" onClick={() => setShowAssignModal(false)}>
                Cancel
              </Button>
            </Card.Footer>
          </Card>
        </div>
      )}
    </div>
  );
};

export default CaseDetail;
