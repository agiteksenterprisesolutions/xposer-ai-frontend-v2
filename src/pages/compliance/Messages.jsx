import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    MessageSquare,
    Search,
    Filter,
    ArrowRight,
    Clock,
    User,
    Layers,
    AlertCircle
} from 'lucide-react';
import { reportsAPI, messagesAPI } from '../../api';
import { useReportTypeNames } from '../../hooks/useReportTypeNames';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { formatRelativeTime, parseServerDate } from '../../utils/formatters';
import useSEO from '../../hooks/useSEO';
import { normalizeReportsResponse } from '../../utils/reports';
import { casePath } from '../../utils/navigation';

const ComplianceMessages = () => {
  const { t } = useTranslation('cases');
  useSEO({
    title: t('inbox.seoTitle'),
    description: t('inbox.seoDescription'),
    noIndex: true,
  });
  const { orgSlug } = useParams();
    const [reports, setReports] = useState([]);
    // Type names from the shared cached list; never holds up the inbox.
    const { typeName } = useReportTypeNames();
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'assigned'

    const fetchThreads = useCallback(async () => {
        setLoading(true);
        try {
            const reportsData = await reportsAPI.getAllReports();

            const reportsList = normalizeReportsResponse(reportsData).items;
            // In a more complex backend, we'd have a specific "message-threads" endpoint.
            // Here we show reports that have activity.
            setReports(reportsList);
        } catch (error) {
            console.error('Error fetching message threads:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchThreads();
    }, [fetchThreads]);

    const filteredThreads = useMemo(() => {
        let result = reports.filter(r => r.status !== 'closed' || r.messages_count > 0);

        if (searchTerm) {
            const query = searchTerm.toLowerCase();
            result = result.filter(r =>
                r.report_number.toLowerCase().includes(query) ||
                (r.title && r.title.toLowerCase().includes(query)) ||
                (r.description && r.description.toLowerCase().includes(query))
            );
        }

        if (activeTab === 'assigned') {
            // This would normally filter by current user ID from auth store
            // result = result.filter(r => r.assigned_to === currentUser.id);
        }

        return result.sort((a, b) => parseServerDate(b.updated_at) - parseServerDate(a.updated_at));
    }, [reports, searchTerm, activeTab]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-ink">{t('inbox.title')}</h1>
                <p className="text-ink-muted mt-1">{t('inbox.subtitle')}</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <Card padding="none">
                        <div className="p-4 border-b border-line-subtle bg-subtle">
                            <div className="relative">
                                <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-ink-subtle h-4 w-4" aria-hidden="true" />
                                <Input
                                    placeholder={t('inbox.searchPlaceholder')}
                                    aria-label={t('inbox.search')}
                                    className="ps-10 h-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="divide-y divide-line-subtle max-h-[calc(100vh-20rem)] overflow-y-auto">
                            {loading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="p-4" aria-hidden="true">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <Skeleton.Text size="xs" className="w-16" />
                                                <Skeleton.Badge className="w-18" />
                                            </div>
                                            <Skeleton.Text size="xs" className="w-16" />
                                        </div>
                                        <Skeleton.Text className="mb-1 w-2/3" />
                                        <div className="flex items-center justify-between mt-2">
                                            <Skeleton.Text size="xs" className="w-40" />
                                            <Skeleton className="h-4 w-4 rounded" />
                                        </div>
                                    </div>
                                ))
                            ) : filteredThreads.length === 0 ? (
                                <div className="p-12 text-center">
                                    <MessageSquare className="h-12 w-12 text-ink-subtle mx-auto mb-4" aria-hidden="true" />
                                    <h3 className="text-lg font-medium text-ink">{t('inbox.emptyTitle')}</h3>
                                    <p className="text-ink-muted">{t('inbox.emptyBody')}</p>
                                </div>
                            ) : (
                                filteredThreads.map((thread) => (
                                    <Link
                                        key={thread.id}
                                        to={casePath(orgSlug, thread.id)}
                                        className="block hover:bg-subtle transition-colors"
                                    >
                                        <div className="p-4">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-accent-fg" dir="ltr">#{thread.report_number}</span>
                                                    <StatusBadge status={thread.status} size="small" />
                                                </div>
                                                <span className="text-xs text-ink-subtle flex items-center">
                                                    <Clock className="h-3 w-3 me-1" aria-hidden="true" />
                                                    {formatRelativeTime(thread.updated_at)}
                                                </span>
                                            </div>

                                            <h4 className="text-sm font-semibold text-ink truncate mb-1" dir="auto">
                                                {thread.title ||
                                                    (thread.report_type_id
                                                        ? typeName(thread) ?? <Skeleton.Text className="inline-flex w-28 align-middle" />
                                                        : t('inbox.generalReport'))}
                                            </h4>

                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex items-center gap-4 text-xs text-ink-muted">
                                                    <span className="flex items-center" dir="auto">
                                                        <User className="h-3 w-3 me-1" aria-hidden="true" />
                                                        {thread.assignee_name || t('owner.unassigned')}
                                                    </span>
                                                    <span className="flex items-center text-accent-fg font-medium">
                                                        <MessageSquare className="h-3 w-3 me-1" aria-hidden="true" />
                                                        {t('inbox.messages', { count: thread.messages_count || 0 })}
                                                    </span>
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </Card>
                </div>

                <div className="w-full md:w-80 space-y-6">
                    <Card>
                        <Card.Header>
                            <Card.Title className="text-sm">{t('inbox.teamActivity')}</Card.Title>
                        </Card.Header>
                        <Card.Content className="space-y-4">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-ink-muted">{t('inbox.unread')}</span>
                                <span className="px-2 py-0.5 bg-danger-soft text-danger-fg rounded-full font-bold">3</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-ink-muted">{t('inbox.pendingReplies')}</span>
                                <span className="px-2 py-0.5 bg-warning-soft text-warning-fg rounded-full font-bold">12</span>
                            </div>
                        </Card.Content>
                    </Card>

                    <Card className="bg-accent-soft border-line-accent">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-accent-fg mt-0.5" aria-hidden="true" />
                            <div>
                                <h5 className="text-xs font-bold text-accent-fg">{t('inbox.guidelinesTitle')}</h5>
                                <p className="text-[10px] text-accent-fg mt-1">{t('inbox.guidelinesBody')}</p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ComplianceMessages;
