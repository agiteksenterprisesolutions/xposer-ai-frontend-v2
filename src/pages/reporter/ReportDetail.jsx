// src/pages/reporter/ReportDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MessageSquare,
  FileText,
  Shield,
  Download,
  AlertCircle,
  CheckCircle,
  Lock,
  Send,
  Loader,
  Pencil,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useReports } from "../../hooks/useReports";
import { reportsAPI, messagesAPI } from "../../api";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { StatusBadge, PriorityBadge } from "../../components/ui/Badge";
import Skeleton from "../../components/ui/Skeleton";
import Alert from "../../components/ui/Alert";
import { Textarea } from "../../components/ui/Input";
import { formatDateTime, formatRelativeTime, formatFileSize } from "../../utils/formatters";
import useSEO from '../../hooks/useSEO';
import { isDraftReport, getReportDescription, getReportTitle } from '../../utils/reports';
import VoiceAnswers from '../../components/reports/VoiceAnswers';
import { toast } from "react-toastify";
import { formatAnswer, orderedAnswers } from '../../utils/reportAnswers';
import { useReportForm } from '../../hooks/useReportForm';
import { useTranslation } from 'react-i18next';

/** The report page while it loads: the same header, cards and sidebar. */
const ReportDetailSkeleton = ({ backLabel, steps }) => {
  const { t } = useTranslation('reporter');
  return (
  <div className="max-w-5xl mx-auto space-y-6 overflow-hidden" aria-busy="true">
    <div>
      <span className="inline-flex items-center text-sm text-ink-muted mb-4">
        <ArrowLeft className="w-4 h-4 me-1" />
        {backLabel}
      </span>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton.Text size="2xl" className="w-52" />
            <Skeleton className="h-7 w-20 rounded" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton.Text className="w-52" />
            <Skeleton.Text className="w-56" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton.Badge className="w-16" />
          <Skeleton.Badge className="w-14" />
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <div className="flex flex-col md:flex-row justify-between">
            {steps.map((step) => (
              <div key={step.key} className="flex md:flex-col items-center gap-4 md:gap-2 p-2 md:p-0">
                <Skeleton.Circle size="h-8 w-8" />
                <span className="text-sm font-medium text-ink-muted">{step.label}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title={t('detail.reportDetails')}>
          <div>
            <Skeleton.Text className="mb-2 w-44" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </Card>
        <Card>
          <Card.Header className="flex items-center justify-between border-b border-line-subtle">
            <Card.Title className="flex items-center">
              <MessageSquare className="h-5 w-5 me-2 text-accent-fg" />
              {t('detail.communication')}
            </Card.Title>
          </Card.Header>
          <Card.Content className="pt-6">
            <Skeleton.Text className="mx-auto w-64" />
            <div className="mt-8 pt-6 border-t border-line-subtle">
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </Card.Content>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="bg-accent-soft border-line-accent">
          <div className="flex items-start">
            <Shield className="w-5 h-5 text-accent-fg me-2 mt-0.5" />
            <div>
              <h4 className="font-medium text-accent-fg">{t('detail.secureChannelTitle')}</h4>
              <p className="text-sm text-accent-fg mt-1">
                {t('detail.secureChannelBody')}
              </p>
            </div>
          </div>
        </Card>
        <Card title={t('detail.timeline')}>
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton.Circle size="mt-2 h-2 w-2" />
                <div>
                  <Skeleton.Text className="w-32" />
                  <Skeleton.Text size="xs" className="w-36" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </div>
  );
};

const ReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { fetchReport } = useReports();
  const { t } = useTranslation('reporter');

  const [report, setReport] = useState(null);
  // The form this report was filed against, for its answers' labels and order.
  const reportForm = useReportForm(report);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState(null);

  useSEO({
    enabled: !loading && !!report,
    title: report
      ? [t('seo.reportTitle', { number: report.report_number }), getReportTitle(report)].filter(Boolean).join(' — ')
      : '',
    noIndex: true,
  });

  // Fetch report details
  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      try {
        const data = await fetchReport(id);
        setReport(data);
        if (data?.report_number) {
          setMessagesLoading(true);
          try {
            const messageData = await messagesAPI.getReportMessages(
              data.report_number,
              false,
            );
            setMessages(messageData);
          } catch (err) {
            console.error("Failed to load messages:", err);
          } finally {
            setMessagesLoading(false);
          }
        }
      } catch (err) {
        setError(t('detail.loadFailed'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadReport();
    }
  }, [id, fetchReport]);

  const resolveMessageTimestamp = (msg) => {
    const raw =
      msg?.timestamp ??
      msg?.created_at ??
      msg?.createdAt ??
      msg?.updated_at ??
      msg?.updatedAt;
    if (!raw) return null;

    if (typeof raw === "number") {
      return new Date(raw < 1e12 ? raw * 1000 : raw);
    }

    if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
      const asNumber = Number(raw);
      return new Date(raw.trim().length === 10 ? asNumber * 1000 : asNumber);
    }

    return new Date(raw);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (!report?.report_number) return;

    try {
      setSendingMessage(true);
      const payload = {
        content: newMessage.trim(),
        report_number: report.report_number,
        is_internal: false,
      };
      const created = await messagesAPI.sendMessage(payload);
      setMessages((prev) =>
        [...prev, created].sort(
          (a, b) => (a?.timestamp || 0) - (b?.timestamp || 0),
        ),
      );
      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDownloadAttachment = async (file) => {
    if (!report?.report_number || !file?.key) return;
    setDownloadingKey(file.key);
    try {
      const result = await reportsAPI.getAttachmentDownloadUrl(
        report.report_number,
        file.key,
      );
      if (result?.download_url) {
        window.open(result.download_url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(t('detail.downloadUnavailable'));
      }
    } catch (err) {
      console.error("Failed to download attachment:", err);
      toast.error(t('detail.downloadFailed'));
    } finally {
      setDownloadingKey(null);
    }
  };

  const statusSteps = [
    { key: "pending", label: t('detail.stepSubmitted') },
    { key: "in_progress", label: t('detail.stepInProgress') },
    { key: "resolved", label: t('detail.stepResolved') },
    { key: "closed", label: t('detail.stepClosed') },
  ];

  const getCurrentStep = () => {
    if (!report) return 0;
    const index = statusSteps.findIndex((s) => s.key === report.status);
    return index >= 0 ? index : 0;
  };

  if (loading) {
    return (
      <ReportDetailSkeleton
        backLabel={user?.is_anonymous ? t('detail.backToTracking') : t('detail.backToMyReports')}
        steps={statusSteps}
      />
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <AlertCircle className="w-16 h-16 text-danger-fg mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-ink mb-2">
          {t('detail.errorTitle')}
        </h2>
        <p className="text-ink-muted mb-6">{error || t('detail.notFound')}</p>
        <Button
          onClick={() =>
            navigate(user?.is_anonymous ? `/${user ? user.organization_slug : ''}/track-report` : `/${user ? user.organization_slug : ''}/reporter/reports`)
          }
        >
          {user?.is_anonymous ? t('detail.backToTracking') : t('detail.backToReports')}
        </Button>
      </div>
    );
  }

  const isDraft = isDraftReport(report);
  const reportTitle = getReportTitle(report);
  const reportDescription = getReportDescription(report);

  return (
    <div className="max-w-5xl mx-auto space-y-6 overflow-hidden">
      {/* Header */}
      <div>
        <button
          onClick={() =>
            navigate(user?.is_anonymous ? `/${user ? user.organization_slug : ''}/track-report` : `/${user ? user.organization_slug : ''}/reporter/reports`)
          }
          className="inline-flex items-center text-sm text-ink-muted hover:text-ink mb-4"
        >
          <ArrowLeft className="w-4 h-4 me-1" />
          {user?.is_anonymous ? t('detail.backToTracking') : t('detail.backToMyReports')}
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {/* Not every report has a title; the heading falls back to a
                  neutral one rather than rendering empty. */}
              <h1 className="text-2xl font-bold text-ink wrap-break-word">
                {reportTitle || t('detail.reportDetails')}
              </h1>
              <span className="font-mono text-sm px-2 py-1 bg-active rounded text-ink-muted">
                #{report.report_number}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-ink-muted">
              <span className="flex items-center">
                <Calendar className="w-4 h-4 me-1.5" />
                {t('detail.submittedAt', { date: formatDateTime(report.created_at) })}
              </span>
              <span className="flex items-center">
                <Clock className="w-4 h-4 me-1.5" />
                {t('detail.lastUpdatedAt', { date: formatDateTime(report.updated_at) })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={report.status} />
            <PriorityBadge priority={report.priority} />
            {isDraft && (
              <Button
                size="small"
                variant="primary"
                startIcon={Pencil}
                onClick={() =>
                  navigate(`/${user ? user.organization_slug : ''}/reporter/reports/${report.id}/edit`)
                }
              >
                {t('detail.editDraft')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {isDraft && (
        <Alert variant="warning" title={t('detail.draftTitle')}>
          {t('detail.draftBody')}
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Tracker */}
          <Card>
            <div className="relative">
              <div className="absolute start-0 top-1/2 w-full h-0.5 bg-active -z-10 transform -translate-y-1/2 hidden md:block" />
              <div className="flex flex-col md:flex-row justify-between relative">
                {statusSteps.map((step, index) => {
                  const currentStep = getCurrentStep();
                  const isCompleted = index <= currentStep;
                  const isCurrent = index === currentStep;

                  return (
                    <div
                      key={step.key}
                      className="flex md:flex-col items-center gap-4 md:gap-2 bg-surface md:bg-transparent p-2 md:p-0"
                    >
                      <div
                        className={`
                        w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors
                        ${isCompleted
                            ? "bg-accent border-line-accent text-on-accent"
                            : "bg-surface border-line-strong text-ink-subtle"
                          }
                      `}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium ${isCurrent ? "text-accent-fg" : "text-ink-muted"}`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Report Details */}
          <Card title={t('detail.reportDetails')}>
            <div className="space-y-6">
              {reportDescription && (
                <div>
                  <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-2">
                    {t('detail.description')}
                  </h3>
                  <div className="bg-subtle text-sm py-3 px-3 rounded-lg text-ink-secondary whitespace-pre-wrap wrap-break-word overflow-hidden">
                    {reportDescription}
                  </div>
                </div>
              )}

              <VoiceAnswers report={report} />
              {!report.form_data || Object.keys(report.form_data).length === 0 ? (
                <div>
                  <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-2">
                    {t('detail.additionalInfo')}
                  </h3>
                  <div className="bg-subtle text-sm py-3 px-3 rounded-lg text-ink-secondary whitespace-pre-wrap wrap-break-word overflow-hidden">
                    {t('detail.noAdditionalInfo')}
                  </div>
                </div>
              ) : (
                <>
                  {report.form_data && (
                    <div>
                      <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-2">
                        {t('detail.additionalInfo')}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {orderedAnswers(report.form_data, reportForm).map(({ key, value, label, question }) => (
                          <div
                            key={key}
                            className="bg-surface border border-line p-3 rounded-lg overflow-hidden"
                          >
                            <span className="block text-xs font-medium text-ink-muted uppercase mb-1">
                              {label}
                            </span>
                            <span className="text-ink wrap-break-word">{formatAnswer(value, question)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          {/* Communication Timeline */}
          <Card>
            <Card.Header className="flex items-center justify-between border-b border-line-subtle">
              <Card.Title className="flex items-center">
                <MessageSquare className="h-5 w-5 me-2 text-accent-fg" />
                {t('detail.communication')}
              </Card.Title>
            </Card.Header>
            <Card.Content className="pt-6">
              <div className="flow-root">
                <ul className="-mb-8">
                  {messages.length === 0 ? (
                    <li className="text-center py-4 text-ink-muted text-sm italic">
                      {t('detail.noMessages')}
                    </li>
                  ) : (
                    messages.map((msg, idx) => (
                      <li key={msg.id || idx}>
                        <div className="relative pb-8">
                          {idx !== messages.length - 1 && (
                            <span
                              className="absolute top-4 start-4 -ms-px h-full w-0.5 bg-active"
                              aria-hidden="true"
                            />
                          )}
                          <div className="relative flex gap-3">
                            <div>
                              <span
                                className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-surface ${msg.is_internal ? "bg-warning-soft" : "bg-accent-soft"
                                  }`}
                              >
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
                                      {msg?.sender?.role === "reporter"
                                        ? t('detail.you')
                                        : msg?.sender?.name || t('detail.complianceTeam')}
                                    </span>
                                    {msg.is_internal && (
                                      <span className="ms-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-warning-soft text-warning-fg">
                                        {t('detail.internal')}
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
                                  {msg.content || msg.text || t('detail.noContent')}
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

              <div className="mt-8 pt-6 border-t border-line-subtle">
                <form onSubmit={handleSendMessage} className="relative">
                  <Textarea
                    label={t('detail.message')}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows="3"
                  />
                  <button
                    type="submit"
                    onKeyDown={handleSendMessage}
                    disabled={!newMessage.trim() || messagesLoading || sendingMessage}
                    aria-label={t('detail.send')}
                    className="absolute end-3 bottom-3 p-2 bg-accent text-on-accent rounded-full hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Security Status */}
          <Card className="bg-accent-soft border-line-accent">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-accent-fg me-2 mt-0.5" />
              <div>
                <h4 className="font-medium text-accent-fg">{t('detail.secureChannelTitle')}</h4>
                <p className="text-sm text-accent-fg mt-1">
                  {t('detail.secureChannelBody')}
                </p>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          {/* <Card title="Quick Actions" className="text-ink">
            <div className="space-y-3 text-ink">
              <Button
                variant="outline"
                className="w-full justify-start text-ink"
              >
                <Download className="w-4 h-4 me-2 text-ink" />
                <p className="text-ink">Download Report</p>
              </Button>
            </div>
          </Card> */}

          {/* Timeline - Simplified */}
          <Card title={t('detail.timeline')}>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-accent shrink-0" />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {t('detail.reportSubmitted')}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDateTime(report.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-active shrink-0" />
                <div>
                  <p className="text-sm font-medium text-ink">
                    {t('detail.currentStatus', { status: t(`common:reportStatus.${report.status}`, { defaultValue: report.status.replace(/_/g, " ") }) })}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDateTime(report.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Evidence & Files */}
          {report.attachments && report.attachments.length > 0 && (
            <Card>
              <div className="flex items-center mb-4">
                <FileText className="w-5 h-5 text-accent-fg me-2" />
                <h3 className="text-base font-semibold text-ink">
                  {t('detail.evidence')}
                </h3>
              </div>
              <ul className="divide-y divide-line-subtle">
                {report.attachments.map((file, idx) => (
                  <li
                    key={idx}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-active rounded shrink-0">
                        <FileText className="h-4 w-4 text-ink-muted" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-ink-secondary truncate max-w-35">
                          {file.filename || t('detail.unnamedFile')}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {formatFileSize(file.size || 0)}
                        </span>
                        {file.uploaded_at && (
                          <span className="text-xs text-ink-subtle">
                            {t('detail.uploaded', { time: formatRelativeTime(file.uploaded_at) })}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="small"
                      onClick={() => handleDownloadAttachment(file)}
                      disabled={downloadingKey === file.key}
                      title={t('detail.download', { name: file.filename || t('detail.unnamedFile') })}
                      aria-label={t('detail.download', { name: file.filename || t('detail.unnamedFile') })}
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
        </div>
      </div>
    </div>
  );
};

export default ReportDetail;
