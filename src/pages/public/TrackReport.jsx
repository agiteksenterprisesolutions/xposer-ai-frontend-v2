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
import toast from "react-hot-toast";
import { useAuthStore } from "../../store/authStore";
import { SUPPORT_EMAIL } from "../../utils/constants";
import useSEO from '../../hooks/useSEO';
import { isDraftReport, getReportDescription, getReportTitle } from "../../utils/reports";
import { isIdentifiedUser, isStaffUser } from "../../utils/roles";
import { copyToClipboard } from "../../utils/clipboard";
import VoiceAnswers from "../../components/reports/VoiceAnswers";
import { formatCurrencyAnswer, isCurrencyAnswer } from '../../utils/reportTypes';

const TrackReport = () => {
  const { user, isAuthenticated } = useAuthStore();
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
  const [showDetails, setShowDetails] = useState(false);
  const [messages, setMessages] = useState([]);
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Title follows the view: the lookup form, or the report that was found.
  useSEO({
    title: showDetails && report ? `Report #${report.report_number}` : 'Track Your Report',
    description:
      showDetails && report
        ? `Status and activity timeline for anonymous report #${report.report_number}.`
        : 'Check the status of an anonymous report using your report number and password. No login or personal information required.',
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
      setError(
        "No report with that number was found on your account. If you filed it anonymously, sign out to track it with its password.",
      );
      return;
    }

    const slug = found.organization_slug ?? user?.organization_slug ?? orgSlug;
    const base = slug ? `/${slug}` : "";

    if (isDraftReport(found)) {
      toast.success("Draft found! Continue where you left off.");
      navigate(`${base}/reporter/reports/${found.id}/edit`, {
        state: { report: found },
      });
      return;
    }

    toast.success("Report found! Redirecting...");
    navigate(`${base}/reporter/reports/${found.id}`, { state: { report: found } });
  };

  const handleTrack = async (e) => {
    e.preventDefault();

    // A signed-in reporter is identified by their session, so the report
    // password is neither asked for nor sent.
    if (!reportNumber.trim() || (!usesAccount && !password.trim())) {
      setError(
        usesAccount
          ? "Please enter your report number"
          : "Please enter both report number and password",
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
          toast.success("Draft found! Continue where you left off.");
          navigate(`/${slug ? slug : ""}/edit-draft/${result.report.report_number}`, {
            state: {
              report: result.report,
              password: reportPassword,
            },
          });
          return;
        }

        toast.success("Report found! Redirecting...");
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
          ? "We could not open that report. Please try again."
          : "Invalid report number or password.",
      );
      toast.error("Failed to find report");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (messageData) => {
    if (!report) return;

    try {
      toast.error(
        "You must be logged in to send messages. Please create an account.",
      );
      return;
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
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
        toast.error("Download URL not available");
      }
    } catch (error) {
      console.error("Failed to download attachment:", error);
      toast.error("Failed to download file");
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleCopyCredentials = async () => {
    // Nothing to copy but the number when the account is what opens the report.
    const text = usesAccount
      ? `Report Number: ${reportNumber}`
      : `Report Number: ${reportNumber}\nPassword: ${password}`;
    if (await copyToClipboard(text)) {
      toast.success("Credentials copied to clipboard!");
    } else {
      toast.error("Could not copy — please select the credentials and copy them manually.");
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
                Track Your Report
              </h2>
              <p className="text-ink-muted">
                {usesAccount
                  ? "Enter the report number to check its status. You are signed in, so no report password is needed."
                  : "Enter your credentials to check the status of your anonymous report. No login required."}
              </p>
            </div>

            {justSubmitted && !error && (
              <Alert variant="success" className="mb-6">
                <div>
                  <p className="font-medium">Your report has been filed</p>
                  <p className="text-sm mt-1">
                    {usesAccount
                      ? "We have filled in your report number — open it below."
                      : "We have filled in your report number. Enter the password the assistant read out to you to open it."}
                  </p>
                </div>
              </Alert>
            )}

            {error && (
              <Alert variant="error" className="mb-6">
                <div className="flex items-start">
                  <div>
                    <p className="font-medium">Unable to find report</p>
                    <p className="text-sm mt-1 wrap-break-word">{error}</p>
                  </div>
                </div>
              </Alert>
            )}

            <form onSubmit={handleTrack} className="space-y-5">
              <div>
                <Input
                  label="Report Number"
                  value={reportNumber}
                  onChange={(e) => setReportNumber(e.target.value)}
                  maxLength={8}
                  startAdornment={<FileText className="w-4 h-4" />}
                  required
                />
                <p className="text-xs text-ink-subtle mt-1.5">
                  The 8-digit number provided when you submitted your report
                </p>
              </div>

              {/* The report password exists so an anonymous reporter can prove
                  the report is theirs. A signed-in one has already proved it,
                  and asking again invites them to fail at their own report. */}
              {usesAccount ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-line-subtle bg-subtle p-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" />
                  <p className="text-xs leading-relaxed text-ink-muted">
                    Signed in as{" "}
                    <span className="font-medium text-ink">
                      {user?.username || user?.email || "your account"}
                    </span>
                    . Reports filed under this account open without a report password.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    label="Report Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    startAdornment={<Lock className="w-4 h-4" />}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-ink-subtle hover:text-ink transition-colors absolute right-3 top-1/2 transform -translate-y-1/2"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <p className="text-xs text-ink-subtle mt-1.5">
                    The password you created when submitting your report
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
                  {isLoading ? "Searching..." : "Track Report"}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="large"
                  onClick={handleCopyCredentials}
                  title="Copy credentials to clipboard"
                  disabled={!reportNumber && !password}
                  aria-label="Copy report credentials"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-line-subtle">
              <h3 className="text-sm font-semibold text-ink mb-4">
                What you can do with tracking:
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-start">
                  <div className="skrink-0">
                    <div className="w-8 h-8 bg-success-soft rounded-lg flex items-center justify-center">
                      <Activity className="w-4 h-4 text-success-fg" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-ink">
                      Check Status
                    </h4>
                    <p className="text-xs text-ink-muted mt-0.5">
                      View current investigation progress
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="skrink-0">
                    <div className="w-8 h-8 bg-info-soft rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-info-fg" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-900">
                      View Messages
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Read updates from investigators
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="skrink-0">
                    <div className="w-8 h-8 bg-accent-soft rounded-lg flex items-center justify-center">
                      <Clock className="w-4 h-4 text-accent-fg" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-900">
                      Track Timeline
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      See all activities and updates
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="skrink-0">
                    <div className="w-8 h-8 bg-warning-soft rounded-lg flex items-center justify-center">
                      <Shield className="w-4 h-4 text-warning-fg" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-gray-900">
                      Stay Anonymous
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      No personal information required
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
                <p className="font-medium">Important: Save Your Credentials</p>
                <p className="text-sm mt-1">
                  Lost credentials cannot be recovered for anonymous reports.
                  Make sure to store your report number and password in a secure
                  location.
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
              <Shield className="w-5 h-5 text-accent-fg mr-3" />
              <h3 className="text-lg font-semibold text-ink">
                Your Privacy is Protected
              </h3>
            </div>
            <div className="space-y-3 text-sm text-ink-muted">
              <div className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 skrink-0" />
                <span>End-to-end encryption for all data</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 skrink-0" />
                <span>No personal information collected</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 skrink-0" />
                <span>Secure access with credentials only</span>
              </div>
              <div className="flex items-start">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 skrink-0" />
                <span>GDPR and EU Directive compliant</span>
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
                  Report #{report_number}
                </h1>
                <StatusBadge status={status} />
                <PriorityBadge priority={priority} />
              </div>
              <div className="flex items-center text-sm text-ink-muted">
                <Clock className="w-4 h-4 mr-1.5" />
                Created {formatDate(created_at)} • Last updated{" "}
                {formatDate(updated_at)}
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="medium"
                onClick={() => window.print()}
                startIcon={Printer}
              >
                Print
              </Button>
              <Button
                variant="ghost"
                size="medium"
                onClick={handleReset}
                startIcon={RefreshCw}
              >
                Track Another
              </Button>
            </div>
          </div>
        </div>

        {/* Alert for anonymous tracking */}
        <Alert variant="info" className="mb-6">
          <div className="flex items-start">
            <Info className="w-5 h-5 mr-3 skrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Tracking Anonymously</p>
              <p className="text-sm mt-1">
                You're viewing this report in read-only mode. To send messages
                and receive notifications,{" "}
                <Link
                  to="/register"
                  className="underline font-medium hover:text-primary-800"
                >
                  create a free account
                </Link>
                .
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
                    Submitted Form Data
                  </h3>
                  <div className="bg-subtle rounded-lg p-4 min-w-0 overflow-hidden space-y-3">
                    {Object.entries(form_data).map(([key, value]) => (
                      <div key={key} className="min-w-0 overflow-hidden">
                        <span className="block text-xs font-medium text-ink-subtle uppercase mb-1">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="block text-ink wrap-break-word whitespace-pre-wrap">
                          {value === null || value === undefined
                            ? "N/A"
                            : isCurrencyAnswer(value)
                              ? formatCurrencyAnswer(value)
                              : Array.isArray(value)
                                ? value.join(", ")
                                : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tags.length > 0 && (
                <div className="mb-5 pb-5 border-b border-line-subtle">
                  <div className="flex items-center mb-2">
                    <FileText className="w-4 h-4 text-ink-subtle mr-2" />
                    <span className="text-sm font-medium text-ink-muted">
                      Categories
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
                <Activity className="w-5 h-5 text-accent-fg mr-3" />
                <h3 className="text-lg font-semibold text-ink">
                  Activity Timeline
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
                  full_name: "Anonymous Reporter",
                  role: "reporter",
                }}
                onSendMessage={handleSendMessage}
                isReporter={true}
                readOnly={true}
              />

              <div className="mt-5 bg-info-soft border border-info-line rounded-lg p-4">
                <div className="flex items-start">
                  <Bell className="w-5 h-5 text-info-fg mr-3 skrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-ink mb-1">
                      Enable Two-Way Communication
                    </h4>
                    <p className="text-sm text-ink-muted mb-3">
                      Create an account to send secure messages to investigators
                      and receive instant notifications.
                    </p>
                    <Link to="/register">
                      <Button variant="secondary" size="small">
                        Create Free Account
                        <ArrowRight className="ml-2 w-4 h-4" />
                      </Button>
                    </Link>
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
                Report Information
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-medium text-ink-subtle uppercase tracking-wide mb-1">
                    Status
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div>
                  <div className="text-xs font-medium text-ink-subtle uppercase tracking-wide mb-1">
                    Priority
                  </div>
                  <PriorityBadge priority={priority} />
                </div>
                <div className="pt-4 border-t border-line-subtle">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Report ID</span>
                      <span className="font-mono text-ink break-all">{id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Created</span>
                      <span className="font-medium text-ink">
                        {formatDate(created_at)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-muted">Last Updated</span>
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
                Actions
              </h3>
              <div className="space-y-3">
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4 mr-3" />
                  Print Report Details
                </Button>
                <Link to="/submit-anonymous" className="block">
                  <Button variant="ghost" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-3" />
                    Submit Another Report
                  </Button>
                </Link>
                <Link to="/help" className="block">
                  <Button variant="ghost" className="w-full justify-start">
                    <Info className="w-4 h-4 mr-3" />
                    Get Help
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Upgrade Card */}
            <Card className="bg-accent-soft border-line-accent">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-white rounded-full mb-3 shadow-sm">
                  <Settings className="w-6 h-6 text-accent-fg" />
                </div>
                <h3 className="font-semibold text-ink mb-2">
                  Unlock Full Features
                </h3>
                <p className="text-sm text-ink-muted mb-4">
                  Get advanced tracking, messaging, and notifications with a
                  free account.
                </p>
                <Link to="/register">
                  <Button
                    variant="secondary"
                    size="small"
                    className="w-full mb-2"
                  >
                    Create Account
                  </Button>
                </Link>
                <Link
                  to="/login"
                  className="text-xs text-accent-fg hover:opacity-80 font-medium"
                >
                  Already have an account? Sign in
                </Link>
              </div>
            </Card>

            {/* Security Notice */}
            <Card className="border-success-line bg-success-soft">
              <div className="flex items-start">
                <Shield className="w-5 h-5 text-success-fg mr-3 skrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-ink mb-1">
                    Secure & Private
                  </h4>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    This report is encrypted and only accessible with your
                    unique credentials. Never share your report number or
                    password.
                  </p>
                  <Link
                    to="/security"
                    className="text-xs text-success-fg hover:opacity-80 font-medium mt-2 inline-flex items-center"
                  >
                    Learn about our security
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Link>
                </div>
              </div>
            </Card>

            {/* Evidence & Files Card */}
            {report.attachments && report.attachments.length > 0 && (
              <Card>
                <div className="flex items-center mb-4">
                  <FileText className="w-5 h-5 text-accent-fg mr-3" />
                  <h3 className="text-lg font-semibold text-ink">
                    Evidence &amp; Files
                  </h3>
                </div>
                <ul className="divide-y divide-line-subtle">
                  {report.attachments.map((file, idx) => (
                    <li
                      key={idx}
                      className="py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="p-2 bg-subtle rounded">
                          <FileText className="h-4 w-4 text-ink-subtle" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-ink-muted truncate max-w-35">
                            {file.filename || "Unnamed file"}
                          </span>
                          <span className="text-xs text-ink-subtle">
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
                        title="Download / View"
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
                  Need Assistance?
                </h4>
                <p className="text-xs text-ink-muted mb-3">
                  Our support team is here to help
                </p>
                <a href={`mailto:${SUPPORT_EMAIL}`}>
                  <Button variant="secondary" size="small" className="w-full">
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
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
            {usesAccount ? "Track a Report" : "Anonymous Report Tracking"}
          </h1>
          <p className="text-ink-muted max-w-2xl mx-auto">
            {usesAccount
              ? "Open a report filed under your account with its report number."
              : "Track your report securely using the credentials provided when you submitted. No login or personal information required."}
          </p>
        </div>

        {!showDetails ? renderTrackingForm() : renderReportDetails()}
      </div>
    </div>
  );
};

export default TrackReport;
