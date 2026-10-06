// src/components/reports/ReportCard.jsx
import React from 'react';
import { 
  Clock, 
  User, 
  AlertCircle, 
  MessageSquare, 
  Calendar,
  Eye,
  ChevronRight
} from 'lucide-react';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import Badge, { StatusBadge, PriorityBadge } from '../ui/Badge';
import Button from '../ui/Button';
import { formatDate, truncateText } from '../../utils/formatters';

const ReportCard = ({
  report,
  onClick,
  showActions = true,
  className = '',
  compact = false,
}) => {
  const {
    id,
    report_number,
    title,
    description,
    status,
    priority,
    created_at,
    assigned_to,
    assigned_by,
    messages_count = 0,
    tags = [],
  } = report;

  const handleClick = () => {
    if (onClick) {
      onClick(report);
    }
  };

  const getAssigneeName = () => {
    if (assigned_to?.full_name) {
      return assigned_to.full_name;
    }
    if (assigned_to?.username) {
      return assigned_to.username;
    }
    return 'Unassigned';
  };

  if (compact) {
    return (
      <Card 
        className={`hover:shadow-lg transition-shadow duration-200 cursor-pointer ${className}`}
        onClick={handleClick}
        hover
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-mono text-ink-muted">
                #{report_number}
              </span>
              <StatusBadge status={status} />
              <PriorityBadge priority={priority} />
            </div>
            <h4 className="text-sm font-medium text-ink truncate">
              {title}
            </h4>
          </div>
          <ChevronRight className="w-5 h-5 text-ink-subtle" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={`${className}`} hover>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-mono font-semibold text-accent-fg">
              #{report_number}
            </span>
            <StatusBadge status={status} />
            <PriorityBadge priority={priority} />
          </div>
          
          <h3 className="text-lg font-semibold text-ink mb-2">
            {title}
          </h3>
          
          <p className="text-ink-muted text-sm mb-4 line-clamp-2">
            {truncateText(description, 150)}
          </p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" size="small">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="default" size="small">
                +{tags.length - 3} more
              </Badge>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              {formatDate(created_at)}
            </div>
            
            <div className="flex items-center">
              <User className="w-4 h-4 mr-1" />
              {getAssigneeName()}
            </div>
            
            <div className="flex items-center">
              <MessageSquare className="w-4 h-4 mr-1" />
              {messages_count} messages
            </div>
          </div>
        </div>
        
        {showActions && (
          <div className="mt-4 sm:mt-0 sm:ml-4 flex flex-col space-y-2">
            <Button
              variant="secondary"
              size="small"
              onClick={handleClick}
              startIcon={Eye}
            >
              View Details
            </Button>
            {status === 'pending' && (
              <Button
                variant="secondary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle assign action
                }}
              >
                Assign to Me
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

// A grid card while reports load — same card, data stubbed.
export const ReportGridCardSkeleton = () => (
  <Card className="h-full" aria-hidden="true">
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <div className="flex justify-between items-start mb-2">
          <Skeleton.Badge className="w-16" />
          <Skeleton.Badge className="w-14" />
        </div>
        <Skeleton.Text size="xs" className="w-20" />
      </div>
      <Skeleton.Text className="mb-2 w-3/4" />
      <div className="mt-auto pt-4 border-t border-line-subtle">
        <Skeleton.Text size="xs" className="w-14" />
      </div>
    </div>
  </Card>
);

// Grid view variant
export const ReportGridCard = ({ report, onClick }) => {
  const { report_number, title, status, priority, created_at } = report;

  return (
    <Card 
      className="hover:shadow-lg transition-all duration-200 cursor-pointer h-full"
      onClick={onClick}
      hover
    >
      <div className="h-full flex flex-col">
        <div className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <StatusBadge status={status} />
            <PriorityBadge priority={priority} />
          </div>
          <span className="text-xs font-mono text-ink-muted">
            #{report_number}
          </span>
        </div>
        
        <h4 className="text-sm font-semibold text-ink mb-2 line-clamp-2">
          {title}
        </h4>
        
        <div className="mt-auto pt-4 border-t border-line-subtle">
          <div className="flex items-center text-xs text-ink-muted">
            <Clock className="w-3 h-3 mr-1" />
            {formatDate(created_at, 'MMM dd')}
          </div>
        </div>
      </div>
    </Card>
  );
};

// Minimal card for dashboard
export const ReportMiniCard = ({ report, onClick }) => {
  const { report_number, title, status, priority } = report;

  return (
    <div 
      className="bg-surface rounded-lg border border-line p-3 hover:border-line-accent hover:shadow-sm transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-xs font-mono text-ink-muted">
              #{report_number}
            </span>
            <Badge size="small" variant={
              status === 'pending' ? 'warning' :
              status === 'in_progress' ? 'primary' :
              status === 'resolved' ? 'success' : 'default'
            }>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
          <h5 className="text-sm font-medium text-ink line-clamp-2">
            {title}
          </h5>
        </div>
        {priority === 'critical' && (
          <AlertCircle className="w-4 h-4 text-danger-fg shrink-0" />
        )}
      </div>
    </div>
  );
};

export default ReportCard;