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
import { useTranslation } from 'react-i18next';

const ACTIVITY_ICONS = {
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

const ACTIVITY_COLORS = {
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

const COLOR_CLASSES = {
  blue: 'bg-accent-soft text-accent-fg',
  green: 'bg-success-soft text-success-fg',
  yellow: 'bg-warning-soft text-warning-fg',
  red: 'bg-danger-soft text-danger-fg',
  purple: 'bg-accent-soft text-accent-fg',
  orange: 'bg-warning-soft text-warning-fg',
  indigo: 'bg-accent-soft text-accent-fg',
  gray: 'bg-active text-ink-muted',
};

const getActivityIcon = (type) => ACTIVITY_ICONS[type] || Clock;
const getActivityColor = (type) => ACTIVITY_COLORS[type] || 'gray';

// Status and priority values arrive as codes; show their labels.
const statusLabel = (t, status) => (status ? t(`common:reportStatus.${status}`, { defaultValue: status }) : '');
const priorityLabel = (t, priority) => (priority ? t(`common:priority.${priority}`, { defaultValue: priority }) : '');

const KNOWN = new Set(Object.keys(ACTIVITY_ICONS));

const getActivityTitle = (t, activity) => {
  const { type, data = {} } = activity;
  if (!KNOWN.has(type)) return t('timeline.title.default');
  return t(`timeline.title.${type}`, {
    assignee: data.assigned_to,
    status: statusLabel(t, data.new_status),
    file: data.file_name,
    viewer: data.viewed_by,
    tag: data.tag,
    priority: priorityLabel(t, data.new_priority),
  });
};

const getActivityDescription = (t, activity) => {
  const { type, data = {}, user } = activity;
  const name = user?.full_name || user?.username || t('timeline.system');
  if (!KNOWN.has(type)) return t('timeline.description.default', { name });
  const key = type === 'message_sent' && data.is_internal ? 'message_sent_internal' : type;
  return t(`timeline.description.${key}`, {
    name,
    from: type === 'priority_changed' ? priorityLabel(t, data.old_priority) : statusLabel(t, data.old_status),
    to: type === 'priority_changed' ? priorityLabel(t, data.new_priority) : statusLabel(t, data.new_status),
  });
};

const ReportTimeline = ({ activities = [] }) => {
  const { t } = useTranslation('dashboards');

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-ink-subtle mx-auto mb-4" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-ink mb-2">
          {t('timeline.emptyTitle')}
        </h3>
        <p className="text-ink-muted">
          {t('timeline.emptyText')}
        </p>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, activityIdx) => {
          const Icon = getActivityIcon(activity.type);
          const color = getActivityColor(activity.type);

          return (
            <li key={activity.id || activityIdx}>
              <div className="relative pb-8">
                {activityIdx !== activities.length - 1 ? (
                  <span
                    className="absolute top-4 start-4 -ms-px h-full w-0.5 bg-active"
                    aria-hidden="true"
                  />
                ) : null}

                <div className="relative flex gap-3">
                  <div>
                    <span className={`h-8 w-8 rounded-full ${COLOR_CLASSES[color]} flex items-center justify-center ring-8 ring-surface`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 justify-between gap-4 pt-1.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {getActivityTitle(t, activity)}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {getActivityDescription(t, activity)}
                      </p>

                      {activity.data?.note && (
                        <div className="mt-2 p-2 bg-subtle rounded-md border border-line">
                          <p className="text-sm text-ink-secondary whitespace-pre-wrap" dir="auto">
                            {activity.data.note}
                          </p>
                        </div>
                      )}

                      {activity.data?.message && !activity.data?.is_internal && (
                        <div className="mt-2 p-2 bg-accent-soft rounded-md border border-line-accent">
                          <p className="text-sm text-accent-fg whitespace-pre-wrap" dir="auto">
                            {activity.data.message}
                          </p>
                        </div>
                      )}

                      {activity.data?.is_internal && activity.data?.message && (
                        <div className="mt-2 p-2 bg-warning-soft rounded-md border border-warning-line">
                          <div className="flex items-center text-warning-fg mb-1">
                            <Shield className="w-3 h-3 me-1" aria-hidden="true" />
                            <span className="text-xs font-medium">{t('timeline.internalNote')}</span>
                          </div>
                          <p className="text-sm text-warning-fg whitespace-pre-wrap" dir="auto">
                            {activity.data.message}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="whitespace-nowrap text-end text-sm text-ink-muted">
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
  const { t } = useTranslation('dashboards');
  const Icon = getActivityIcon(activity.type);
  const color = getActivityColor(activity.type);

  return (
    <div className="relative flex items-start mb-6 last:mb-0">
      <div className="relative me-3">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${COLOR_CLASSES[color]}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-medium text-ink">
            {getActivityTitle(t, activity)}
          </span>
          <span className="text-ink-muted ms-2">
            {formatRelativeTime(activity.created_at)}
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {getActivityDescription(t, activity)}
        </p>
      </div>
    </div>
  );
};

export default ReportTimeline;
