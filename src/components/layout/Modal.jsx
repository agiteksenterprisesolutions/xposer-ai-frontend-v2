// src/components/layout/Modal.jsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Button from '../ui/Button';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  closeOnOverlayClick = true,
  showCloseButton = true,
  footer,
  className = '',
  showBackdrop = true,
  closeOnEsc = true,
}) => {
  // Close on escape key
  useEffect(() => {
    if (!closeOnEsc || !isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEsc]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    xs: 'max-w-sm',
    sm: 'max-w-md',
    medium: 'max-w-lg',
    large: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full',
  };

  const sizeClass = sizeClasses[size] || sizeClasses.medium;

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto">
      {/* Backdrop */}
      {showBackdrop && (
        <div
          className="fixed inset-0 bg-overlay backdrop-blur-sm animate-fade-in"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Modal container. Full-height flex so the panel centres on desktop and
          still scrolls when content outgrows a short viewport. */}
      <div
        className="relative flex min-h-full items-center justify-center p-4 sm:p-6"
        onClick={handleOverlayClick}
      >
        <div
          className={`w-full ${sizeClass} max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden rounded-2xl bg-surface border border-line text-left shadow-xl animate-slide-up ${className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-line-subtle shrink-0">
              {title ? (
                <h3
                  id="modal-title"
                  className="text-base sm:text-lg font-semibold text-ink tracking-[-0.01em] truncate"
                >
                  {title}
                </h3>
              ) : (
                <span />
              )}
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="shrink-0 -mr-2"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="px-5 sm:px-6 py-5 overflow-y-auto scrollbar-thin text-ink-secondary">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-5 sm:px-6 py-4 bg-subtle border-t border-line-subtle shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Confirmation Modal
export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  destructive = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={destructive ? 'danger' : variant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-secondary leading-relaxed">{message}</p>
    </Modal>
  );
};

// Fullscreen Modal
export const FullscreenModal = ({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  className = '',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-canvas overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-line px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {title && (
            <h2 className="text-lg sm:text-xl font-semibold text-ink tracking-[-0.01em] truncate">{title}</h2>
          )}
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`h-[calc(100vh-73px)] overflow-y-auto scrollbar-thin ${className}`}>
        {children}
      </div>
    </div>
  );
};

export default Modal;
