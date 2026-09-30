// src/components/layout/LoadingSpinner.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({
  message = 'Loading...',
  fullScreen = false,
  size = 'medium',
  className = '',
}) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12',
    xlarge: 'h-16 w-16',
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.medium;

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas">
        <div className="text-center">
          <Loader2 className={`${spinnerSize} text-accent-fg animate-spin mx-auto`} />
          {message && (
            <p className="mt-4 text-sm text-ink-muted">{message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center">
        <Loader2 className={`${spinnerSize} text-accent-fg animate-spin`} />
        {message && (
          <p className="mt-2 text-sm text-ink-muted">{message}</p>
        )}
      </div>
    </div>
  );
};

// Loading overlay for components
export const LoadingOverlay = ({
  isLoading,
  message = 'Loading...',
  children,
  className = '',
}) => {
  if (!isLoading) return children;

  return (
    <div className={`relative ${className}`}>
      {children}
      {/* bg-overlay is an alpha token — a /opacity modifier would be dropped,
          since Tailwind can't resolve a var() into a color-mix at build time */}
      <div className="absolute inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center rounded-xl">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-accent-fg animate-spin mx-auto" />
          {message && (
            <p className="mt-2 text-sm text-ink-muted">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
};

// Page loading spinner
export const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-canvas">
    <div className="text-center px-6">
      <Loader2 className="h-12 w-12 text-accent-fg animate-spin mx-auto" />
      <p className="mt-4 text-lg font-semibold text-ink tracking-[-0.01em]">
        Loading Xposer...
      </p>
      <p className="mt-1.5 text-sm text-ink-muted">
        Please wait while we load your secure dashboard
      </p>
    </div>
  </div>
);

// Skeleton loading components
export const Skeleton = ({
  className = '',
  variant = 'text',
  width = 'full',
  height = 'auto',
}) => {
  const widthClasses = {
    full: 'w-full',
    half: 'w-1/2',
    quarter: 'w-1/4',
    auto: 'w-auto',
  };

  const heightClasses = {
    auto: 'h-auto',
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6',
    xl: 'h-8',
  };

  const widthClass = widthClasses[width] || 'w-full';
  const heightClass = heightClasses[height] || 'h-4';

  if (variant === 'circle') {
    return (
      <div className={`animate-pulse rounded-full bg-active ${className}`} />
    );
  }

  if (variant === 'rectangle') {
    return (
      <div className={`animate-pulse rounded-lg bg-active ${widthClass} ${heightClass} ${className}`} />
    );
  }

  // Default text skeleton
  return (
    <div className={`animate-pulse rounded bg-active ${widthClass} ${heightClass} ${className}`} />
  );
};

// Skeleton for cards
export const CardSkeleton = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-surface rounded-xl shadow-sm border border-line p-5 sm:p-6 animate-pulse">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="h-4 bg-active rounded w-3/4 mb-4" />
              <div className="space-y-3">
                <div className="h-3 bg-active rounded w-full" />
                <div className="h-3 bg-active rounded w-5/6" />
                <div className="h-3 bg-active rounded w-4/6" />
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-between items-center">
            <div className="h-4 bg-active rounded w-1/4" />
            <div className="h-8 bg-active rounded w-1/4" />
          </div>
        </div>
      ))}
    </>
  );
};

// Skeleton for table rows
export const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse border-b border-line-subtle last:border-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3.5 sm:px-5">
              <div className={`h-4 bg-active rounded ${colIndex === columns - 1 ? 'w-20' : 'w-full'}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default LoadingSpinner;
