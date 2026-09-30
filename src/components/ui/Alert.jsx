// src/components/ui/Alert.jsx
import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';

const Alert = ({
  children,
  variant = 'info',
  title,
  showIcon = true,
  dismissible = false,
  onDismiss,
  className = '',
  ...props
}) => {
  const variants = {
    info: {
      box: 'bg-info-soft border-info-line',
      icon: 'text-info-fg',
      heading: 'text-info-fg',
      icon_: Info,
    },
    success: {
      box: 'bg-success-soft border-success-line',
      icon: 'text-success-fg',
      heading: 'text-success-fg',
      icon_: CheckCircle,
    },
    warning: {
      box: 'bg-warning-soft border-warning-line',
      icon: 'text-warning-fg',
      heading: 'text-warning-fg',
      icon_: AlertCircle,
    },
    error: {
      box: 'bg-danger-soft border-danger-line',
      icon: 'text-danger-fg',
      heading: 'text-danger-fg',
      icon_: XCircle,
    },
    dark: {
      box: 'bg-sunken border-line',
      icon: 'text-ink-muted',
      heading: 'text-ink',
      icon_: Info,
    },
  };

  const config = variants[variant] || variants.info;
  const Icon = config.icon_;

  return (
    <div
      className={`rounded-xl border p-4 ${config.box} ${className}`}
      role="alert"
      {...props}
    >
      <div className="flex items-start gap-3">
        {showIcon && (
          <Icon className={`w-5 h-5 shrink-0 mt-px ${config.icon}`} />
        )}

        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`font-semibold text-sm mb-1 ${config.heading}`}>{title}</h3>
          )}
          <div className="text-sm text-ink-secondary leading-relaxed">{children}</div>
        </div>

        {dismissible && (
          <button
            type="button"
            className="shrink-0 -mt-1 -mr-1 p-1.5 rounded-md text-ink-subtle transition-colors hover:text-ink hover:bg-hover focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// Pre-styled alert variants for common use cases
export const SuccessAlert = (props) => <Alert variant="success" {...props} />;
export const ErrorAlert = (props) => <Alert variant="error" {...props} />;
export const WarningAlert = (props) => <Alert variant="warning" {...props} />;
export const InfoAlert = (props) => <Alert variant="info" {...props} />;

export default Alert;
