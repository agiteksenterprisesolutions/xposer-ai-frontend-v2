// src/components/reports/ReportDetails.jsx
import React, { useState } from 'react';
import {
  User,
  Calendar,
  Clock,
  Tag,
  FileText,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  XCircle,
  Edit,
  UserPlus,
  Download,
  Share2,
  Printer,
  Copy,
  Eye,
  Lock,
  Unlock,
} from 'lucide-react';
import Card from '../ui/Card';
import Badge, { StatusBadge, PriorityBadge, RoleBadge } from '../ui/Badge';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Tabs from '../ui/Tabs';
import { formatDate, formatDateTime, truncateText } from '../../utils/formatters';
import { validateReportFormData } from '../../utils/validators';
import { getReportDescription, getReportTitle } from '../../utils/reports';
import { tone } from '../../utils/tone';
import { copyToClipboard } from '../../utils/clipboard';
import { toast } from 'react-toastify';

const ReportDetails = ({
  report,
  currentUser,
  onUpdate,
  onAssign,
  onStatusChange,
  onMessage,
  onExport,
  onPrint,
  isEditable = false,
  showInternalNotes = false,
}) => {
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({});

  if (!report) {
    return (
      <Card>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-ink-subtle mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-ink mb-2">
            Report Not Found
          </h3>
          <p className="text-ink-muted">
            The report you're looking for doesn't exist or you don't have permission to view it.
          </p>
        </div>
      </Card>
    );
  }

  const {
    id,
    report_number,
    status,
    priority,
    created_at,
    updated_at,
    assigned_to,
    assigned_by,
    assigned_at,
    reporter_id,
    reporter,
    email,
    form_data = {},
    form_schema,
    internal_notes = [],
    tags = [],
    files = [],
    messages_count = 0,
    is_anonymous = false,
  } = report;

  // Optional on every report. In view mode an absent one is left out rather
  // than shown as an empty row; in edit mode both fields stay so they can be
  // filled in.
  const title = getReportTitle(report);
  const description = getReportDescription(report);

  const canEdit = isEditable && currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    (currentUser.role === 'officer' && assigned_to?.id === currentUser.id)
  );

  const canAssign = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'manager'
  );

  const handleStatusChange = (newStatus) => {
    if (onStatusChange) {
      onStatusChange(id, newStatus);
    }
  };

  const handleAssign = () => {
    if (onAssign) {
      onAssign(id);
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Save changes
      if (onUpdate && Object.keys(editedData).length > 0) {
        onUpdate(id, editedData);
      }
      setIsEditing(false);
      setEditedData({});
    } else {
      setIsEditing(true);
    }
  };

  const handleFieldChange = (field, value) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderReporterInfo = () => {
    if (is_anonymous) {
      return (
        <div className="flex items-center text-ink-muted">
          <Lock className="w-4 h-4 mr-2" />
          <span>Anonymous Reporter</span>
        </div>
      );
    }

    if (reporter) {
      return (
        <div>
          <div className="flex items-center">
            <User className="w-4 h-4 mr-2 text-ink-muted" />
            <span className="font-medium">{reporter.full_name || reporter.username}</span>
            {reporter.role && (
              <RoleBadge role={reporter.role} className="ml-2" />
            )}
          </div>
          {email && (
            <div className="text-sm text-ink-muted ml-6 mt-1 wrap-break-word">
              {email}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="text-ink-muted italic">
        No reporter information available
      </div>
    );
  };

  const renderAssigneeInfo = () => {
    if (!assigned_to) {
      return (
        <div className="text-ink-muted italic">
          Unassigned
          {canAssign && (
            <Button
              variant="link"
              size="small"
              onClick={handleAssign}
              className="ml-2"
            >
              Assign to me
            </Button>
          )}
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center">
          <User className="w-4 h-4 mr-2 text-ink-muted" />
          <span className="font-medium">
            {assigned_to.full_name || assigned_to.username}
          </span>
          <RoleBadge role={assigned_to.role} className="ml-2" />
        </div>
        {assigned_at && (
          <div className="text-sm text-ink-muted ml-6 mt-1">
            Assigned on {formatDate(assigned_at)}
            {assigned_by && ` by ${assigned_by.full_name || assigned_by.username}`}
          </div>
        )}
      </div>
    );
  };

  const renderFormData = () => {
    if (!form_schema || !form_schema.questions) {
      return (
        <div className="text-ink-muted italic">
          No form data available
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {form_schema.questions.map((question, index) => {
          const value = form_data[question.name];

          if (!value && value !== false) {
            return null;
          }

          return (
            <div key={index} className="border-b border-line-subtle pb-4 last:border-0 min-w-0">
              <label className="block text-sm font-medium text-ink-secondary mb-1">
                {question.label || question.name}
                {question.required && <span className="text-danger-fg ml-1">*</span>}
              </label>

              <div className="text-ink min-w-0">
                {Array.isArray(value) ? (
                  <div className="flex flex-wrap gap-1">
                    {value.map((item, i) => (
                      <Badge key={i} variant="secondary">
                        {item}
                      </Badge>
                    ))}
                  </div>
                ) : typeof value === 'boolean' ? (
                  <div className="flex items-center">
                    {value ? (
                      <CheckCircle className="w-4 h-4 text-success-fg mr-2" />
                    ) : (
                      <XCircle className="w-4 h-4 text-danger-fg mr-2" />
                    )}
                    {value ? 'Yes' : 'No'}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap wrap-break-word">{String(value)}</p>
                )}
              </div>

              {question.help_text && (
                <p className="mt-1 text-sm text-ink-muted">
                  {question.help_text}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTimeline = () => {
    const events = [
      {
        id: 1,
        title: 'Report Created',
        description: 'Report was submitted to the system',
        date: created_at,
        icon: FileText,
        color: 'blue',
      },
      ...(assigned_at ? [{
        id: 2,
        title: 'Assigned',
        description: `Assigned to ${assigned_to?.full_name || assigned_to?.username}`,
        date: assigned_at,
        icon: UserPlus,
        color: 'purple',
      }] : []),
      ...(status !== 'pending' ? [{
        id: 3,
        title: 'Status Changed',
        description: `Status updated to ${status.replace('_', ' ')}`,
        date: updated_at,
        icon: CheckCircle,
        color: status === 'resolved' ? 'green' : 'yellow',
      }] : []),
    ];

    return (
      <div className="flow-root">
        <ul className="-mb-8">
          {events.map((event, eventIdx) => {
            const Icon = event.icon;
            return (
              <li key={event.id}>
                <div className="relative pb-8">
                  {eventIdx !== events.length - 1 ? (
                    <span
                      className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-active"
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className={`h-8 w-8 rounded-full ${tone(event.color).soft} flex items-center justify-center ring-8 ring-surface`}>
                        <Icon className={`h-5 w-5 ${tone(event.color).fg}`} />
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                      <div>
                        <p className="text-sm text-ink">{event.title}</p>
                        <p className="text-sm text-ink-muted wrap-break-word">{event.description}</p>
                      </div>
                      <div className="whitespace-nowrap text-right text-sm text-ink-muted">
                        {formatDateTime(event.date)}
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <h1 className="text-2xl font-bold text-ink">
              #{report_number}
            </h1>
            <StatusBadge status={status} />
            <PriorityBadge priority={priority} />
          </div>

          <div className="flex items-center text-ink-muted">
            <Calendar className="w-4 h-4 mr-1" />
            <span className="text-sm">
              Created {formatDate(created_at)} • Last updated {formatDate(updated_at)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button
              variant={isEditing ? 'primary' : 'secondary'}
              onClick={handleEditToggle}
              startIcon={Edit}
            >
              {isEditing ? 'Save Changes' : 'Edit Report'}
            </Button>
          )}

          {onExport && (
            <Button
              variant="ghost"
              onClick={() => onExport(report)}
              startIcon={Download}
            >
              Export
            </Button>
          )}

          {onPrint && (
            <Button
              variant="ghost"
              onClick={() => onPrint(report)}
              startIcon={Printer}
            >
              Print
            </Button>
          )}

          <Button
            variant="ghost"
            onClick={async () => {
              if (await copyToClipboard(window.location.href)) {
                toast.success('Link copied to clipboard');
              } else {
                toast.error('Could not copy the link — please copy it from the address bar.');
              }
            }}
            startIcon={Share2}
          >
            Share
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Trigger value="details">Details</Tabs.Trigger>
          <Tabs.Trigger value="form">Form Data</Tabs.Trigger>
          <Tabs.Trigger value="timeline">Timeline</Tabs.Trigger>
          <Tabs.Trigger value="files">Files ({files.length})</Tabs.Trigger>
          {showInternalNotes && (
            <Tabs.Trigger value="notes">Internal Notes</Tabs.Trigger>
          )}
        </Tabs.List>

        {/* Details Tab */}
        <Tabs.Content value="details">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <Card.Title>Report Information</Card.Title>
              <Card.Content className="space-y-4">
                {(isEditing || title) && (
                  <div>
                    <label className="block text-sm font-medium text-ink-secondary mb-1">
                      Title
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editedData.title ?? title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        className="w-full border border-line-strong rounded-lg px-3 py-2"
                      />
                    ) : (
                      <p className="text-ink wrap-break-word">{title}</p>
                    )}
                  </div>
                )}

                {(isEditing || description) && (
                  <div>
                    <label className="block text-sm font-medium text-ink-secondary mb-1">
                      Description
                    </label>
                    {isEditing ? (
                      <textarea
                        rows={4}
                        value={editedData.description ?? description}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        className="w-full border border-line-strong rounded-lg px-3 py-2"
                      />
                    ) : (
                      <p className="text-ink whitespace-pre-wrap wrap-break-word">
                        {description}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card.Content>
            </Card>

            <Card>
              <Card.Title>Assignment & Status</Card.Title>
              <Card.Content className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-2">
                    Reporter
                  </label>
                  {renderReporterInfo()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-2">
                    Assigned To
                  </label>
                  {renderAssigneeInfo()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-2">
                    Status
                  </label>
                  {isEditing ? (
                    <select
                      value={editedData.status || status}
                      onChange={(e) => handleFieldChange('status', e.target.value)}
                      className="w-full border border-line-strong rounded-lg px-3 py-2"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="under_review">Under Review</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  ) : (
                    <div className="flex items-center">
                      <StatusBadge status={status} />
                      {canEdit && (
                        <Button
                          variant="link"
                          size="small"
                          onClick={() => setIsEditing(true)}
                          className="ml-2"
                        >
                          Change
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-2">
                    Priority
                  </label>
                  {isEditing ? (
                    <select
                      value={editedData.priority || priority}
                      onChange={(e) => handleFieldChange('priority', e.target.value)}
                      className="w-full border border-line-strong rounded-lg px-3 py-2"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  ) : (
                    <PriorityBadge priority={priority} />
                  )}
                </div>

                {isEditing && (
                  <div className="pt-4 border-t border-line">
                    <div className="flex space-x-2">
                      <Button
                        variant="secondary"
                        onClick={handleEditToggle}
                      >
                        Save Changes
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setIsEditing(false);
                          setEditedData({});
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Content>

        {/* Form Data Tab */}
        <Tabs.Content value="form">
          <Card>
            <Card.Title>Form Data</Card.Title>
            <Card.Content>
              {renderFormData()}
            </Card.Content>
          </Card>
        </Tabs.Content>

        {/* Timeline Tab */}
        <Tabs.Content value="timeline">
          <Card>
            <Card.Title>Report Timeline</Card.Title>
            <Card.Content>
              {renderTimeline()}
            </Card.Content>
          </Card>
        </Tabs.Content>

        {/* Files Tab */}
        <Tabs.Content value="files">
          <Card>
            <Card.Title>Attached Files ({files.length})</Card.Title>
            <Card.Content>
              {files.length === 0 ? (
                <div className="text-center py-8 text-ink-muted">
                  No files attached to this report
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="border border-line rounded-lg p-4 hover:border-line-accent transition-colors"
                    >
                      <div className="flex items-start">
                        <div className="shrink-0">
                          <FileText className="w-8 h-8 text-ink-subtle" />
                        </div>
                        <div className="ml-3 flex-1">
                          <p className="text-sm font-medium text-ink truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown size'}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {file.type || 'Unknown type'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => window.open(file.url, '_blank')}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Content>
          </Card>
        </Tabs.Content>

        {/* Internal Notes Tab */}
        {showInternalNotes && (
          <Tabs.Content value="notes">
            <Card>
              <Card.Title>Internal Notes</Card.Title>
              <Card.Content>
                {internal_notes.length === 0 ? (
                  <div className="text-center py-8 text-ink-muted">
                    No internal notes for this report
                  </div>
                ) : (
                  <div className="space-y-4">
                    {internal_notes.map((note, index) => (
                      <div
                        key={index}
                        className="border-l-4 border-line-accent pl-4 py-2"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium">
                            {note.created_by?.full_name || note.created_by?.username || 'Unknown'}
                          </span>
                          <span className="text-sm text-ink-muted">
                            {formatDateTime(note.created_at)}
                          </span>
                        </div>
                        <p className="text-ink-secondary whitespace-pre-wrap wrap-break-word">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Content>
            </Card>
          </Tabs.Content>
        )}
      </Tabs>

      {/* Quick Actions */}
      {currentUser && currentUser.role !== 'reporter' && (
        <Card>
          <Card.Title>Quick Actions</Card.Title>
          <Card.Content>
            <div className="flex flex-wrap gap-2">
              {status === 'pending' && (
                <Button
                  variant="secondary"
                  onClick={() => handleStatusChange('in_progress')}
                >
                  Start Investigation
                </Button>
              )}

              {status === 'in_progress' && (
                <Button
                  variant="secondary"
                  onClick={() => handleStatusChange('under_review')}
                >
                  Send for Review
                </Button>
              )}

              {status === 'under_review' && (
                <Button
                  variant="success"
                  onClick={() => handleStatusChange('resolved')}
                >
                  Mark as Resolved
                </Button>
              )}

              {status === 'resolved' && (
                <Button
                  variant="default"
                  onClick={() => handleStatusChange('closed')}
                >
                  Close Report
                </Button>
              )}

              <Button
                variant="danger"
                onClick={() => handleStatusChange('rejected')}
              >
                Reject Report
              </Button>

              {!assigned_to && canAssign && (
                <Button
                  variant="secondary"
                  onClick={handleAssign}
                  startIcon={UserPlus}
                >
                  Assign to Me
                </Button>
              )}

              {onMessage && (
                <Button
                  variant="ghost"
                  onClick={() => onMessage(report)}
                  startIcon={MessageSquare}
                >
                  Send Message
                </Button>
              )}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
};

export default ReportDetails;
