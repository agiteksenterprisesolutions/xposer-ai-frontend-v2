// src/components/ui/Input.jsx
import { forwardRef, useId } from 'react';

// ─── Shared style tokens ────────────────────────────────────────────────────
// Every color resolves through App.css, so the controls follow the active
// theme without any per-theme branching here.
const tokens = {
  fieldWrap: 'relative group',
  // The <input> / <textarea> / <select> itself
  control: [
    'peer w-full bg-subtle',
    'border border-line rounded-lg',
    'text-ink placeholder-ink-subtle',
    'transition-[border-color,box-shadow,background-color] duration-200 ease-out-xp',
    'outline-none',
    'hover:border-line-strong',
    'focus:border-line-accent focus:ring-2 focus:ring-accent-ring',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-sunken',
    'read-only:bg-sunken read-only:cursor-default',
  ].join(' '),
  // Floating label — rides up when the control is focused or filled
  label: [
    'absolute left-3 top-1/2 -translate-y-1/2',
    'text-ink-subtle font-medium pointer-events-none select-none',
    'transition-all duration-200 ease-out-xp origin-left',
    'peer-focus:top-[9px] peer-focus:text-[10px] peer-focus:tracking-[0.03em] peer-focus:text-accent-fg peer-focus:translate-y-0',
    'peer-[&:not(:placeholder-shown)]:top-[9px] peer-[&:not(:placeholder-shown)]:text-[10px] peer-[&:not(:placeholder-shown)]:tracking-[0.03em] peer-[&:not(:placeholder-shown)]:translate-y-0 peer-[&:not(:placeholder-shown)]:text-ink-subtle',
  ].join(' '),
  // A field with its own placeholder has nowhere to rest the label: both
  // would sit on the same line. The label stays raised and the placeholder
  // shows beneath it.
  labelRaised: [
    'absolute left-3 top-[9px] text-[10px] tracking-[0.03em]',
    'text-ink-subtle font-medium pointer-events-none select-none',
    'transition-colors duration-200 ease-out-xp',
    'peer-focus:text-accent-fg',
  ].join(' '),
  asterisk: 'text-danger-fg ml-0.5',
  hint: 'mt-1.5 text-xs pl-1',
};

// Padding accounts for the floating label. text-base on mobile stops iOS
// from zooming the viewport when a field takes focus.
const sizePadding = {
  small: 'pt-5 pb-1.5 px-3 text-base sm:text-sm',
  medium: 'pt-6 pb-2 px-3 text-base sm:text-sm',
  large: 'pt-7 pb-3 px-4 text-base',
};

/** True when the caller passed placeholder text worth showing. */
const hasText = (placeholder) => typeof placeholder === 'string' && placeholder.trim() !== '';

const labelSize = {
  small: 'text-base sm:text-xs',
  medium: 'text-base sm:text-sm',
  large: 'text-base sm:text-sm',
};

// ─── Input ───────────────────────────────────────────────────────────────────
const Input = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  readOnly = false,
  className = '',
  containerClassName = '',
  startAdornment,
  endAdornment,
  fullWidth = true,
  size = 'medium',
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}, ref) => {
  const id = useId();
  const isNonNegativeNumber = props.type === 'number' && Number(props.min) >= 0;
  const isPickerOnlyType = props.type === 'date' || props.type === 'datetime-local';
  const raiseLabel = hasText(props.placeholder);

  const errorRing = error
    ? 'border-danger-line focus:border-danger-solid focus:ring-danger-soft hover:border-danger-solid'
    : '';
  const errorLabel = error
    ? 'text-danger-fg peer-focus:text-danger-fg peer-[&:not(:placeholder-shown)]:text-danger-fg'
    : '';

  const handleFocus = (event) => {
    onFocus?.(event);
  };

  const handleBlur = (event) => {
    onBlur?.(event);
  };

  const handleKeyDown = (event) => {
    if (isNonNegativeNumber && ['-', 'e', 'E'].includes(event.key)) {
      event.preventDefault();
    }
    if (isPickerOnlyType && event.key.length === 1) {
      event.preventDefault();
    }
    onKeyDown?.(event);
  };

  return (
    <div className={`${fullWidth ? 'w-full' : 'inline-block'} ${containerClassName}`}>
      <div className={tokens.fieldWrap}>
        {startAdornment && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none z-10 text-sm">
            {startAdornment}
          </span>
        )}

        <input
          id={id}
          ref={ref}
          disabled={disabled}
          readOnly={readOnly}
          placeholder=" "
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-invalid={error ? 'true' : undefined}
          className={[
            tokens.control,
            sizePadding[size] || sizePadding.medium,
            errorRing,
            startAdornment ? 'pl-9' : '',
            endAdornment ? 'pr-9' : '',
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        />

        {label && (
          <label
            htmlFor={id}
            className={[
              raiseLabel ? tokens.labelRaised : tokens.label,
              raiseLabel ? '' : labelSize[size] || labelSize.medium,
              errorLabel,
              startAdornment ? 'left-9' : '',
            ].filter(Boolean).join(' ')}
          >
            {label}
            {required && <span className={tokens.asterisk}>*</span>}
          </label>
        )}

        {endAdornment && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle z-10 text-sm">
            {endAdornment}
          </span>
        )}
      </div>

      {(error || helperText) && (
        <p className={`${tokens.hint} ${error ? 'text-danger-fg' : 'text-ink-subtle'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// ─── Textarea ────────────────────────────────────────────────────────────────
export const Textarea = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  readOnly = false,
  className = '',
  containerClassName = '',
  rows = 4,
  fullWidth = true,
  ...props
}, ref) => {
  const id = useId();
  const errorRing = error
    ? 'border-danger-line focus:border-danger-solid focus:ring-danger-soft hover:border-danger-solid'
    : '';
  const errorLabel = error ? 'text-danger-fg peer-focus:text-danger-fg' : '';
  const raiseLabel = hasText(props.placeholder);

  return (
    <div className={`${fullWidth ? 'w-full' : 'inline-block'} ${containerClassName}`}>
      <div className="relative group">
        <textarea
          id={id}
          ref={ref}
          disabled={disabled}
          readOnly={readOnly}
          rows={rows}
          placeholder=" "
          aria-invalid={error ? 'true' : undefined}
          className={[
            'peer w-full bg-subtle',
            'border border-line rounded-lg',
            'pt-6 pb-2 px-3 text-base sm:text-sm text-ink',
            raiseLabel ? 'placeholder-ink-subtle' : 'placeholder-transparent',
            'transition-[border-color,box-shadow,background-color] duration-200 ease-out-xp outline-none resize-y',
            'hover:border-line-strong',
            'focus:border-line-accent focus:ring-2 focus:ring-accent-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-sunken',
            'read-only:bg-sunken',
            errorRing,
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        />

        {label && (
          <label
            htmlFor={id}
            className={[
              ...(raiseLabel
                ? ['absolute left-3 top-2.5 text-[10px] tracking-[0.03em]',
                  'text-ink-subtle font-medium pointer-events-none select-none',
                  'transition-colors duration-200 ease-out-xp',
                  'peer-focus:text-accent-fg']
                : ['absolute left-3 top-4',
                  'text-base sm:text-sm text-ink-subtle font-medium pointer-events-none select-none',
                  'transition-all duration-200 ease-out-xp origin-left',
                  'peer-focus:top-2.5 peer-focus:text-[10px] peer-focus:tracking-[0.03em] peer-focus:text-accent-fg',
                  'peer-not-placeholder-shown:top-2.5 peer-not-placeholder-shown:text-[10px] peer-not-placeholder-shown:tracking-[0.03em] peer-not-placeholder-shown:text-ink-subtle']),
              errorLabel,
            ].filter(Boolean).join(' ')}
          >
            {label}
            {required && <span className={tokens.asterisk}>*</span>}
          </label>
        )}
      </div>

      {(error || helperText) && (
        <p className={`${tokens.hint} ${error ? 'text-danger-fg' : 'text-ink-subtle'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

// ─── Select ──────────────────────────────────────────────────────────────────
export const Select = forwardRef(({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  options = [],
  placeholder = 'Select an option',
  className = '',
  containerClassName = '',
  fullWidth = true,
  children,
  ...props
}, ref) => {
  const id = useId();
  const errorRing = error
    ? 'border-danger-line focus:border-danger-solid focus:ring-danger-soft hover:border-danger-solid'
    : '';

  return (
    <div className={`${fullWidth ? 'w-full' : 'inline-block'} ${containerClassName}`}>
      <div className="relative group">
        {/* Custom chevron — the native one can't be themed */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle z-10">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>

        <select
          id={id}
          ref={ref}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          className={[
            'w-full appearance-none bg-subtle',
            'border border-line rounded-lg',
            label ? 'pt-6 pb-2 px-3' : 'py-2.5 px-3',
            'text-base sm:text-sm text-ink',
            'transition-[border-color,box-shadow,background-color] duration-200 ease-out-xp outline-none',
            'hover:border-line-strong',
            'focus:border-line-accent focus:ring-2 focus:ring-accent-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-sunken',
            'pr-9 cursor-pointer',
            errorRing,
            className,
          ].filter(Boolean).join(' ')}
          {...props}
        >
          {/* Callers may pass their own <option> set instead of `options` */}
          {children || (
            <>
              <option value="">{placeholder}</option>
              {options.map((option, index) => {
                let optionValue, optionLabel;
                if (typeof option === 'string') {
                  optionValue = option; optionLabel = option;
                } else if (typeof option === 'object' && option !== null) {
                  optionValue = option.value !== undefined ? option.value : option;
                  optionLabel = option.label !== undefined ? option.label : optionValue;
                } else {
                  optionValue = String(option); optionLabel = String(option);
                }
                return <option key={index} value={optionValue}>{optionLabel}</option>;
              })}
            </>
          )}
        </select>

        {label && (
          <label
            htmlFor={id}
            className="absolute left-3 top-2 text-[10px] tracking-[0.03em] text-ink-subtle font-medium pointer-events-none"
          >
            {label}
            {required && <span className={tokens.asterisk}>*</span>}
          </label>
        )}
      </div>

      {(error || helperText) && (
        <p className={`${tokens.hint} ${error ? 'text-danger-fg' : 'text-ink-subtle'}`}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Input;
