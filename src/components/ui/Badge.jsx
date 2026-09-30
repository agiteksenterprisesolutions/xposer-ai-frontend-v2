const Badge = ({
  children,
  variant = 'default',
  size = 'medium',
  rounded = 'full',
  dot = false,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center gap-1.5 font-semibold whitespace-nowrap border leading-none';

  // Soft fill + hairline + readable foreground: legible on either theme, and
  // never relies on color alone once paired with the optional dot.
  const variants = {
    default: 'bg-active border-transparent text-ink-muted',
    primary: 'bg-accent-soft border-line-accent text-accent-fg',
    secondary: 'bg-info-soft border-info-line text-info-fg',
    success: 'bg-success-soft border-success-line text-success-fg',
    warning: 'bg-warning-soft border-warning-line text-warning-fg',
    danger: 'bg-danger-soft border-danger-line text-danger-fg',
    info: 'bg-info-soft border-info-line text-info-fg',
    purple: 'bg-accent-soft border-line-accent text-accent-fg',
    pink: 'bg-danger-soft border-danger-line text-danger-fg',
    dark: 'bg-sunken border-line text-ink',
  };

  const sizes = {
    small: 'px-2 py-0.5 text-[10px] tracking-[0.03em]',
    medium: 'px-2.5 py-1 text-[11px] tracking-[0.02em]',
    large: 'px-3 py-1.5 text-xs tracking-[0.02em]',
  };

  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  const dotColors = {
    default: 'bg-ink-subtle',
    primary: 'bg-accent',
    secondary: 'bg-info-solid',
    success: 'bg-success-solid',
    warning: 'bg-warning-solid',
    danger: 'bg-danger-solid',
    info: 'bg-info-solid',
    purple: 'bg-accent',
    pink: 'bg-danger-solid',
    dark: 'bg-ink',
  };

  const variantClass = variants[variant] || variants.default;
  const sizeClass = sizes[size] || sizes.medium;
  const roundedClass = roundedClasses[rounded] || roundedClasses.full;

  return (
    <span
      className={`${baseClasses} ${variantClass} ${sizeClass} ${roundedClass} ${className}`}
      {...props}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${dotColors[variant] || dotColors.default}`} />
      )}
      {children}
    </span>
  );
};

// Status badges for reports
export const StatusBadge = ({ status }) => {
  const statusConfig = {
    draft: { variant: 'default', label: 'Draft' },
    submitted: { variant: 'success', label: 'Submitted' },
    pending: { variant: 'warning', label: 'Pending' },
    in_progress: { variant: 'primary', label: 'In Progress' },
    under_review: { variant: 'info', label: 'Under Review' },
    resolved: { variant: 'success', label: 'Resolved' },
    closed: { variant: 'default', label: 'Closed' },
    rejected: { variant: 'danger', label: 'Rejected' },
  };

  const config = statusConfig[status] || { variant: 'default', label: status };

  return <Badge variant={config.variant} size="small" dot>{config.label}</Badge>;
};

// Priority badges for reports
export const PriorityBadge = ({ priority }) => {
  const priorityConfig = {
    low: { variant: 'default', label: 'Low' },
    medium: { variant: 'secondary', label: 'Medium' },
    high: { variant: 'warning', label: 'High' },
    critical: { variant: 'danger', label: 'Critical' },
  };

  const config = priorityConfig[priority] || { variant: 'default', label: priority };

  return <Badge variant={config.variant} size="small">{config.label}</Badge>;
};

// Role badges for users
// Roles are organization-defined, so the name comes from the organization's
// role record (pass it as `label`). The colours only mark the two structural
// codes; every other role — seeded or invented — looks the same.
export const RoleBadge = ({ role, label }) => {
  const variant = role === 'admin' ? 'danger' : role === 'reporter' ? 'default' : 'secondary';
  const text = label || (role ? role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ') : '');

  return <Badge variant={variant} size="small">{text}</Badge>;
};

export default Badge;
