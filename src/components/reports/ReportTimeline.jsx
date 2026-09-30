// src/components/reports/ReportTimeline.jsx
import React from 'react';
import {
  FileText,
  User,
  MessageSquare,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Edit,
  UserPlus,
  Shield,
  Lock,
  Unlock,
  Download,
  Printer,
  Tag,
  Eye,
} from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

const ReportTimeline = ({ activities = [] }) => {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-ink-subtle mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-ink mb-2">
          No Activity Yet
        </h3>
        <p className="text-ink-muted">
          There hasn't been any activity on this report yet.
        </p>
      </div>
    );
  }

  const getActivityIcon = (type) => {
    const icons = {
      created: FileText,
      assigned: UserPlus,
      status_changed: CheckCircle,
      message_sent: MessageSquare,
      note_added: Edit,
      file_uploaded: Download,
      viewed: Eye,
      reopened: Unlock,
      closed: Lock,
      rejected: XCircle,
      escalated: AlertCircle,
      tagged: Tag,
      priority_changed: AlertCircle,
    };

    return icons[type] || Clock;
  };

  const getActivityColor = (type) => {
    const colors = {
      created: 'blue',
      assigned: 'purple',
      status_changed: 'green',
      message_sent: 'indigo',
      note_added: 'yellow',
      file_uploaded: 'gray',
      viewed: 'gray',
      reopened: 'green',
      closed: 'red',
      rejected: 'red',
      escalated: 'orange',
      tagged: 'blue',
      priority_changed: 'orange',
    };

    return colors[type] || 'gray';
  };

  const getActivityTitle = (activity) => {
    const { type, data } = activity;

    switch (type) {
      case 'created':
        return 'Report Created';
      case 'assigned':
        return `Assigned to ${data.assigned_to}`;
      case 'status_changed':
        return `Status Changed to ${data.new_status}`;
      case 'message_sent':
        return 'Message Sent';
      case 'note_added':
        return 'Internal Note Added';
      case 'file_uploaded':
        return `File Uploaded: ${data.file_name}`;
      case 'viewed':
        return `Viewed by ${data.viewed_by}`;
      case 'reopened':
        return 'Report Reopened';
      case 'closed':
        return 'Report Closed';
      case 'rejected':
        return 'Report Rejected';
      case 'escalated':
        return 'Report Escalated';
      case 'tagged':
        return `Tag Added: ${data.tag}`;
      case 'priority_changed':
        return `Priority Changed to ${data.new_priority}`;
      default:
        return 'Activity';
    }
  };

  const getActivityDescription = (activity) => {
    const { type, data, user } = activity;

    const userName = user?.full_name || user?.username || 'System';

    switch (type) {
      case 'created':
        return `${userName} submitted a new report`;
      case 'assigned':
        return `${userName} assigned this report`;
      case 'status_changed':
        return `${userName} changed the status from ${data.old_status} to ${data.new_status}`;
      case 'message_sent':
        return data.is_internal
          ? `${userName} added an internal message`
          : `${userName} sent a message`;
      case 'note_added':
        return `${userName} added an internal note`;
      case 'file_uploaded':
        return `${userName} uploaded a file`;
      case 'viewed':
        return `${userName} viewed the report`;
      case 'reopened':
        return `${userName} reopened the report`;
      case 'closed':
        return `${userName} closed the report`;
      case 'rejected':
        return `${userName} rejected the report`;
      case 'escalated':
        return `${userName} escalated the report`;
      case 'tagged':
        return `${userName} added a tag`;
      case 'priority_changed':
        return `${userName} changed priority from ${data.old_priority} to ${data.new_priority}`;
      default:
        return `${userName} performed an action`;
    }
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, activityIdx) => {
          const Icon = getActivityIcon(activity.type);
          const color = getActivityColor(activity.type);
          const colorClasses = {
            blue: 'bg-accent-soft text-accent-fg',
            green: 'bg-success-soft text-success-fg',
            yellow: 'bg-warning-soft text-warning-fg',
            red: 'bg-danger-soft text-danger-fg',
            purple: 'bg-accent-soft text-accent-fg',
            orange: 'bg-warning-soft text-warning-fg',
            indigo: 'bg-accent-soft text-accent-fg',
            gray: 'bg-active text-ink-muted',
          };

          return (
            <li key={activity.id || activityIdx}>
              <div className="relative pb-8">
                {activityIdx !== activities.length - 1 ? (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-active"
                    aria-hidden="true"
                  />
                ) : null}

                <div className="relative flex space-x-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full ${colorClasses[color]} flex items-center justify-center ring-8 ring-surface`}>
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {getActivityTitle(activity)}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {getActivityDescription(activity)}
                      </p>

                      {activity.data?.note && (
                        <div className="mt-2 p-2 bg-subtle rounded-md border border-line">
                          <p className="text-sm text-ink-secondary whitespace-pre-wrap">
                            {activity.data.note}
                          </p>
                        </div>
                      )}

                      {activity.data?.message && !activity.data?.is_internal && (
                        <div className="mt-2 p-2 bg-accent-soft rounded-md border border-line-accent">
                          <p className="text-sm text-accent-fg whitespace-pre-wrap">
                            {activity.data.message}
                          </p>
                        </div>
                      )}

                      {activity.data?.is_internal && activity.data?.message && (
                        <div className="mt-2 p-2 bg-warning-soft rounded-md border border-warning-line">
                          <div className="flex items-center text-warning-fg mb-1">
                            <Shield className="w-3 h-3 mr-1" />
                            <span className="text-xs font-medium">Internal Note</span>
                          </div>
                          <p className="text-sm text-warning-fg whitespace-pre-wrap">
                            {activity.data.message}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="whitespace-nowrap text-right text-sm text-ink-muted">
                      <div>{formatDateTime(activity.created_at)}</div>
                      <div className="text-xs mt-1">
                        {formatRelativeTime(activity.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// Timeline item component for individual activities
export const TimelineItem = ({ activity }) => {
  const Icon = getActivityIcon(activity.type);
  const color = getActivityColor(activity.type);
  const colorClasses = {
    blue: 'bg-accent-soft text-accent-fg',
    green: 'bg-success-soft text-success-fg',
    yellow: 'bg-warning-soft text-warning-fg',
    red: 'bg-danger-soft text-danger-fg',
    purple: 'bg-accent-soft text-accent-fg',
    orange: 'bg-warning-soft text-warning-fg',
    indigo: 'bg-accent-soft text-accent-fg',
    gray: 'bg-active text-ink-muted',
  };

  return (
    <div className="relative flex items-start mb-6 last:mb-0">
      <div className="relative mr-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-medium text-ink">
            {getActivityTitle(activity)}
          </span>
          <span className="text-ink-muted ml-2">
            {formatRelativeTime(activity.created_at)}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {getActivityDescription(activity)}
        </p>
      </div>
    </div>
  );
};

export default ReportTimeline;