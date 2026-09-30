import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
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
import { reportsAPI, messagesAPI, reportTypesAPI } from '../../api';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/layout/LoadingSpinner';
import { StatusBadge } from '../../components/ui/Badge';
import { formatRelativeTime, parseServerDate } from '../../utils/formatters';
import useSEO from '../../hooks/useSEO';
import { normalizeReportsResponse } from '../../utils/reports';
import { casePath } from '../../utils/navigation';

const ComplianceMessages = () => {
  useSEO({
    title: 'Messages',
    description: 'Secure conversations with reporters across your assigned cases.',
    noIndex: true,
  });
  const { orgSlug } = useParams();
    const [reports, setReports] = useState([]);
    const [reportTypes, setReportTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'assigned'

    const fetchThreads = useCallback(async () => {
        setLoading(true);
        try {
            const [reportsData, typesData] = await Promise.all([
                reportsAPI.getAllReports(),
                reportTypesAPI.getReportTypes()
            ]);

            const reportsList = normalizeReportsResponse(reportsData).items;
            // In a more complex backend, we'd have a specific "message-threads" endpoint.
            // Here we show reports that have activity.
            setReports(reportsList);
            setReportTypes(typesData);
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

    if (loading) return <LoadingSpinner message="Loading conversations..." />;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-ink">Compliance Inbox</h1>
                <p className="text-ink-muted mt-1">Communicate with reporters and manage case discussions</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <Card padding="none">
                        <div className="p-4 border-b border-line-subtle bg-subtle">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-subtle h-4 w-4" />
                                <Input
                                    placeholder="Search by report ID or keywords..."
                                    className="pl-10 h-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="divide-y divide-line-subtle max-h-[calc(100vh-20rem)] overflow-y-auto">
                            {filteredThreads.length === 0 ? (
                                <div className="p-12 text-center">
                                    <MessageSquare className="h-12 w-12 text-ink-subtle mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-ink">No conversations found</h3>
                                    <p className="text-ink-muted">Active reports with messages will appear here.</p>
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
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-xs font-mono font-bold text-accent-fg">#{thread.report_number}</span>
                                                    <StatusBadge status={thread.status} size="small" />
                                                </div>
                                                <span className="text-xs text-ink-subtle flex items-center">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    {formatRelativeTime(thread.updated_at)}
                                                </span>
                                            </div>

                                            <h4 className="text-sm font-semibold text-ink truncate mb-1">
                                                {thread.title || reportTypes.find(t => t.id === thread.report_type_id)?.name || 'General Report'}
                                            </h4>

                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex items-center space-x-4 text-xs text-ink-muted">
                                                    <span className="flex items-center">
                                                        <User className="h-3 w-3 mr-1" />
                                                        {thread.assignee_name || 'Unassigned'}
                                                    </span>
                                                    <span className="flex items-center text-accent-fg font-medium">
                                                        <MessageSquare className="h-3 w-3 mr-1" />
                                                        {thread.messages_count || 0} messages
                                                    </span>
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-ink-subtle" />
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
                            <Card.Title className="text-sm">Team Activity</Card.Title>
                        </Card.Header>
                        <Card.Content className="space-y-4">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-ink-muted">Unread Messages</span>
                                <span className="px-2 py-0.5 bg-danger-soft text-danger-fg rounded-full font-bold">3</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-ink-muted">Pending Replies</span>
                                <span className="px-2 py-0.5 bg-warning-soft text-warning-fg rounded-full font-bold">12</span>
                            </div>
                        </Card.Content>
                    </Card>

                    <Card className="bg-accent-soft border-line-accent">
                        <div className="flex items-start space-x-3">
                            <AlertCircle className="h-5 w-5 text-accent-fg mt-0.5" />
                            <div>
                                <h5 className="text-xs font-bold text-accent-fg">Communication Guidelines</h5>
                                <p className="text-[10px] text-accent-fg mt-1">
                                    Maintain strict confidentiality. Use internal notes for team discussion and public messages for reporter communication.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ComplianceMessages;
