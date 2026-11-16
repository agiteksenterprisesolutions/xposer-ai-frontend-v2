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
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Badge, { StatusBadge, PriorityBadge } from '../../components/ui/Badge';
import { toReporterView, reportsAPI } from '../../api/reports';
import { messagesAPI } from '../../api/messages';
import ChatInterface from '../../components/reports/ChatInterface';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'react-toastify';
import { formatFileSize, formatRelativeTime, parseServerDate } from '../../utils/formatters';
import DashboardTour from '../../components/tour/DashboardTour';
import useSEO from '../../hooks/useSEO';
import { isDraftReport, getReportDescription, getReportTitle } from '../../utils/reports';
import { copyToClipboard } from '../../utils/clipboard';
import VoiceAnswers from '../../components/reports/VoiceAnswers';
import { formatAnswer, orderedAnswers } from '../../utils/reportAnswers';
import { useReportForm } from '../../hooks/useReportForm';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '../../utils/locale';

const REPORT_DETAILS_TOUR_KEY = 'xposer_report_details_tour_seen';

const ReportDetails = () => {
  const { id, orgSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuthStore();
  const { t, i18n } = useTranslation('track');
  const [report, setReport] = useState(null);
  // The form this report was filed against, for its answers' labels and order.
  const reportForm = useReportForm(report);
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
      ? [t('seo.reportTitle', { number: report.report_number }), getReportTitle(report)].filter(Boolean).join(' — ')
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
          // Reporter-facing: never show staff fields, whatever the response holds.
          reportData = toReporterView(await reportsAPI.getReport(id));
        }

        setReport(reportData);
        if (reportData?.report_number) {
          fetchMessages(reportData.report_number);
        }
      } catch (err) {
        console.error('Error fetching report:', err);
        // The server's detail is English-only and technical ("Not authenticated");
        // the reporter gets the translated explanation instead.
        setError(t('reportPage.loadFailed'));
        toast.error(t('reportPage.loadFailedToast'));
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
      toast.success(t('toast.messageSent'));
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error(t('toast.sendFailed'));
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
        toast.error(t('toast.downloadUnavailable'));
      }
    } catch (err) {
      console.error('Failed to download attachment:', err);
      toast.error(t('toast.downloadFailed'));
    } finally {
      setDownloadingKey(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('reportPage.notAvailable');
    const date = parseServerDate(dateString);
    if (!date) return t('reportPage.notAvailable');
    return date.toLocaleDateString(intlLocale(), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCopy = async (text) => {
    if (await copyToClipboard(text)) {
      toast.success(t('toast.copiedText'));
    } else {
      toast.error(t('toast.copyTextFailed'));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const tourSteps = useMemo(() => {
    if (!report) return [];
    // Tooltips sit beside the sidebar, which is on the other side in Arabic.
    const side = i18n.dir() === 'rtl' ? 'right' : 'left';
    const steps = [
      {
        target: '[data-tour="details-info"]',
        title: t('tour.infoTitle'),
        content: t('tour.infoText'),
        placement: 'bottom',
        skipBeacon: true,
      },
      {
        target: '[data-tour="details-status"]',
        title: t('tour.statusTitle'),
        content: t('tour.statusText'),
        placement: side,
      },
      {
        target: '[data-tour="details-timeline"]',
        title: t('tour.timelineTitle'),
        content: t('tour.timelineText'),
        placement: side,
      },
    ];

    if (report.attachments && report.attachments.length > 0) {
      steps.push({
        target: '[data-tour="details-files"]',
        title: t('tour.filesTitle'),
        content: t('tour.filesText'),
        placement: side,
      });
    }

    steps.push(
      {
        target: '[data-tour="details-chat"]',
        title: t('tour.messagesTitle'),
        content: t('tour.messagesText'),
        placement: 'top',
      },
      {
        target: '[data-tour="details-security"]',
        title: t('tour.privacyTitle'),
        content: t('tour.privacyText'),
        placement: side,
      },
      {
        target: '[data-tour="details-actions"]',
        title: t('tour.nextTitle'),
        content: t('tour.nextText'),
        placement: 'top',
      }
    );

    return steps;
  }, [report, t, i18n]);

  if (isLoading) {
    // The page's own header and cards, with the report's details stubbed.
    return (
      <div className="min-h-screen bg-canvas py-8 px-4 sm:px-6 lg:px-8" aria-busy="true">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <Link
              to={`/${orgSlug ? orgSlug : ''}/track-report`}
              className="inline-flex items-center text-sm text-accent-fg hover:opacity-80 mb-4"
            >
              <ChevronLeft className="w-4 h-4 me-1" />
              {t('reportPage.back')}
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center mb-2">
                  <Shield className="h-6 w-6 text-accent-fg me-2" />
                  <h1 className="text-2xl font-bold text-ink">{t('reportPage.title')}</h1>
                </div>
                <p className="text-ink-muted">{t('reportPage.subtitle')}</p>
              </div>
              <Skeleton.Button small className="mt-4 sm:mt-0 w-44" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
            <div className="lg:col-span-2 space-y-6 min-w-0">
              <Card>
                <h2 className="text-lg font-semibold text-ink mb-4 flex items-center">
                  <FileText className="w-5 h-5 me-2 text-accent-fg" />
                  {t('reportPage.info')}
                </h2>
                <div className="space-y-4">
                  <div>
                    <Skeleton.Text className="w-12" />
                    <Skeleton.Text size="base" className="mt-1 w-2/3" />
                  </div>
                  <div>
                    <Skeleton.Text className="w-24" />
                    <Skeleton.Lines size="base" lines={3} className="mt-1" />
                  </div>
                </div>
              </Card>
            </div>
            <div className="space-y-6">
              <Card>
                <h2 className="text-lg font-semibold text-ink mb-4">{t('reportPage.statusCard')}</h2>
                <div className="space-y-4">
                  {['w-16', 'w-14', 'w-20'].map((w) => (
                    <div key={w} className="flex items-center justify-between">
                      <Skeleton.Text className="w-16" />
                      <Skeleton.Badge className={w} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <h2 className="text-lg font-semibold text-ink mb-4">{t('reportPage.timeline')}</h2>
                <div className="flex items-start gap-3">
                  <Skeleton.Circle size="h-8 w-8" />
                  <div>
                    <Skeleton.Text className="w-32" />
                    <Skeleton.Text size="xs" className="w-28" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
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
            <h2 className="text-xl font-semibold text-ink mb-2">{t('reportPage.notFound')}</h2>
            <p className="text-ink-muted mb-6">
              {error || t('reportPage.notFoundText')}
            </p>
            <Button onClick={() => navigate(`/${orgSlug}/track-report`)}>
              <ChevronLeft className="w-4 h-4 me-2" />
              {t('reportPage.back')}
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
            <ChevronLeft className="w-4 h-4 me-1" />
            {t('reportPage.back')}
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center mb-2">
                <Shield className="h-6 w-6 text-accent-fg me-2" />
                <h1 className="text-2xl font-bold text-ink">{t('reportPage.title')}</h1>
              </div>
              <p className="text-ink-muted">
                {t('reportPage.subtitle')}
              </p>
            </div>

            <div className="mt-4 sm:mt-0 flex items-center gap-3">
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
                  <Pencil className="w-4 h-4 me-2" />
                  {t('reportPage.continueEditing')}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => handleCopy(report.report_number)}
                size="sm"
              >
                <Copy className="w-4 h-4 me-2" />
                {t('reportPage.copyNumber')}
              </Button>
              {/* <Button
                variant="ghost"
                onClick={handlePrint}
                size="sm"
              >
                <Printer className="w-4 h-4 me-2" />
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
                <FileText className="w-5 h-5 me-2 text-accent-fg" />
                {t('reportPage.info')}
              </h2>

              <div className="space-y-4 min-w-0">
                {/* Both are optional: a report filed through the form may
                    carry neither, and an empty "N/A" row is noise. */}
                {reportTitle && (
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink-subtle">{t('reportPage.fieldTitle')}</h3>
                    <p className="mt-1 text-ink wrap-break-word">{reportTitle}</p>
                  </div>
                )}

                {reportDescription && (
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink-subtle">{t('reportPage.description')}</h3>
                    <p className="mt-1 text-ink whitespace-pre-wrap wrap-break-word">
                      {reportDescription}
                    </p>
                  </div>
                )}

                <VoiceAnswers report={report} />

                {/* Form Data Section */}
                {report.form_data && Object.keys(report.form_data).length > 0 && (
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-ink-subtle mb-2">{t('details.formData')}</h3>
                    <div className="bg-subtle rounded-lg p-4 min-w-0 overflow-hidden space-y-3">
                      {orderedAnswers(report.form_data, reportForm).map(({ key, value, label, question }) => (
                        <div key={key} className="min-w-0 overflow-hidden">
                          <span className="block font-medium text-ink-muted capitalize mb-0.5">
                            {t('reportPage.answerLabel', { label })}
                          </span>
                          <span className="text-ink wrap-break-word">{formatAnswer(value, question)}</span>
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
                  <Tag className="w-5 h-5 me-2 text-accent-fg" />
                  {t('reportPage.typeDetails')}
                </h2>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-ink-subtle">{t('reportPage.reportType')}</h3>
                    <p className="mt-1 text-ink">{report.report_type.name}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-ink-subtle">{t('reportPage.description')}</h3>
                    <p className="mt-1 text-ink">{report.report_type.description}</p>
                  </div>

                  {report.report_type.questions && report.report_type.questions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-ink-subtle mb-2">{t('reportPage.formQuestions')}</h3>
                      <div className="space-y-2">
                        {report.report_type.questions.map((question, index) => (
                          <div key={question.id} className="bg-subtle rounded p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-medium text-ink-muted">
                                  {index + 1}. {question.label}
                                </span>
                                {question.required && (
                                  <span className="ms-2 text-xs text-danger-fg">{t('reportPage.required')}</span>
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
                currentUser={authUser || { id: 'anonymous', full_name: t('details.anonymousReporter'), role: 'reporter' }}
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
              <h2 className="text-lg font-semibold text-ink mb-4">{t('reportPage.statusCard')}</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-subtle">{t('details.status')}</span>
                  {report.status ? (
                    <StatusBadge status={report.status} />
                  ) : (
                    <Badge size="small">{t('reportPage.unknown')}</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-subtle">{t('details.priority')}</span>
                  {report.priority ? (
                    <PriorityBadge priority={report.priority} />
                  ) : (
                    <Badge size="small">{t('reportPage.notAvailable')}</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-subtle">{t('form.reportNumber')}</span>
                  <div className="flex items-center">
                    <span className="font-mono text-sm font-semibold text-ink">
                      {report.report_number}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(report.report_number)}
                      className="ms-1 inline-flex h-7 w-7 items-center justify-center rounded text-ink-subtle hover:text-ink"
                      aria-label={t('reportPage.copyNumber')}
                      title={t('reportPage.copyNumber')}
                    >
                      <Copy className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-muted">Messages</span>
                  <Badge>{report.message_count || 0} messages</Badge>
                </div> */}
              </div>
            </Card>

            {/* Timeline Card */}
            <Card data-tour="details-timeline">
              <h2 className="text-lg font-semibold text-ink mb-4">{t('reportPage.timeline')}</h2>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="shrink-0">
                    <div className="w-8 h-8 rounded-full bg-success-soft flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-success-fg" />
                    </div>
                  </div>
                  <div className="ms-3">
                    <p className="text-sm font-medium text-ink">{t('reportPage.submitted')}</p>
                    <p className="text-sm text-ink-subtle">{formatDate(report.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="shrink-0">
                    <div className="w-8 h-8 rounded-full bg-info-soft flex items-center justify-center">
                      <Clock className="w-4 h-4 text-info-fg" />
                    </div>
                  </div>
                  <div className="ms-3">
                    <p className="text-sm font-medium text-ink">{t('details.lastUpdated')}</p>
                    <p className="text-sm text-ink-subtle">{formatDate(report.updated_at)}</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Evidence & Files Card */}
            {report.attachments && report.attachments.length > 0 && (
              <Card data-tour="details-files">
                <h2 className="text-lg font-semibold text-ink mb-4 flex items-center">
                  <FileText className="w-5 h-5 me-2 text-accent-fg" />
                  {t('details.evidence')}
                </h2>
                <ul className="divide-y divide-line-subtle">
                  {report.attachments.map((file, idx) => (
                    <li
                      key={idx}
                      className="py-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-2 bg-subtle rounded shrink-0">
                          <FileText className="h-4 w-4 text-ink-subtle" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-ink-muted truncate max-w-35">
                            {file.filename || t('details.unnamedFile')}
                          </span>
                          <span className="text-xs text-ink-subtle">
                            {formatFileSize(file.size || 0)}
                          </span>
                          {file.uploaded_at && (
                            <span className="text-xs text-ink-subtle">
                              {t('details.uploaded', { when: formatRelativeTime(file.uploaded_at) })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => handleDownloadAttachment(file)}
                        disabled={downloadingKey === file.key}
                        title={t('details.download')}
                        aria-label={t('details.downloadFile', { name: file.filename || t('details.unnamedFile') })}
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
                <Lock className="w-5 h-5 me-2 text-accent-fg" />
                {t('reportPage.security')}
              </h2>

              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Eye className="w-4 h-4 text-green-500 me-2" />
                  <span className="text-ink-muted">{t('reportPage.identityProtected')}</span>
                </div>

                <div className="flex items-center text-sm">
                  <Shield className="w-4 h-4 text-green-500 me-2" />
                  <span className="text-ink-muted">{t('reportPage.encrypted')}</span>
                </div>

                <div className="flex items-center text-sm">
                  <AlertCircle className="w-4 h-4 text-yellow-500 me-2" />
                  <span className="text-ink-muted">
                    {report.email ? t('reportPage.emailOn') : t('reportPage.emailOff')}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-line-subtle">
                <p className="text-xs text-ink-subtle">
                  {t('reportPage.keepSecure')}
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 print:hidden"
          data-tour="details-actions"
        >
          <Button
            variant="secondary"
            onClick={() => navigate(`/${orgSlug}/track-report`)}
            className="sm:w-auto"
          >
            {t('reportPage.trackAnother')}
          </Button>

          <Button
            variant="secondary"
            onClick={() => navigate(`/${orgSlug}/submit-anonymous`)}
            className="sm:w-auto"
          >
            {t('reportPage.submitNew')}
          </Button>

          {/* <Button
            onClick={() => window.print()}
            variant="outline"
            className="sm:w-auto"
          >
            <Printer className="w-4 h-4 me-2" />
            Print This Page
          </Button> */}
        </div>

      </div>
    </div>
  );
};

export default ReportDetails;