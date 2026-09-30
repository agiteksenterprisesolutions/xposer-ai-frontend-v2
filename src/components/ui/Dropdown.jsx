// src/components/ui/Dropdown.jsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const Dropdown = ({
  children,
  trigger,
  align = 'left',
  width = 'auto',
  className = '',
  triggerClassName = '',
  contentClassName = '',
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    if (onOpenChange) {
      onOpenChange(newOpen);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        handleOpenChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const alignClasses = {
    left: 'left-0',
    right: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  };

  const widthClasses = {
    auto: 'min-w-44 w-max',
    sm: 'w-32',
    md: 'w-56',
    lg: 'w-64',
    full: 'w-full',
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={triggerClassName}
        onClick={() => handleOpenChange(!open)}
      >
        {trigger}
      </div>

      {open && (
        <div
          className={`absolute z-50 mt-2 ${alignClasses[align]} ${widthClasses[width]} max-w-[calc(100vw-1.5rem)] origin-top rounded-xl border border-line bg-surface shadow-lg overflow-hidden animate-slide-down ${contentClassName}`}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1.5">
            {React.Children.map(children, (child) => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, {
                  onClick: () => {
                    child.props.onClick?.();
                    handleOpenChange(false);
                  },
                });
              }
              return child;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const DropdownItem = ({
  children,
  onClick,
  className = '',
  disabled = false,
  ...props
}) => (
  <button
    type="button"
    className={`flex w-full items-center gap-2 text-left px-3.5 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover hover:text-ink focus:outline-none focus-visible:bg-hover disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    onClick={onClick}
    disabled={disabled}
    role="menuitem"
    {...props}
  >
    {children}
  </button>
);

const DropdownDivider = ({ className = '' }) => (
  <hr className={`my-1.5 border-0 border-t border-line-subtle ${className}`} />
);

const DropdownLabel = ({ children, className = '' }) => (
  <div className={`px-3.5 py-2 text-[10px] font-semibold text-ink-subtle uppercase tracking-[0.05em] ${className}`}>
    {children}
  </div>
);

// Pre-styled dropdown trigger
export const DropdownTrigger = ({
  children,
  className = '',
  showChevron = true,
  ...props
}) => (
  <button
    type="button"
    className={`inline-flex items-center justify-between gap-2 w-full h-10 px-3.5 text-sm font-medium text-ink bg-subtle border border-line rounded-lg transition-colors hover:bg-hover hover:border-line-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${className}`}
    {...props}
  >
    <span className="truncate">{children}</span>
    {showChevron && <ChevronDown className="w-4 h-4 shrink-0 text-ink-subtle" />}
  </button>
);

Dropdown.Item = DropdownItem;
Dropdown.Divider = DropdownDivider;
Dropdown.Label = DropdownLabel;

export default Dropdown;
