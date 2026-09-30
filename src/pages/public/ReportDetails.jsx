import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  Calendar,
  Tag,
  AlertCircle,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  ChevronLeft,
  Eye,
  Lock,
  Copy,
  Printer,
  Download,
  Loader,
  Pencil,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import { reportsAPI } from '../../api/reports';
import { messagesAPI } from '../../api/messages';
import ChatInterface from '../../components/reports/ChatInterface';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'react-toastify';
import { formatDateTime, formatFileSize, formatRelativeTime, parseServerDate } from '../../utils/formatters';
import DashboardTour from '../../components/tour/DashboardTour';
import useSEO from '../../hooks/useSEO';
import { isDraftReport, getReportDescription, getReportTitle } from '../../utils/reports';
import { copyToClipboard } from '../../utils/clipboard';
import VoiceAnswers from '../../components/reports/VoiceAnswers';

const REPORT_DETAILS_TOUR_KEY = 'xposer_report_details_tour_seen';

const ReportDetails = () => {
  const { id, orgSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();
  const [report, setReport] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [downloadingKey, setDownloadingKey] = useState(null);
  const tourRef = useRef(null);

  const [reportPassword, setReportPassword] = useState(location.state?.password || '');

  useSEO({
    enabled: !isLoading && !!report,
    title: report
      ? [`Report #${report.report_number}`, getReportTitle(report)].filter(Boolean).join(' — ')
      : '',
    noIndex: true,
  });

  const fetchMessages = async (reportId) => {
    try {
      const messagesData = await messagesAPI.getReporterMessages(reportId, reportPassword);
      setMessages(messagesData || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      try {
        let reportData;

        // Check if report was passed from location state
        if (location.state?.report) {
          reportData = location.state.report;
        } else {
          // Fetch report by ID
          reportData = await reportsAPI.getReport(id);
        }

        setReport(reportData);
        if (reportData?.report_number) {
          fetchMessages(reportData.report_number);
        }
      } catch (err) {
        console.error('Error fetching report:', err);
        setError(err.response?.data?.detail || 'Failed to load report details.');
        toast.error('Could not load report details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, [id, location.state, reportPassword]);

  const handleSendMessage = async (messageData) => {
    if (!report?.report_number) return;

    setIsSending(true);
    try {
      const response = await messagesAPI.sendReporterMessage({
        report_number: report.report_number,
        content: messageData.content,
        password: reportPassword,
      });

      // Update local messages
      setMessages([...messages, response]);
      toast.success('Message sent');
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadAttachment = async (file) => {
    if (!report?.report_number || !file?.key) return;
    setDownloadingKey(file.key);
    try {
      const result = await reportsAPI.getAttachmentDownloadUrl(
        report.report_number,
        file.key,
        reportPassword || null,
      );
      if (result?.download_url) {
        window.open(result.download_url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Download URL not available');
      }
    } catch (err) {
      console.error('Failed to download attachment:', err);
      toast.error('Failed to download file');
    } finally {
      setDownloadingKey(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = parseServerDate(dateString);
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFormValue = (value) => {
    if (value == null) return "N/A";

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
  };

  const handleCopy = async (text) => {
    if (await copyToClipboard(text)) {
      toast.success('Copied to clipboard!');
    } else {
      toast.error('Could not copy — please select the text and copy it manually.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const tourSteps = useMemo(() => {
    if (!report) return [];
    const steps = [
      {
        target: '[data-tour="details-info"]',
        title: 'Report information',
        content: 'The title and any form data you submitted with this report.',
        placement: 'bottom',
        skipBeacon: true,
      },
      {
        target: '[data-tour="details-status"]',
        title: 'Status & priority',
        content: 'Track where your report stands and how it has been prioritized.',
        placement: 'left',
      },
      {
        target: '[data-tour="details-timeline"]',
        title: 'Timeline',
        content: 'See when the report was submitted and when it was last updated.',
        placement: 'left',
      },
    ];

    if (report.attachments && report.attachments.length > 0) {
      steps.push({
        target: '[data-tour="details-files"]',
        title: 'Evidence & files',
        content: 'Download any files you attached as evidence.',
        placement: 'left',
      });
    }

    steps.push(
      {
        target: '[data-tour="details-chat"]',
        title: 'Messages',
        content: 'Communicate directly and securely with the compliance team here.',
        placement: 'top',
      },
      {
        target: '[data-tour="details-security"]',
        title: 'Your privacy is protected',
        content: 'Your identity stays protected and all communication is end-to-end encrypted.',
        placement: 'left',
      },
      {
        target: '[data-tour="details-actions"]',
        title: 'What\'s next',
        content: 'Track another report, submit a new one, or print this page for your records.',
        placement: 'top',
      }
    );

    return steps;
  }, [report]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-ink-muted">Loading report details...</p>
        </div>
      </div>
    );
  }

  const reportTitle = getReportTitle(report);
  const reportDescription = getReportDescription(report);

  if (error || !report) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-danger-fg mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-ink mb-2">Report Not Found</h2>
            <p className="text-ink-muted mb-6">
              {error || 'The report you are looking for does not exist or you do not have permission to view it.'}
            </p>
            <Button onClick={() => navigate(`/${orgSlug}/track-report`)}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Report Tracking
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <DashboardTour ref={tourRef} storageKey={REPORT_DETAILS_TOUR_KEY} steps={tourSteps} />

        {/* Header */}
        <div className="mb-8">
          <Link
            to={`/${orgSlug ? orgSlug : ''}/track-report`}
            className="inline-flex items-center text-sm text-accent-fg hover:opacity-80 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Report Tracking
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center mb-2">
                <Shield className="h-6 w-6 text-accent-fg mr-2" />
                <h1 className="text-2xl font-bold text-ink">Report Details</h1>
              </div>
              <p className="text-ink-muted">
                View all details of your submitted report
              </p>
            </div>

            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              {isDraftReport(report) && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    navigate(`/${orgSlug || ''}/edit-draft/${report.report_number}`, {
                      state: { report, password: reportPassword },
                    })
                  }
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Continue Editing
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => handleCopy(report.report_number)}
                size="sm"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Report Number
              </Button>
              {/* <Button
                variant="ghost"
                onClick={handlePrint}
                size="sm"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button> */}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-6 min-w-0">
            {/* Report Information Card */}
            <Card className="min-w-0 overflow-hidden" data-tour="details-info">
              <h2 className="text-lg font-semibold text-ink mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-accent-fg" />
                Report Information
              </h2>

              <div className="space-y-4 min-w-0">
                {/* Both are optional: a report filed through the form may
                    carry neither, and an empty "N/A" row is noise. */}
                {reportTitle && (
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink-subtle">Title</h3>
                    <p className="mt-1 text-ink wrap-break-word">{reportTitle}</p>
                  </div>
                )}

                {reportDescription && (
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink-subtle">Description</h3>
                    <p className="mt-1 text-ink whitespace-pre-wrap wrap-break-word">
                      {reportDescription}
                    </p>
                  </div>
                )}

                <VoiceAnswers report={report} />

                {/* Form Data Section */}
                {report.form_data && Object.keys(report.form_data).length > 0 && (
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink-subtle mb-2">Submitted Form Data</h3>
                    <div className="bg-subtle rounded-lg p-4 min-w-0 overflow-hidden space-y-3">
                      {Object.entries(report.form_data).map(([key, value]) => (
                        <div key={key} className="min-w-0 overflow-hidden">
                          <span className="block font-medium text-ink-muted capitalize mb-0.5">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="text-ink wrap-break-word">{formatFormValue(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Report Type Information */}
            {report.report_type && (
              <Card>
                <h2 className="text-lg font-semibold text-ink mb-4 flex items-center">
                  <Tag className="w-5 h-5 mr-2 text-accent-fg" />
                  Report Type Details
                </h2>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-ink-subtle">Report Type</h3>
                    <p className="mt-1 text-ink">{report.report_type.name}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-ink-subtle">Description</h3>
                    <p className="mt-1 text-ink">{report.report_type.description}</p>
                  </div>

                  {report.report_type.questions && report.report_type.questions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-ink-subtle mb-2">Form Questions</h3>
                      <div className="space-y-2">
                        {report.report_type.questions.map((question, index) => (
                          <div key={question.id} className="bg-subtle rounded p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium text-ink-muted">
                                  {index + 1}. {question.label}
                                </span>
                                {question.required && (
                                  <span className="ml-2 text-xs text-danger-fg">(Required)</span>
                                )}
                              </div>
                              <Badge size="sm">{question.type}</Badge>
                            </div>
                            {question.help_text && (
                              <p className="text-sm text-ink-muted mt-1">{question.help_text}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Communication Section */}
            <div data-tour="details-chat">
              <ChatInterface
                messages={messages}
                currentUser={authUser || { id: 'anonymous', full_name: 'Anonymous Reporter', role: 'reporter' }}
                onSendMessage={handleSendMessage}
                isReporter={true}
                isLoading={isSending}
                showInternalToggle={false}
              />
            </div>
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card data-tour="details-status">
              <h2 className="text-lg font-semibold text-ink mb-4">Report Status</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-subtle">Status</span>
                  {report.status ? (
                    <StatusBadge status={report.status} />
                  ) : (
                    <Badge size="small">Unknown</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-subtle">Priority</span>
                  {report.priority ? (
                    <PriorityBadge priority={report.priority} />
                  ) : (
                    <Badge size="small">N/A</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-subtle">Report Number</span>
                  <div className="flex items-center">
                    <span className="font-mono text-sm font-semibold text-ink">
                      {report.report_number}
                    </span>
                    <button
                      onClick={() => handleCopy(report.report_number)}
                      className="ml-2 text-ink-subtle hover:text-ink"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">Messages</span>
                  <Badge>{report.message_count || 0} messages</Badge>
                </div> */}
              </div>
            </Card>

            {/* Timeline Card */}
            <Card data-tour="details-timeline">
              <h2 className="text-lg font-semibold text-ink mb-4">Timeline</h2>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="shrink-0">
                    <div className="w-8 h-8 rounded-full bg-success-soft flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-success-fg" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-ink">Report Submitted</p>
                    <p className="text-sm text-ink-subtle">{formatDate(report.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="shrink-0">
                    <div className="w-8 h-8 rounded-full bg-info-soft flex items-center justify-center">
                      <Clock className="w-4 h-4 text-info-fg" />
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-ink">Last Updated</p>
                    <p className="text-sm text-ink-subtle">{formatDate(report.updated_at)}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Evidence & Files Card */}
            {report.attachments && report.attachments.length > 0 && (
              <Card data-tour="details-files">
                <h2 className="text-lg font-semibold text-ink mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-accent-fg" />
                  Evidence &amp; Files
                </h2>
                <ul className="divide-y divide-line-subtle">
                  {report.attachments.map((file, idx) => (
                    <li
                      key={idx}
                      className="py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className="p-2 bg-subtle rounded shrink-0">
                          <FileText className="h-4 w-4 text-ink-subtle" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-ink-muted truncate max-w-35">
                            {file.filename || 'Unnamed file'}
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

            {/* Security Info Card */}
            <Card data-tour="details-security">
              <h2 className="text-lg font-semibold text-ink mb-4 flex items-center">
                <Lock className="w-5 h-5 mr-2 text-accent-fg" />
                Security Information
              </h2>

              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Eye className="w-4 h-4 text-green-500 mr-2" />
                  <span className="text-ink-muted">Your identity is protected</span>
                </div>

                <div className="flex items-center text-sm">
                  <Shield className="w-4 h-4 text-green-500 mr-2" />
                  <span className="text-ink-muted">End-to-end encrypted</span>
                </div>

                <div className="flex items-center text-sm">
                  <AlertCircle className="w-4 h-4 text-yellow-500 mr-2" />
                  <span className="text-ink-muted">
                    {report.email ? 'Email notifications enabled' : 'No email contact provided'}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-line-subtle">
                <p className="text-xs text-ink-subtle">
                  Keep your report number and password secure. You'll need them to check updates.
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className="mt-8 flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4 print:hidden"
          data-tour="details-actions"
        >
          <Button
            variant="secondary"
            onClick={() => navigate(`/${orgSlug}/track-report`)}
            className="sm:w-auto"
          >
            Track Another Report
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate(`/${orgSlug}/submit-anonymous`)}
            className="sm:w-auto"
          >
            Submit New Report
          </Button>

          {/* <Button
            onClick={() => window.print()}
            variant="outline"
            className="sm:w-auto"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print This Page
          </Button> */}
        </div>

      </div>
    </div>
  );
};

export default ReportDetails;