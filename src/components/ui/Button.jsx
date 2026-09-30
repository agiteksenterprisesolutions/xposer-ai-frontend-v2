// src/components/ui/Button.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = React.forwardRef(({
  children,
  variant = 'primary',
  size = 'medium',
  isLoading = false,
  disabled = false,
  fullWidth = false,
  startIcon: StartIcon,
  endIcon: EndIcon,
  className = '',
  type = 'button',
  onClick,
  ...props
}, ref) => {
  const baseClasses = [
    'inline-flex items-center justify-center gap-2',
    'font-semibold tracking-[-0.01em] whitespace-nowrap',
    'rounded-lg border',
    'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out-xp',
    'focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0',
  ].join(' ');

  const variants = {
    primary:
      'bg-accent border-accent text-on-accent shadow-glow hover:bg-accent-hover hover:border-accent-hover hover:-translate-y-px active:translate-y-0 active:bg-accent-active active:border-accent-active',
    secondary:
      'bg-raised border-line text-ink hover:bg-hover hover:border-line-strong active:bg-active',
    outline:
      'bg-transparent border-line text-ink-muted font-medium hover:text-ink hover:bg-hover hover:border-line-strong',
    danger:
      'bg-danger-solid border-danger-solid text-white hover:brightness-110 hover:-translate-y-px active:translate-y-0 active:brightness-95',
    warning:
      'bg-warning-solid border-warning-solid text-ink-inverse hover:brightness-110 hover:-translate-y-px active:translate-y-0 active:brightness-95',
    success:
      'bg-success-solid border-success-solid text-white hover:brightness-110 hover:-translate-y-px active:translate-y-0 active:brightness-95',
    ghost:
      'bg-transparent border-transparent text-ink-muted font-medium hover:text-ink hover:bg-hover active:bg-active',
    link:
      'bg-transparent border-transparent text-link font-medium p-0 h-auto hover:text-link-hover hover:underline underline-offset-4',
  };

  const sizes = {
    small: 'h-8 px-3 text-xs',
    medium: 'h-10 px-4 text-sm',
    large: 'h-12 px-6 text-[0.9375rem]',
    xlarge: 'h-14 px-8 text-base',
    icon: 'h-10 w-10 p-0',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const variantClass = variants[variant] || variants.primary;
  // The link variant carries no box, so the size paddings would fight it
  const sizeClass = variant === 'link' ? 'text-sm' : (sizes[size] || sizes.medium);
  const iconSize = size === 'small' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClass} ${sizeClass} ${widthClass} ${className}`}
      onClick={onClick}
      {...props}
    >
      {isLoading && <Loader2 className={`${iconSize} animate-spin`} />}
      {!isLoading && StartIcon && <StartIcon className={`${iconSize} shrink-0`} />}
      {children}
      {!isLoading && EndIcon && <EndIcon className={`${iconSize} shrink-0`} />}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
