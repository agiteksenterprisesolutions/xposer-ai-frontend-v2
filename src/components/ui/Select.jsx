// src/components/ui/Select.jsx
import React from 'react';

const Select = ({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-ink-secondary">
          {label}
          {required && <span className="text-danger-fg ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Custom chevron — the native arrow can't follow the theme */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>

        <select
          value={value || ''}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          className={[
            'block w-full appearance-none h-10 pl-3 pr-9 rounded-lg border',
            'bg-subtle text-ink text-base sm:text-sm cursor-pointer',
            'transition-[border-color,box-shadow,background-color] duration-200 ease-out-xp outline-none',
            'focus:ring-2 focus:ring-accent-ring',
            error
              ? 'border-danger-line focus:border-danger-solid hover:border-danger-solid'
              : 'border-line hover:border-line-strong focus:border-line-accent',
            disabled ? 'opacity-50 cursor-not-allowed bg-sunken' : '',
          ].filter(Boolean).join(' ')}
          {...props}
        >
          <option value="" disabled={required}>
            {placeholder}
          </option>
          {options.map((option, index) => {
            // Handle both string and object options
            let optionValue, optionLabel;

            if (typeof option === 'object' && option !== null) {
              optionValue = option.value !== undefined ? option.value : option;
              optionLabel = option.label !== undefined ? option.label : optionValue;
            } else {
              optionValue = option;
              optionLabel = option;
            }

            return (
              <option
                key={index}
                value={optionValue}
              >
                {optionLabel}
              </option>
            );
          })}
        </select>
      </div>

      {error && (
        <p className="text-xs text-danger-fg pl-1">{error}</p>
      )}

      {helperText && !error && (
        <p className="text-xs text-ink-subtle pl-1">{helperText}</p>
      )}
    </div>
  );
};

export default Select;
