// src/pages/reporter/Messages.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    MessageSquare,
    Search,
    Filter,
    ArrowRight,
    Clock,
    CheckCircle,
    AlertCircle
} from 'lucide-react';
import { useReports } from '../../hooks/useReports';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import { StatusBadge } from '../../components/ui/Badge';
import { formatRelativeTime, parseServerDate } from '../../utils/formatters';
import useSEO from '../../hooks/useSEO';

const Messages = () => {
    useSEO({
        title: 'Messages',
        description: 'Secure messages between you and the investigators handling your reports.',
        noIndex: true,
    });
    const { fetchMyReports, reports, isLoading } = useReports();
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all'); // 'all', 'unread' -> unread logic would require deeper API integration

    useEffect(() => {
        fetchMyReports();
    }, [fetchMyReports]);

    // Filter reports to only show those that might have messages (or all, effectively acting as an inbox entry point)
    // Since we don't have a direct "getAllMessages" endpoint that structures by report for us easily, 
    // we iterate through reports. In a real app, we'd ideally filter by "has_unread_messages" or similar.
    const messageThreads = React.useMemo(() => {
        if (!reports) return [];

        let result = reports.filter(r => r.messages_count > 0 || r.status !== 'closed');

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(r =>
                r.title.toLowerCase().includes(query) ||
                r.report_number.includes(query)
            );
        }

        // Sort by updated_at (most recent first)
        return result.sort((a, b) => parseServerDate(b.updated_at) - parseServerDate(a.updated_at));
    }, [reports, searchQuery]);

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Messages</h1>
                    <p className="text-ink-muted mt-1">
                        Secure communication history with the compliance team
                    </p>
                </div>
            </div>

            <Card>
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-subtle h-5 w-5" />
                        <Input
                            placeholder="Search conversations..."
                            className="pl-10 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    {isLoading ? (
                        [0, 1, 2].map((i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-line-subtle bg-surface" aria-hidden="true">
                                <div className="flex items-start gap-4">
                                    <Skeleton.Circle className="mt-1" />
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Skeleton.Text size="xs" className="w-16" />
                                            <Skeleton.Text size="base" className="w-40" />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Skeleton.Badge className="w-14" />
                                            <Skeleton.Text className="w-40" />
                                        </div>
                                    </div>
                                </div>
                                <Skeleton className="h-5 w-5 rounded" />
                            </div>
                        ))
                    ) : messageThreads.length === 0 ? (
                        <div className="text-center py-12">
                            <MessageSquare className="w-12 h-12 text-ink-subtle mx-auto mb-3" />
                            <h3 className="text-lg font-medium text-ink">No messages found</h3>
                            <p className="text-ink-muted mt-1">
                                You don't have any active conversations matching your criteria.
                            </p>
                        </div>
                    ) : (
                        messageThreads.map((report) => (
                            <Link
                                key={report.id}
                                to={`/reporter/reports/${report.id}`}
                                className="block"
                            >
                                <div className="group flex items-center justify-between p-4 rounded-lg border border-line-subtle bg-surface hover:border-line hover:shadow-sm transition-all">
                                    <div className="flex items-start gap-4 overflow-hidden">
                                        <div className="shrink-0 mt-1">
                                            <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center">
                                                <MessageSquare className="w-5 h-5 text-accent-fg" />
                                            </div>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-xs text-ink-muted">#{report.report_number}</span>
                                                <h4 className="font-medium text-ink truncate group-hover:text-accent-fg transition-colors">
                                                    {report?.title?.split('-')[0]}
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm text-ink-muted">
                                                <span className="flex items-center">
                                                    <StatusBadge status={report.status} size="small" />
                                                </span>
                                                <span className="flex items-center">
                                                    <Clock className="w-3 h-3 mr-1" />
                                                    {formatRelativeTime(report.updated_at)}
                                                </span>
                                                <span className="flex items-center">
                                                    <MessageSquare className="w-3 h-3 mr-1" />
                                                    {report.messages_count || 0} messages
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="shrink-0 ml-4">
                                        <ArrowRight className="w-5 h-5 text-ink-subtle group-hover:text-accent-fg transform group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
};

export default Messages;
