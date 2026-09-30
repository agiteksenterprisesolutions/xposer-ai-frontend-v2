// src/components/ui/Card.jsx
import React from 'react';

const Card = ({
  children,
  title,
  icon: Icon,
  className = '',
  padding = 'default',
  shadow = 'default',
  border = true,
  hover = false,
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    small: 'p-3 sm:p-4',
    default: 'p-4 sm:p-5 md:p-6',
    large: 'p-5 sm:p-6 md:p-8',
  };

  const shadowClasses = {
    none: 'shadow-none',
    sm: 'shadow-xs',
    default: 'shadow-sm',
    lg: 'shadow-md',
    xl: 'shadow-lg',
  };

  const borderClass = border ? 'border border-line' : 'border-0';
  const hoverClass = hover
    ? 'transition-[border-color,box-shadow,transform] duration-200 ease-out-xp hover:border-line-strong hover:shadow-lg hover:-translate-y-0.5'
    : '';

  return (
    <div
      className={`bg-surface text-ink rounded-xl ${borderClass} ${paddingClasses[padding] || paddingClasses.default} ${shadowClasses[shadow] || shadowClasses.default} ${hoverClass} ${className}`}
      {...props}
    >
      {(title || Icon) && (
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-line-subtle">
          {Icon && (
            <span className="inline-flex items-center justify-center h-8 w-8 shrink-0 rounded-lg bg-accent-soft text-accent-fg">
              <Icon className="w-4 h-4" />
            </span>
          )}
          {title && (
            <h3 className="text-base font-semibold text-ink tracking-[-0.01em]">{title}</h3>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
);

const CardTitle = ({ children, className = '', ...props }) => (
  <h3 className={`text-base sm:text-lg font-semibold text-ink tracking-[-0.01em] ${className}`} {...props}>
    {children}
  </h3>
);

const CardDescription = ({ children, className = '', ...props }) => (
  <p className={`text-xs sm:text-sm text-ink-muted mt-1 ${className}`} {...props}>
    {children}
  </p>
);

const CardContent = ({ children, className = '', ...props }) => (
  <div className={`${className}`} {...props}>
    {children}
  </div>
);

const CardFooter = ({ children, className = '', ...props }) => (
  <div className={`mt-5 pt-4 sm:mt-6 sm:pt-5 border-t border-line-subtle ${className}`} {...props}>
    {children}
  </div>
);

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

export default Card;
