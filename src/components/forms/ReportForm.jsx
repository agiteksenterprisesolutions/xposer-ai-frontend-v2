import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Upload,
  Lock,
  Mail,
  Phone,
  FileText,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { reportTypesAPI } from '../../api/reportTypes';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input, { Textarea, Select } from '../ui/Input';
import { validateReportFormData } from '../../utils/validators';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_HINT,
  validateAttachments,
} from '../../utils/attachments';

const ReportForm = ({
  onSubmit,
  initialData = {},
  isLoading = false,
  isAnonymous = false,
  showPreview = false,
}) => {
  const { user, isAuthenticated } = useAuthStore();
  const [reportTypes, setReportTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [showAnonymousFields, setShowAnonymousFields] = useState(isAnonymous);

  // Fetch report types
  useEffect(() => {
    const fetchReportTypes = async () => {
      try {
        const types = await reportTypesAPI.getReportTypes(true);
        setReportTypes(types);
      } catch (error) {
        console.error('Failed to fetch report types:', error);
      }
    };

    fetchReportTypes();
  }, []);

  // Load initial data
  useEffect(() => {
    if (initialData.report_type_id) {
      const type = reportTypes.find(t => t.id === initialData.report_type_id);
      if (type) {
        setSelectedType(type);
      }
    }
    if (initialData.form_data) {
      setFormData(initialData.form_data);
    }
  }, [initialData, reportTypes]);

  // Schema for basic info
  const basicInfoSchema = z.object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
    description: z.string().min(20, 'Description must be at least 20 characters').max(5000, 'Description too long'),
    report_type_id: z.string().min(1, 'Please select a report type'),
  });

  const {
    register: registerBasic,
    handleSubmit: handleBasicSubmit,
    formState: { errors: basicErrors },
    watch: watchBasic,
    setValue,
    trigger,
  } = useForm({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      title: initialData.title || '',
      description: initialData.description || '',
      report_type_id: initialData.report_type_id || '',
    },
    shouldUnregister: false,
  });

  // Handle report type selection
  const handleTypeSelect = (typeId) => {
    const type = reportTypes.find(t => t.id === typeId);
    setSelectedType(type);
    setValue('report_type_id', typeId, { shouldValidate: true });
    setFormData({});
  };

  // Handle dynamic form field changes
  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: undefined
      }));
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    // The picker filter is only a hint, so the batch is re-checked against the
    // shared evidence policy — type, size and the ten-file ceiling.
    const { valid, errors } = validateAttachments(
      Array.from(e.target.files),
      attachments.length,
    );
    if (errors.length > 0) toast.error(errors[0]);
    e.target.value = '';
    if (valid.length === 0) return;

    const newAttachments = valid.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
  };

  // Remove attachment
  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Validate dynamic form
  const validateDynamicForm = () => {
    if (!selectedType) return false;

    const validation = validateReportFormData(formData, selectedType.questions);
    setErrors(validation.errors);
    return validation.isValid;
  };

  // Handle form submission
  const handleSubmit = async (basicData) => {
    try {
      // Validate dynamic form if we're on step 2
      if (step === 2 && !validateDynamicForm()) {
        return;
      }

      // Prepare submission data
      const submissionData = {
        ...basicData,
        form_data: formData,
        is_anonymous: showAnonymousFields,
        attachments: attachments.map(a => a.file),
      };

      // Add reporter info if logged in and not anonymous
      if (isAuthenticated && user && !showAnonymousFields) {
        submissionData.reporter_id = user.id;
      }

      // Call onSubmit callback
      await onSubmit(submissionData);

      // Reset form
      setStep(1);
      setSelectedType(null);
      setFormData({});
      setAttachments([]);
      setErrors({});

    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  // Render dynamic form fields based on selected report type
  const renderDynamicFields = () => {
    if (!selectedType || !selectedType.questions) {
      return null;
    }

    return (
      <div className="space-y-6">
        {selectedType.questions.map((question, index) => {
          const value = formData[question.name] || question.default_value || '';
          const error = errors[question.name];

          switch (question.type) {
            case 'text':
            case 'email':
            case 'phone':
            case 'number':
              return (
                <Input
                  key={index}
                  label={question.label}
                  type={question.type === 'phone' ? 'tel' : question.type}
                  value={value}
                  title={question.type === 'phone' ? 'Write phone number including country code and without + symbol (e.g., 251912345678)' : ''}
                  onChange={(e) => handleFieldChange(question.name, e.target.value)}
                  error={error}
                  helperText={question.help_text}
                  required={question.required}
                  placeholder={question.placeholder}
                  className="mt-1"
                />
              );

            case 'textarea':
              return (
                <Textarea
                  key={index}
                  label={question.label}
                  value={value}
                  onChange={(e) => handleFieldChange(question.name, e.target.value)}
                  error={error}
                  helperText={question.help_text}
                  required={question.required}
                  placeholder={question.placeholder}
                  rows={4}
                  className="mt-1"
                />
              );

            case 'select':
              return (
                <Select
                  key={index}
                  label={question.label}
                  value={value}
                  onChange={(e) => handleFieldChange(question.name, e.target.value)}
                  error={error}
                  helperText={question.help_text}
                  required={question.required}
                  options={question.options?.map(opt => ({
                    value: opt,
                    label: opt
                  })) || []}
                  className="mt-1"
                />
              );

            case 'multiselect':
              return (
                <div key={index} className="space-y-2">
                  <label className="block text-sm font-medium text-ink-secondary">
                    {question.label}
                    {question.required && <span className="text-danger-fg ml-1">*</span>}
                  </label>
                  <div className="space-y-2">
                    {question.options?.map((option, optIndex) => (
                      <label key={optIndex} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={Array.isArray(value) && value.includes(option)}
                          onChange={(e) => {
                            const newValue = Array.isArray(value) ? [...value] : [];
                            if (e.target.checked) {
                              newValue.push(option);
                            } else {
                              const index = newValue.indexOf(option);
                              if (index > -1) {
                                newValue.splice(index, 1);
                              }
                            }
                            handleFieldChange(question.name, newValue);
                          }}
                          className="rounded border-line-strong text-accent-fg focus:ring-accent-ring"
                        />
                        <span className="ml-2 text-sm text-ink-secondary">{option}</span>
                      </label>
                    ))}
                  </div>
                  {error && (
                    <p className="mt-1 text-sm text-danger-fg">{error}</p>
                  )}
                  {question.help_text && (
                    <p className="mt-1 text-sm text-ink-muted">{question.help_text}</p>
                  )}
                </div>
              );

            case 'date':
            case 'datetime':
              return (
                <Input
                  key={index}
                  label={question.label}
                  type={question.type === 'datetime' ? 'datetime-local' : 'date'}
                  value={value}
                  onChange={(e) => handleFieldChange(question.name, e.target.value)}
                  error={error}
                  helperText={question.help_text}
                  required={question.required}
                  className="mt-1"
                />
              );

            case 'boolean':
              return (
                <div key={index} className="space-y-2">
                  <label className="block text-sm font-medium text-ink-secondary">
                    {question.label}
                    {question.required && <span className="text-danger-fg ml-1">*</span>}
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={question.name}
                        checked={value === true}
                        onChange={() => handleFieldChange(question.name, true)}
                        className="h-4 w-4 border-line-strong text-accent-fg focus:ring-accent-ring"
                      />
                      <span className="ml-2 text-sm text-ink-secondary">Yes</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={question.name}
                        checked={value === false}
                        onChange={() => handleFieldChange(question.name, false)}
                        className="h-4 w-4 border-line-strong text-accent-fg focus:ring-accent-ring"
                      />
                      <span className="ml-2 text-sm text-ink-secondary">No</span>
                    </label>
                  </div>
                  {error && (
                    <p className="mt-1 text-sm text-danger-fg">{error}</p>
                  )}
                  {question.help_text && (
                    <p className="mt-1 text-sm text-ink-muted">{question.help_text}</p>
                  )}
                </div>
              );

            default:
              return null;
          }
        })}
      </div>
    );
  };

  // Render step 1: Basic information
  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-ink mb-4">
          What would you like to report?
        </h3>
        <p className="text-sm text-ink-muted mb-6">
          Please provide basic information about your concern. All information is kept confidential.
        </p>
      </div>

      <Input
        label="Report Title"
        placeholder="Brief summary of your concern"
        {...registerBasic('title')}
        error={basicErrors.title?.message}
        required
      />

      <Textarea
        label="Detailed Description"
        placeholder="Please provide a detailed description of what happened, including dates, times, locations, and people involved."
        rows={6}
        {...registerBasic('description')}
        error={basicErrors.description?.message}
        required
      />

      <div>
        <label className="block text-sm font-medium text-ink-secondary mb-2">
          Report Type <span className="text-danger-fg">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reportTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => handleTypeSelect(type.id)}
              className={`p-4 text-left rounded-lg border-2 transition-all ${watchBasic('report_type_id') === type.id
                ? 'border-line-accent bg-accent-soft'
                : 'border-line hover:border-line-strong hover:bg-subtle'
                }`}
            >
              <h4 className="font-medium text-ink mb-1">{type.name}</h4>
              {type.description && (
                <p className="text-sm text-ink-muted">{type.description}</p>
              )}
            </button>
          ))}
        </div>
        {basicErrors.report_type_id && (
          <p className="mt-1 text-sm text-danger-fg">
            {basicErrors.report_type_id.message}
          </p>
        )}
      </div>

      {/* Anonymous reporting toggle */}
      {!isAuthenticated && (
        <div className="pt-4 border-t border-line">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showAnonymousFields}
              onChange={(e) => setShowAnonymousFields(e.target.checked)}
              className="rounded border-line-strong text-accent-fg focus:ring-accent-ring"
            />
            <span className="ml-2 text-sm text-ink-secondary">
              Submit anonymously (no account required)
            </span>
          </label>
          {showAnonymousFields && (
            <div className="mt-3 p-3 bg-warning-soft rounded-lg border border-warning-line">
              <div className="flex items-start">
                <Lock className="w-5 h-5 text-warning-fg mt-0.5 mr-2" />
                <div>
                  <p className="text-sm font-medium text-warning-fg">
                    Anonymous Reporting
                  </p>
                  <p className="text-sm text-warning-fg mt-1">
                    You'll receive a report number and password to track your submission.
                    We won't store any personal information that could identify you.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            const isValid = await trigger(['title', 'description', 'report_type_id']);
            if (isValid) {
              setStep(2);
            }
          }}
          disabled={isLoading}
          isLoading={isLoading}
        >
          Continue
        </Button>
      </div>
    </div>
  );

  // Render step 2: Detailed information
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">
            {selectedType?.name} Details
          </h3>
          <p className="text-sm text-ink-muted mt-1">
            Please provide additional information as requested
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="small"
          onClick={() => setStep(1)}
        >
          Back
        </Button>
      </div>

      {renderDynamicFields()}

      {/* File upload section */}
      <div>
        <label className="block text-sm font-medium text-ink-secondary mb-2">
          Attachments (Optional)
        </label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-line-strong border-dashed rounded-lg">
          <div className="space-y-1 text-center">
            <Upload className="mx-auto h-12 w-12 text-ink-subtle" />
            <div className="flex text-sm text-ink-muted">
              <label className="relative cursor-pointer bg-surface rounded-md font-medium text-accent-fg hover:text-accent-fg focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-accent-ring">
                <span>Upload files</span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="sr-only"
                  accept={ATTACHMENT_ACCEPT}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs text-ink-muted">
              {ATTACHMENT_HINT}
            </p>
          </div>
        </div>

        {/* File previews */}
        {attachments.length > 0 && (
          <div className="mt-4 space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-subtle rounded-lg"
              >
                <div className="flex items-center">
                  {attachment.preview ? (
                    <img
                      src={attachment.preview}
                      alt={attachment.name}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <FileText className="w-10 h-10 text-ink-subtle" />
                  )}
                  <div className="ml-3">
                    <p className="text-sm font-medium text-ink truncate max-w-xs">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {(attachment.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  className="p-1 text-ink-subtle hover:text-danger-fg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submission options */}
      <div className="pt-4 border-t border-line">
        <h4 className="text-sm font-medium text-ink mb-3">Submission Options</h4>

        {isAuthenticated ? (
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={!showAnonymousFields}
                onChange={(e) => setShowAnonymousFields(!e.target.checked)}
                className="rounded border-line-strong text-accent-fg focus:ring-accent-ring"
              />
              <div className="ml-2">
                <p className="text-sm font-medium text-ink">
                  Submit with my account
                </p>
                <p className="text-xs text-ink-muted">
                  Your report will be linked to your account for easy tracking
                </p>
              </div>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showAnonymousFields}
                onChange={(e) => setShowAnonymousFields(e.target.checked)}
                className="rounded border-line-strong text-accent-fg focus:ring-accent-ring"
              />
              <div className="ml-2">
                <p className="text-sm font-medium text-ink">
                  Submit anonymously
                </p>
                <p className="text-xs text-ink-muted">
                  We won't link this report to your account
                </p>
              </div>
            </label>
          </div>
        ) : (
          <div className="p-3 bg-subtle rounded-lg">
            <p className="text-sm text-ink-secondary">
              You are submitting anonymously. You'll receive a report number and password to track your submission.
            </p>
          </div>
        )}

        {/* Contact information for anonymous submissions */}
        {showAnonymousFields && (
          <div className="mt-4 p-4 bg-accent-soft rounded-lg border border-line-accent">
            <h5 className="text-sm font-medium text-accent-fg mb-2">
              Optional Contact Information
            </h5>
            <p className="text-sm text-accent-fg mb-3">
              Providing contact information is optional but allows us to follow up if we need more details.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                startAdornment={<Mail className="w-4 h-4" />}
                value={formData.contact_email || ''}
                onChange={(e) => handleFieldChange('contact_email', e.target.value)}
              />
              <Input
                label="Phone Number"
                type="tel"
                placeholder="(123) 456-7890"
                startAdornment={<Phone className="w-4 h-4" />}
                value={formData.contact_phone || ''}
                onChange={(e) => handleFieldChange('contact_phone', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between pt-4 border-t border-line">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setStep(1)}
        >
          Back
        </Button>
        <Button
          type="submit"
          isLoading={isLoading}
          disabled={isLoading}
          variant="secondary"
        >
          Submit Report
        </Button>
      </div>
    </div>
  );

  return (
    <Card className="max-w-4xl mx-auto">
      {/* Progress indicator. The connector collapses below sm so the two
          labels keep their full text instead of truncating. */}
      <div className="mb-8">
        <div className="flex items-center gap-3 sm:gap-4">
          {[
            { n: 1, label: 'Basic Information' },
            { n: 2, label: 'Details' },
          ].map(({ n, label }, i) => (
            <React.Fragment key={n}>
              {i > 0 && (
                <div className={`hidden sm:block flex-1 h-px ${step >= n ? 'bg-accent' : 'bg-line'}`} />
              )}
              <div className={`flex items-center gap-2 ${step >= n ? 'text-accent-fg' : 'text-ink-subtle'}`}>
                <span
                  className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold border ${
                    step >= n
                      ? 'bg-accent-soft border-line-accent text-accent-fg'
                      : 'bg-subtle border-line text-ink-subtle'
                  }`}
                >
                  {n}
                </span>
                <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Form content */}
      <form onSubmit={handleBasicSubmit(handleSubmit)}>
        <div className={step === 1 ? '' : 'hidden'}>
          {renderStep1()}
        </div>
        <div className={step === 2 ? '' : 'hidden'}>
          {renderStep2()}
        </div>
      </form>

      {/* Security notice */}
      <div className="mt-8 p-4 bg-success-soft rounded-lg border border-success-line">
        <div className="flex">
          <Lock className="w-5 h-5 text-success-fg mt-0.5 mr-3 shrink-0" />
          <div>
            <p className="text-sm font-medium text-success-fg">
              Your Information is Secure
            </p>
            <p className="text-sm text-success-fg mt-1">
              All submissions are encrypted and stored securely. We use industry-standard security measures to protect your data.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ReportForm;
