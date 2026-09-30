// src/components/forms/DynamicForm.jsx
import React, { useState, useEffect } from 'react';
import { ATTACHMENT_ACCEPT } from '../../utils/attachments';
import { useForm } from 'react-hook-form';
import {
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import Alert from '../ui/Alert';
import LoadingSpinner from '../layout/LoadingSpinner';

const DynamicForm = ({
  schema,
  initialData = {},
  onSubmit,
  onCancel,
  isLoading = false,
  isSubmitting = false,
  showProgress = true,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  enableConditionalLogic = true,
}) => {
  const [formData, setFormData] = useState({});
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [visibleFields, setVisibleFields] = useState({});

  // Initialize form data and schema
  useEffect(() => {
    if (schema) {
      // Initialize form data with defaults
      const initialFormData = {};
      schema.fields?.forEach(field => {
        initialFormData[field.name] = initialData[field.name] || field.default_value || '';
      });
      setFormData(initialFormData);

      // Initialize visible fields
      const initialVisibility = {};
      schema.fields?.forEach(field => {
        initialVisibility[field.name] = evaluateCondition(field, initialFormData);
      });
      setVisibleFields(initialVisibility);
    }
  }, [schema, initialData]);

  // Evaluate conditional logic for a field
  const evaluateCondition = (field, data) => {
    if (!field.conditional_logic || !enableConditionalLogic) {
      return true;
    }

    const { condition, field: targetField, value: targetValue, operator = 'equals' } = field.conditional_logic;

    if (condition === 'show_if' || condition === 'hide_if') {
      const fieldValue = data[targetField];

      let isConditionMet = false;
      switch (operator) {
        case 'equals':
          isConditionMet = fieldValue === targetValue;
          break;
        case 'not_equals':
          isConditionMet = fieldValue !== targetValue;
          break;
        case 'contains':
          isConditionMet = String(fieldValue).includes(targetValue);
          break;
        case 'greater_than':
          isConditionMet = Number(fieldValue) > Number(targetValue);
          break;
        case 'less_than':
          isConditionMet = Number(fieldValue) < Number(targetValue);
          break;
        case 'in':
          isConditionMet = Array.isArray(targetValue) && targetValue.includes(fieldValue);
          break;
        default:
          isConditionMet = fieldValue === targetValue;
      }

      return condition === 'show_if' ? isConditionMet : !isConditionMet;
    }

    return true;
  };

  // Handle field value change
  const handleFieldChange = (fieldName, value) => {
    const updatedData = {
      ...formData,
      [fieldName]: value
    };

    setFormData(updatedData);

    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: undefined
      }));
    }

    // Update visibility for dependent fields
    if (enableConditionalLogic) {
      const updatedVisibility = { ...visibleFields };
      schema.fields?.forEach(field => {
        if (field.conditional_logic?.field === fieldName) {
          updatedVisibility[field.name] = evaluateCondition(field, updatedData);
        }
      });
      setVisibleFields(updatedVisibility);
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    schema.fields?.forEach(field => {
      if (field.required && visibleFields[field.name]) {
        const value = formData[field.name];

        if (value === undefined || value === null || value === '' ||
          (Array.isArray(value) && value.length === 0)) {
          newErrors[field.name] = `${field.label} is required`;
        }
      }

      // Type-specific validation
      if (formData[field.name] && visibleFields[field.name]) {
        switch (field.type) {
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData[field.name])) {
              newErrors[field.name] = 'Invalid email address';
            }
            break;

          case 'number':
            if (isNaN(Number(formData[field.name]))) {
              newErrors[field.name] = 'Must be a number';
            } else if (field.validation?.min && Number(formData[field.name]) < field.validation.min) {
              newErrors[field.name] = `Minimum value is ${field.validation.min}`;
            } else if (field.validation?.max && Number(formData[field.name]) > field.validation.max) {
              newErrors[field.name] = `Maximum value is ${field.validation.max}`;
            }
            break;

          case 'phone':
            const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
            if (!phoneRegex.test(formData[field.name])) {
              newErrors[field.name] = 'Invalid phone number';
            }
            break;

          case 'url':
            try {
              new URL(formData[field.name]);
            } catch {
              newErrors[field.name] = 'Invalid URL';
            }
            break;
        }

        // Length validation
        if (field.validation?.min_length &&
          String(formData[field.name]).length < field.validation.min_length) {
          newErrors[field.name] = `Minimum ${field.validation.min_length} characters required`;
        }

        if (field.validation?.max_length &&
          String(formData[field.name]).length > field.validation.max_length) {
          newErrors[field.name] = `Maximum ${field.validation.max_length} characters allowed`;
        }

        // Pattern validation
        if (field.validation?.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(formData[field.name])) {
            newErrors[field.name] = field.validation.pattern_message || 'Invalid format';
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Prepare data for submission
    const submissionData = { ...formData };

    // Remove fields that are not visible
    Object.keys(submissionData).forEach(fieldName => {
      if (!visibleFields[fieldName]) {
        delete submissionData[fieldName];
      }
    });

    await onSubmit(submissionData);
  };

  // Render field based on type
  const renderField = (field) => {
    if (!visibleFields[field.name]) {
      return null;
    }

    const value = formData[field.name] || field.default_value || '';
    const error = errors[field.name];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
      case 'url':
      case 'password':
      case 'date':
      case 'datetime-local':
        return (
          <Input
            key={field.name}
            label={field.label}
            type={field.type}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            error={error}
            helperText={field.help_text}
            required={field.required}
            placeholder={field.placeholder}
            disabled={field.readonly}
            className="mt-1"
          />
        );

      case 'textarea':
        return (
          <Textarea
            key={field.name}
            label={field.label}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            error={error}
            helperText={field.help_text}
            required={field.required}
            placeholder={field.placeholder}
            rows={field.rows || 4}
            disabled={field.readonly}
            className="mt-1"
          />
        );

      case 'select':
        return (
          <Select
            key={field.name}
            label={field.label}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            error={error}
            helperText={field.help_text}
            required={field.required}
            options={field.options?.map(opt => ({
              value: opt.value || opt,
              label: opt.label || opt
            })) || []}
            disabled={field.readonly}
            className="mt-1"
          />
        );

      case 'multiselect':
        return (
          <div key={field.name} className="space-y-2">
            <label className="block text-sm font-medium text-ink-secondary">
              {field.label}
              {field.required && <span className="text-danger-fg ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map((option, index) => (
                <label key={index} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={Array.isArray(value) && value.includes(option.value || option)}
                    onChange={(e) => {
                      const newValue = Array.isArray(value) ? [...value] : [];
                      const optionValue = option.value || option;

                      if (e.target.checked) {
                        newValue.push(optionValue);
                      } else {
                        const optionIndex = newValue.indexOf(optionValue);
                        if (optionIndex > -1) {
                          newValue.splice(optionIndex, 1);
                        }
                      }
                      handleFieldChange(field.name, newValue);
                    }}
                    className="rounded border-line-strong text-accent-fg focus:ring-accent-ring"
                    disabled={field.readonly}
                  />
                  <span className="ml-2 text-sm text-ink-secondary">
                    {option.label || option}
                  </span>
                </label>
              ))}
            </div>
            {error && (
              <p className="mt-1 text-sm text-danger-fg">{error}</p>
            )}
            {field.help_text && (
              <p className="mt-1 text-sm text-ink-muted">{field.help_text}</p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div key={field.name} className="space-y-2">
            <label className="block text-sm font-medium text-ink-secondary">
              {field.label}
              {field.required && <span className="text-danger-fg ml-1">*</span>}
            </label>
            <div className="space-y-2">
              {field.options?.map((option, index) => (
                <label key={index} className="flex items-center">
                  <input
                    type="radio"
                    name={field.name}
                    value={option.value || option}
                    checked={value === (option.value || option)}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="h-4 w-4 border-line-strong text-accent-fg focus:ring-accent-ring"
                    disabled={field.readonly}
                  />
                  <span className="ml-2 text-sm text-ink-secondary">
                    {option.label || option}
                  </span>
                </label>
              ))}
            </div>
            {error && (
              <p className="mt-1 text-sm text-danger-fg">{error}</p>
            )}
            {field.help_text && (
              <p className="mt-1 text-sm text-ink-muted">{field.help_text}</p>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.name} className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={value === true}
                onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                className="rounded border-line-strong text-accent-fg focus:ring-accent-ring"
                disabled={field.readonly}
              />
              <span className="ml-2 text-sm font-medium text-ink-secondary">
                {field.label}
                {field.required && <span className="text-danger-fg ml-1">*</span>}
              </span>
            </label>
            {error && (
              <p className="mt-1 text-sm text-danger-fg">{error}</p>
            )}
            {field.help_text && (
              <p className="mt-1 text-sm text-ink-muted">{field.help_text}</p>
            )}
          </div>
        );

      case 'file':
        return (
          <div key={field.name} className="space-y-2">
            <label className="block text-sm font-medium text-ink-secondary">
              {field.label}
              {field.required && <span className="text-danger-fg ml-1">*</span>}
            </label>
            <input
              type="file"
              onChange={(e) => handleFieldChange(field.name, e.target.files[0])}
              className="block w-full text-sm text-ink-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent-soft file:text-accent-fg hover:file:bg-accent-soft"
              accept={field.accept || ATTACHMENT_ACCEPT}
              multiple={field.multiple}
              disabled={field.readonly}
            />
            {error && (
              <p className="mt-1 text-sm text-danger-fg">{error}</p>
            )}
            {field.help_text && (
              <p className="mt-1 text-sm text-ink-muted">{field.help_text}</p>
            )}
          </div>
        );

      case 'range':
        return (
          <div key={field.name} className="space-y-2">
            <label className="block text-sm font-medium text-ink-secondary">
              {field.label}: {value}
              {field.required && <span className="text-danger-fg ml-1">*</span>}
            </label>
            <input
              type="range"
              min={field.validation?.min || 0}
              max={field.validation?.max || 100}
              step={field.step || 1}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              className="w-full h-2 bg-active rounded-lg appearance-none cursor-pointer"
              disabled={field.readonly}
            />
            <div className="flex justify-between text-xs text-ink-muted">
              <span>{field.validation?.min || 0}</span>
              <span>{field.validation?.max || 100}</span>
            </div>
            {error && (
              <p className="mt-1 text-sm text-danger-fg">{error}</p>
            )}
            {field.help_text && (
              <p className="mt-1 text-sm text-ink-muted">{field.help_text}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={field.name} className="text-sm text-ink-muted">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  // Get fields for current step
  const getCurrentStepFields = () => {
    if (!schema.steps) {
      return schema.fields || [];
    }

    const step = schema.steps[currentStep];
    return step.fields || [];
  };

  // Navigate to next step
  const nextStep = () => {
    if (currentStep < (schema.steps?.length || 1) - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Navigate to previous step
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!schema) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-ink-subtle mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-ink mb-2">
          No Form Schema
        </h3>
        <p className="text-ink-muted">
          The form configuration could not be loaded.
        </p>
      </div>
    );
  }

  const isMultiStep = schema.steps && schema.steps.length > 1;
  const currentFields = isMultiStep ? getCurrentStepFields() : schema.fields || [];
  const totalSteps = schema.steps?.length || 1;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <Card>
      {/* Form header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.02em]">
          {schema.title || 'Form'}
        </h2>
        {schema.description && (
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">{schema.description}</p>
        )}
      </div>

      {/* Progress indicator for multi-step forms */}
      {showProgress && isMultiStep && (
        <div className="mb-8">
          {/* A bar carries the overall position; the labelled pips scroll
              sideways rather than compressing on narrow screens */}
          <div className="w-full bg-subtle rounded-full h-1.5 overflow-hidden mb-4">
            <div
              className="bg-accent h-full rounded-full transition-[width] duration-300 ease-out-xp"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
            {schema.steps.map((step, index) => {
              const isDone = index < currentStep;
              const isCurrent = index === currentStep;
              return (
                <div
                  key={index}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    isCurrent
                      ? 'border-line-accent bg-accent-soft text-accent-fg'
                      : isDone
                        ? 'border-success-line bg-success-soft text-success-fg'
                        : 'border-line bg-subtle text-ink-subtle'
                  }`}
                >
                  <span className="tabular-nums">{index + 1}</span>
                  <span className="whitespace-nowrap">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step title for multi-step forms */}
      {isMultiStep && schema.steps[currentStep]?.title && (
        <h3 className="text-lg font-semibold text-ink mb-4">
          {schema.steps[currentStep].title}
        </h3>
      )}

      {/* Step description for multi-step forms */}
      {isMultiStep && schema.steps[currentStep]?.description && (
        <p className="text-ink-muted mb-6">{schema.steps[currentStep].description}</p>
      )}

      {/* Form fields */}
      <div className="space-y-6">
        {currentFields.map(field => (
          <div key={field.name}>
            {renderField(field)}
          </div>
        ))}
      </div>

      {/* Form actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mt-8 pt-6 border-t border-line">
        <div>
          {isMultiStep && (
            <p className="text-sm text-ink-muted">
              Step {currentStep + 1} of {totalSteps}
            </p>
          )}
        </div>

        {/* Reversed on mobile so the primary action sits at the top of the stack */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              {cancelLabel}
            </Button>
          )}

          {isMultiStep && currentStep > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={prevStep}
              disabled={isSubmitting}
              startIcon={ChevronLeft}
            >
              Previous
            </Button>
          )}

          {isMultiStep && !isLastStep ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={isSubmitting}
              endIcon={ChevronRight}
            >
              Next
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
              startIcon={Save}
            >
              {submitLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Help text */}
      <div className="mt-6 pt-6 border-t border-line">
        <div className="flex items-start">
          <HelpCircle className="w-5 h-5 text-ink-subtle mt-0.5 mr-2" />
          <div>
            <p className="text-sm text-ink-muted">
              All fields marked with <span className="text-danger-fg">*</span> are required.
              Your information is secure and encrypted.
            </p>
            {schema.help_text && (
              <p className="text-sm text-ink-muted mt-1">
                {schema.help_text}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default DynamicForm;
