import React, { useState } from "react";
import { Link, useNavigate, useLocation, useParams } from "react-router-dom";
import {
  Search,
  Eye,
  EyeOff,
  Shield,
  Clock,
  MessageSquare,
  FileText,
  CheckCircle,
  ArrowRight,
  Copy,
  RefreshCw,
  Lock,
  Info,
  Printer,
  Mail,
  ExternalLink,
  Activity,
  Download,
  Bell,
  Settings,
  Loader,
} from "lucide-react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Alert from "../../components/ui/Alert";
import Badge, { StatusBadge, PriorityBadge } from "../../components/ui/Badge";
import ReportTimeline from "../../components/reports/ReportTimeline";
import ChatInterface from "../../components/reports/ChatInterface";
import { reportsAPI } from "../../api/reports";
import { messagesAPI } from "../../api/messages";
import { formatDate, formatFileSize, formatRelativeTime } from "../../utils/formatters";
import { toast } from 'react-toastify';
import { useAuthStore } from "../../store/authStore";
import { Trans, useTranslation } from "react-i18next";
import { SUPPORT_EMAIL } from "../../utils/constants";
import useSEO from '../../hooks/useSEO';
import { isDraftReport, getReportDescription, getReportTitle } from "../../utils/reports";
import { isIdentifiedUser, isStaffUser } from "../../utils/roles";
import { copyToClipboard } from "../../utils/clipboard";
import VoiceAnswers from "../../components/reports/VoiceAnswers";
import { formatAnswer, orderedAnswers } from '../../utils/reportAnswers';
import { useReportForm } from '../../hooks/useReportForm';

const TrackReport = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { t } = useTranslation("track");
  // Only a real reporter account can be served from its own report list.
  // Anonymous tracking sessions carry a token but own nothing, and staff
  // accounts have no `my reports` — both keep the password form.
  const usesAccount =
    isAuthenticated && isIdentifiedUser(user) && !isStaffUser(user);
  const [reportNumber, setReportNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  // Tracking returns the report's own form version inline as report_type.
  const reportForm = useReportForm(report);
  const [showDetails, setShowDetails] = useState(false);
  const [messages, setMessages] = useState([]);
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Title follows the view: the lookup form, or the report that was found.
  useSEO({
    title: showDetails && report ? t('seo.reportTitle', { number: report.report_number }) : t('seo.title'),
    description:
      showDetails && report
        ? t('seo.reportDescription', { number: report.report_number })
        : t('seo.description'),
    // Once a real report is on screen the page must stay out of search results.
    noIndex: showDetails,
  });

  // Handle report passed from Login page (if any)
  React.useEffect(() => {
    if (location.state?.trackedReport) {
      const trackedReport = location.state.trackedReport;
      setReport(trackedReport);
      setShowDetails(true);
      loadMessages(trackedReport.id);
    }
  }, [location.state]);

  // Arriving straight from the AI intake chat, which closes itself once the
  // report is filed. Only the number is handed over — the password is spoken
  // to the reporter and never travels, so they type it from their own note.
  React.useEffect(() => {
    if (location.state?.reportNumber) {
      setReportNumber(location.state.reportNumber);
    }
  }, [location.state]);

  const justSubmitted = Boolean(location.state?.justSubmitted);

  // Load messages for a report
  const loadMessages = async (reportId) => {
    try {
      const messagesResponse = await messagesAPI.getReporterMessages(reportId);
      setMessages(messagesResponse);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  };

  const { reporterLogin, user: authUser } = useAuthStore();

  // Opens a report the signed-in reporter already owns. Their own detail page
  // is the destination rather than the public one: it is reachable again on a
  // refresh, where the public page depends on router state it would not have.
  const trackFromAccount = async (number) => {
    const mine = await reportsAPI.getMyReports();
    const list = Array.isArray(mine) ? mine : mine?.items || mine?.results || [];
    const found = list.find(
      (item) =>
        String(item?.report_number || "").toLowerCase() === number.toLowerCase(),
    );

    if (!found) {
      setError(t("errors.notOnAccount"));
      return;
    }

    const slug = found.organization_slug ?? user?.organization_slug ?? orgSlug;
    const base = slug ? `/${slug}` : "";

    if (isDraftReport(found)) {
      toast.success(t("toast.draftFound"));
      navigate(`${base}/reporter/reports/${found.id}/edit`, {
        state: { report: found },
      });
      return;
    }

    toast.success(t("toast.reportFound"));
    navigate(`${base}/reporter/reports/${found.id}`, { state: { report: found } });
  };

  const handleTrack = async (e) => {
    e.preventDefault();

    // A signed-in reporter is identified by their session, so the report
    // password is neither asked for nor sent.
    if (!reportNumber.trim() || (!usesAccount && !password.trim())) {
      setError(
        usesAccount
          ? t("errors.enterNumber")
          : t("errors.enterBoth"),
      );
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // `POST /reports/track` authenticates with the report's own password and
      // requires it — there is no account path through it. So a signed-in
      // reporter is matched against their own report list instead, which is
      // JWT-authenticated and needs no password at all.
      if (usesAccount) {
        await trackFromAccount(reportNumber.trim());
        return;
      }

      const reportPassword = password.trim();
      const result = await reportsAPI.validateCredentials(reportNumber.trim(), reportPassword);

      if (result.valid) {
        const slug = result.report?.organization_slug ?? orgSlug;

        // An unsubmitted report goes back to the form so it can be finished;
        // a submitted one is read-only.
        if (isDraftReport(result.report)) {
          toast.success(t("toast.draftFound"));
          navigate(`/${slug ? slug : ""}/edit-draft/${result.report.report_number}`, {
            state: {
              report: result.report,
              password: reportPassword,
            },
          });
          return;
        }

        toast.success(t("toast.reportFound"));
        navigate(`/${slug ? slug : ""}/report-details/${result.report.report_number || result.report.id}`, {
          state: {
            report: result.report,
            // Null for a signed-in reporter: the detail page falls back to the
            // JWT, the same way every other report call does.
            password: reportPassword,
            fromTrackReport: true,
          },
        });
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error("Tracking error:", error);
      setError(
        usesAccount
          ? t("errors.couldNotOpen")
          : t("errors.invalidCredentials"),
      );
      toast.error(t("toast.notFound"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageData) => {
    if (!report) return;

    try {
      toast.error(
        t("toast.loginToMessage"),
      );
      return;
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error(t("toast.sendFailed"));
    }
  };

  const handleDownloadAttachment = async (file) => {
    if (!report?.report_number || !file?.key) return;
    setDownloadingKey(file.key);
    try {
      const result = await reportsAPI.getAttachmentDownloadUrl(
        report.report_number,
        file.key,
        password || null,
      );
      if (result?.download_url) {
        window.open(result.download_url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(t("toast.downloadUnavailable"));
      }
    } catch (error) {
      console.error("Failed to download attachment:", error);
      toast.error(t("toast.downloadFailed"));
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleCopyCredentials = async () => {
    // Nothing to copy but the number when the account is what opens the report.
    const text = usesAccount
      ? t("copy.numberOnly", { number: reportNumber })
      : t("copy.numberAndPassword", { number: reportNumber, password });
    if (await copyToClipboard(text)) {
      toast.success(t("toast.copied"));
    } else {
      toast.error(t("toast.copyFailed"));
    }
  };

  const handleReset = () => {
    setReportNumber("");
    setPassword("");
    setError("");
    setReport(null);
    setShowDetails(false);
    setMessages([]);
  };

  const renderTrackingForm = () => (
    <div className="max-w-6xl mx-auto">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-soft border border-line-accent rounded-2xl mb-4">
                <Search className="h-7 w-7 text-accent-fg" />
              </div>
              <h2 className="text-2xl font-bold text-ink mb-2">
                {t("form.title")}
              </h2>
              <p className="text-ink-muted">
                {usesAccount
                  ? t("form.introAccount")
                  : t("form.introAnonymous")}
              </p>
            </div>

            {justSubmitted && !error && (
              <Alert variant="success" className="mb-6">
                <div>
                  <p className="font-medium">{t("form.filedTitle")}</p>
                  <p className="text-sm mt-1">
                    {usesAccount
                      ? t("form.filedAccount")
                      : t("form.filedAnonymous")}
                  </p>
                </div>
              </Alert>
            )}

            {error && (
              <Alert variant="error" className="mb-6">
                <div className="flex items-start">
                  <div>
                    <p className="font-medium">{t("form.errorTitle")}</p>
                    <p className="text-sm mt-1 wrap-break-word">{error}</p>
                  </div>
                </div>
              </Alert>
            )}

            <form onSubmit={handleTrack} className="space-y-5">
              <div>
                <Input
 autoComplete="username"
                  label={t("form.reportNumber")}
                  value={reportNumber}
                  onChange={(e) => setReportNumber(e.target.value)}
                  maxLength={8}
                  startAdornment={<FileText className="w-4 h-4" />}
                  required
                />
                <p className="text-xs text-ink-subtle mt-1.5">
                  {t("form.reportNumberHint")}
                </p>
              </div>

              {/* The report password exists so an anonymous reporter can prove
                  the report is theirs. A signed-in one has already proved it,
                  and asking again invites them to fail at their own report. */}
              {usesAccount ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-line-subtle bg-subtle p-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" />
                  <p className="text-xs leading-relaxed text-ink-muted">
                    <Trans
                      t={t}
                      i18nKey="form.signedInAs"
                      values={{ account: user?.username || user?.email || t("form.yourAccount") }}
                      components={{ strong: <span className="font-medium text-ink" /> }}
                    />
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <Input
 autoComplete="current-password"
                    label={t("form.reportPassword")}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    startAdornment={<Lock className="w-4 h-4" />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-subtle hover:text-ink transition-colors absolute end-2 top-1/2 -translate-y-1/2"
                    aria-label={showPassword ? t("form.hidePassword") : t("form.showPassword")}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <p className="text-xs text-ink-subtle mt-1.5">
                    {t("form.reportPasswordHint")}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  isLoading={isLoading}
                  disabled={isLoading}
                  className="flex-1"
                  variant="secondary"
                  size="large"
                >
                  {isLoading ? t("form.searching") : t("form.submit")}
                  <ArrowRight className="ms-2 w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="large"
                  onClick={handleCopyCredentials}
                  title={t("form.copyTitle")}
                  disabled={!reportNumber && !password}
                  aria-label={t("form.copyLabel")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-line-subtle">
              <h3 className="text-sm font-semibold text-ink mb-4">
                {t("features.title")}
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-start">
                  <div className="shrink-0">
                    <div className="w-8 h-8 bg-success-soft rounded-lg flex items-center justify-center">
                      <Activity className="w-4 h-4 text-success-fg" />
                    </div>
                  </div>
                  <div className="ms-3">
                    <h4 className="text-sm font-medium text-ink">
                      {t("features.status")}
                    </h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {t("features.statusText")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="shrink-0">
                    <div className="w-8 h-8 bg-info-soft rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-info-fg" />
                    </div>
                  </div>
                  <div className="ms-3">
                    <h4 className="text-sm font-medium text-ink">
                      {t("features.messages")}
                    </h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {t("features.messagesText")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="shrink-0">
                    <div className="w-8 h-8 bg-accent-soft rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-accent-fg" />
                    </div>
                  </div>
                  <div className="ms-3">
                    <h4 className="text-sm font-medium text-ink">
                      {t("features.timeline")}
                    </h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {t("features.timelineText")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="shrink-0">
                    <div className="w-8 h-8 bg-warning-soft rounded-lg flex items-center justify-center">
                      <Shield className="w-4 h-4 text-warning-fg" />
                    </div>
                  </div>
                  <div className="ms-3">
                    <h4 className="text-sm font-medium text-ink">
                      {t("features.anonymous")}
                    </h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {t("features.anonymousText")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Important Notice */}
          <Alert variant="warning" className="mt-6">
            <div className="flex items-start">
              <div>
                <p className="font-medium">{t("notice.title")}</p>
                <p className="text-sm mt-1">
                  {t("notice.text")}
                </p>
              </div>
            </div>
          </Alert>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Security Features */}
          <Card>
            <div className="flex items-start mb-4">
              <Shield className="w-5 h-5 text-accent-fg me-3" />
              <h3 className="text-lg font-semibold text-ink">
                {t("privacy.title")}
              </h3>
            </div>
            <div className="space-y-3 text-sm text-ink-muted">
              <div className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 me-2 mt-0.5 shrink-0" />
                <span>{t("privacy.encryption")}</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 me-2 mt-0.5 shrink-0" />
                <span>{t("privacy.noPersonal")}</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 me-2 mt-0.5 shrink-0" />
                <span>{t("privacy.credentialsOnly")}</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 me-2 mt-0.5 shrink-0" />
                <span>{t("privacy.compliant")}</span>
              </div>
            </div>

          </Card>

        </div>
      </div>
    </div>
  );

  const renderReportDetails = () => {
    if (!report) return null;

    const {
      id,
      report_number,
      status,
      priority,
      created_at,
      updated_at,
      tags = [],
      form_data = {},
    } = report;

    // Optional on every report — shown only when there is something to show.
    const title = getReportTitle(report);
    const description = getReportDescription(report);

    return (
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-ink">
                  {t("details.title", { number: report_number })}
                </h1>
                <StatusBadge status={status} />
                <PriorityBadge priority={priority} />
              </div>
              <div className="flex items-center text-sm text-ink-muted">
                <Clock className="w-4 h-4 me-1.5" />
                {t("details.createdUpdated", { created: formatDate(created_at), updated: formatDate(updated_at) })}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="medium"
                onClick={() => window.print()}
                startIcon={Printer}
              >
                {t("details.print")}
              </Button>
              <Button
                variant="ghost"
                size="medium"
                onClick={handleReset}
                startIcon={RefreshCw}
              >
                {t("details.trackAnother")}
              </Button>
            </div>
          </div>
        </div>

        {/* Alert for anonymous tracking */}
        <Alert variant="info" className="mb-6">
          <div className="flex items-start">
            <Info className="w-5 h-5 me-3 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{t("details.anonymousTitle")}</p>
              <p className="text-sm mt-1">
                <Trans
                  t={t}
                  i18nKey="details.anonymousText"
                  components={{
                    lnk: <Link to="/register" className="underline font-medium hover:text-link-hover" />,
                  }}
                />
              </p>
            </div>
          </div>
        </Alert>

        <div className="grid lg:grid-cols-3 gap-6 min-w-0">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6 min-w-0">
            {/* Report Summary */}
            <Card className="min-w-0 overflow-hidden">
              {(title || description) && (
                <div className="mb-5 min-w-0">
                  {title && (
                    <h2 className="text-xl font-semibold text-ink mb-3 wrap-break-word">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-ink-secondary whitespace-pre-wrap wrap-break-word">
                      {description}
                    </p>
                  )}
                </div>
              )}

              <VoiceAnswers report={report} className="mb-5" />

              {Object.keys(form_data).length > 0 && (
                <div className="mb-5 min-w-0">
                  <h3 className="text-sm font-medium text-ink-muted mb-2">
                    {t("details.formData")}
                  </h3>
                  <div className="bg-subtle rounded-lg p-4 min-w-0 overflow-hidden space-y-3">
                    {orderedAnswers(form_data, reportForm).map(({ key, value, label, question }) => (
                      <div key={key} className="min-w-0 overflow-hidden">
                        <span className="block text-xs font-medium text-ink-subtle uppercase mb-1">
                          {label}
                        </span>
                        <span className="block text-ink wrap-break-word whitespace-pre-wrap">
                          {formatAnswer(value, question)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div className="mb-5 pb-5 border-b border-line-subtle">
                  <div className="flex items-center mb-2">
                    <FileText className="w-4 h-4 text-ink-subtle me-2" />
                    <span className="text-sm font-medium text-ink-muted">
                      {t("details.categories")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

            </Card>

            {/* Activity Timeline */}
            <Card>
              <div className="flex items-center mb-5">
                <Activity className="w-5 h-5 text-accent-fg me-3" />
                <h3 className="text-lg font-semibold text-ink">
                  {t("details.timeline")}
                </h3>
              </div>
              <ReportTimeline activities={report.activities || []} />
            </Card>

            {/* Communication Section */}
            <div className="chat-interface-wrapper">
              <ChatInterface
                messages={messages}
                currentUser={{
                  id: "anonymous",
                  full_name: t("details.anonymousReporter"),
                  role: "reporter",
                }}
                onSendMessage={handleSendMessage}
                isReporter={true}
                readOnly={true}
              />

              <div className="mt-5 bg-info-soft border border-info-line rounded-lg p-4">
                <div className="flex items-start">
                  <Bell className="w-5 h-5 text-info-fg me-3 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-ink mb-1">
                      {t("details.twoWayTitle")}
                    </h4>
                    <p className="text-sm text-ink-muted mb-3">
                      {t("details.twoWayText")}
                    </p>
                    <Button variant="secondary" size="small" to="/register">
                        {t("details.createFreeAccount")}
                        <ArrowRight className="ms-2 w-4 h-4" />
                      </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Overview */}
            <Card>
              <h3 className="text-lg font-semibold text-ink mb-4">
                {t("details.info")}
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium text-ink-subtle uppercase tracking-wide mb-1">
                    {t("details.status")}
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div>
                  <div className="text-xs font-medium text-ink-subtle uppercase tracking-wide mb-1">
                    {t("details.priority")}
                  </div>
                  <PriorityBadge priority={priority} />
                </div>
                <div className="pt-4 border-t border-line-subtle">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">{t("details.reportId")}</span>
                      <span className="font-mono text-ink break-all">{id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">{t("details.created")}</span>
                      <span className="font-medium text-ink">
                        {formatDate(created_at)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">{t("details.lastUpdated")}</span>
                      <span className="font-medium text-ink">
                        {formatDate(updated_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <Card>
              <h3 className="text-lg font-semibold text-ink mb-4">
                {t("details.actions")}
              </h3>
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4 me-3" />
                  {t("details.printDetails")}
                </Button>
                <Button variant="ghost" className="w-full justify-start" to="/submit-anonymous">
                    <FileText className="w-4 h-4 me-3" />
                    {t("details.submitAnother")}
                  </Button>
                <Button variant="ghost" className="w-full justify-start" to="/help">
                    <Info className="w-4 h-4 me-3" />
                    {t("details.getHelp")}
                  </Button>
              </div>
            </Card>

            {/* Upgrade Card */}
            <Card className="bg-accent-soft border-line-accent">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-full mb-3 shadow-sm">
                  <Settings className="w-6 h-6 text-accent-fg" />
                </div>
                <h3 className="font-semibold text-ink mb-2">
                  {t("details.unlockTitle")}
                </h3>
                <p className="text-sm text-ink-muted mb-4">
                  {t("details.unlockText")}
                </p>
                <Button
                    variant="secondary"
                    size="small"
                    className="w-full mb-2" to="/register">
                    {t("details.createAccount")}
                  </Button>
                <Link
                  to="/login"
                  className="text-xs text-accent-fg hover:opacity-80 font-medium"
                >
                  {t("details.signIn")}
                </Link>
              </div>
            </Card>

            {/* Security Notice */}
            <Card className="border-success-line bg-success-soft">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-success-fg me-3 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-ink mb-1">
                    {t("details.secureTitle")}
                  </h4>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    {t("details.secureText")}
                  </p>
                  <Link
                    to="/security"
                    className="text-xs text-success-fg hover:opacity-80 font-medium mt-2 inline-flex items-center"
                  >
                    {t("details.learnSecurity")}
                    <ExternalLink className="w-3 h-3 ms-1" />
                  </Link>
                </div>
              </div>
            </Card>

            {/* Evidence & Files Card */}
            {report.attachments && report.attachments.length > 0 && (
              <Card>
                <div className="flex items-center mb-4">
                  <FileText className="w-5 h-5 text-accent-fg me-3" />
                  <h3 className="text-lg font-semibold text-ink">
                    {t("details.evidence")}
                  </h3>
                </div>
                <ul className="divide-y divide-line-subtle">
                  {report.attachments.map((file, idx) => (
                    <li
                      key={idx}
                      className="py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-subtle rounded">
                          <FileText className="h-4 w-4 text-ink-subtle" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-ink-muted truncate max-w-35">
                            {file.filename || t("details.unnamedFile")}
                          </span>
                          <span className="text-xs text-ink-subtle">
                            {formatFileSize(file.size || 0)}
                          </span>
                          {file.uploaded_at && (
                            <span className="text-xs text-ink-subtle">
                              {t("details.uploaded", { when: formatRelativeTime(file.uploaded_at) })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => handleDownloadAttachment(file)}
                        disabled={downloadingKey === file.key}
                        title={t("details.download")}
                        aria-label={t("details.downloadFile", { name: file.filename || t("details.unnamedFile") })}
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
              </Card>
            )}

            {/* Support Card */}
            <Card>
              <div className="text-center">
                <Mail className="w-8 h-8 text-ink-subtle mx-auto mb-2" />
                <h4 className="font-medium text-ink mb-1">
                  {t("details.supportTitle")}
                </h4>
                <p className="text-xs text-ink-muted mb-3">
                  {t("details.supportText")}
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="inline-flex w-full items-center justify-center gap-2 h-8 px-3 text-xs font-semibold rounded-lg border bg-raised border-line text-ink no-underline hover:bg-hover hover:border-line-strong"
                >
                  <Mail className="w-4 h-4" aria-hidden="true" />
                  {t("details.contactSupport")}
                </a>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-canvas py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-soft border border-line-accent rounded-2xl mx-auto mb-4">
            <Search className="w-8 h-8 text-accent-fg" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-ink tracking-[-0.02em] mb-3">
            {usesAccount ? t("page.titleAccount") : t("page.titleAnonymous")}
          </h1>
          <p className="text-ink-muted max-w-2xl mx-auto">
            {usesAccount
              ? t("page.introAccount")
              : t("page.introAnonymous")}
          </p>
        </div>

        {!showDetails ? renderTrackingForm() : renderReportDetails()}
      </div>
    </div>
  );
};

export default TrackReport;
