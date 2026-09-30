// src/pages/admin/CreateReportType.jsx
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  HelpCircle,
  GitBranch,
  Zap,
  CheckCircle,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import ReportTypeBuilder from '../../components/forms/ReportTypeBuilder';
import { reportTypesAPI } from '../../api';
import { toast } from 'react-toastify';
import { useAuthStore } from '../../store/authStore';
import DashboardTour from '../../components/tour/DashboardTour';
import useSEO from '../../hooks/useSEO';

const CREATE_REPORT_TYPE_TOUR_KEY = 'xposer_create_report_type_tour_seen';

const CreateReportType = () => {
  useSEO({
    title: 'Create Report Type',
    description: 'Define a new report category and build its intake form.',
    noIndex: true,
  });
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const tourRef = useRef(null);

  const tourSteps = useMemo(() => [
    {
      target: '[data-tour="crt-header"]',
      title: 'Create a report type',
      content: 'Report types define the categories reporters choose from, each with its own custom form.',
      placement: 'bottom',
      skipBeacon: true,
    },
    {
      target: '[data-tour="rtb-basic-settings"]',
      title: 'Basic settings',
      content: 'Name the report type, describe its purpose, and control whether it is active or hidden from reporters.',
      placement: 'right',
    },
    {
      target: '[data-tour="rtb-sections"]',
      title: 'Form sections',
      content: 'Break your form into logical steps. Add a section to start adding questions and conditional logic.',
      placement: 'left',
    },
    {
      target: '[data-tour="rtb-mode-toggle"]',
      title: 'Builder vs. Preview',
      content: 'Switch to Preview at any time to see exactly what reporters will fill out.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="crt-operators"]',
      title: 'Conditional operators',
      content: 'Reference this guide when setting up conditional logic — e.g. only show a question when another answer equals, contains, or is one of a set of values.',
      placement: 'top',
    },
    {
      target: '[data-tour="rtb-submit"]',
      title: 'Create the report type',
      content: 'When your form is ready, save it here to make it available to reporters.',
      placement: 'bottom',
    },
  ], []);

  // Handle form submission
  const handleSubmit = async (builderFormData) => {
    setLoading(true);

    try {
      // Prepare data for submission
      const dataToSubmit = {
        name: builderFormData.name,
        description: builderFormData.description,
        is_active: builderFormData.is_active,
        sections: builderFormData.sections.map(section => ({
          title: section.title,
          description: section.description,
          order: section.order,
          // Include conditional logic for sections
          conditional_logic: section.conditional_logic ? {
            rules: section.conditional_logic.rules.map(rule => ({
              condition_type: rule.condition_type || 'show',
              when_question: rule.when_question,
              operator: rule.operator,
              value: rule.value !== null && rule.value !== undefined ? rule.value : undefined,
              values: rule.values && rule.values.length > 0 ? rule.values : undefined,
            })),
            logic_type: section.conditional_logic.logic_type || 'and',
          } : undefined,
          questions: section.questions.map(question => {
            const baseQuestion = {
              type: question.type,
              label: question.label,
              name: question.name,
              required: question.required,
              placeholder: question.placeholder,
              help_text: question.help_text,
              default_value: question.default_value || '',
              validation: question.validation || {},
              order: question.order,
            };

            // Add options for select/multiselect
            if (['select', 'multiselect'].includes(question.type)) {
              baseQuestion.options = question.options
                ?.map((opt) => {
                  if (typeof opt === 'string') {
                    return opt.trim();
                  }

                  if (opt && typeof opt === 'object') {
                    return String(opt.value ?? opt.label ?? '').trim();
                  }

                  return '';
                })
                .filter(Boolean) || [];
            }

            // Add conditional logic for questions
            if (question.conditional_logic && question.conditional_logic.rules.length > 0) {
              baseQuestion.conditional_logic = {
                rules: question.conditional_logic.rules.map(rule => ({
                  condition_type: rule.condition_type || 'show',
                  when_question: rule.when_question,
                  operator: rule.operator,
                  value: rule.value !== null && rule.value !== undefined ? rule.value : undefined,
                  values: rule.values && rule.values.length > 0 ? rule.values : undefined,
                })),
                logic_type: question.conditional_logic.logic_type || 'and',
              };
            }

            return baseQuestion;
          })
        })),
        version: 1
      };

      console.log('Submitting report type:', dataToSubmit);

      await reportTypesAPI.createReportType(dataToSubmit);
      toast.success('Report type created successfully!');

      // Navigate to report types list
      setTimeout(() => {
        navigate(`/${user?.organization_slug}/staff/report-types`);
      }, 1500);

    } catch (error) {
      console.error('Error creating report type:', error);
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to create report type';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      navigate(`/${user?.organization_slug}/staff/report-types`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <DashboardTour ref={tourRef} storageKey={CREATE_REPORT_TYPE_TOUR_KEY} steps={tourSteps} />

      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <Button
            variant="ghost"
            size="small"
            onClick={handleCancel}
            className="hover:bg-active"
          >
            <ArrowLeft className="h-4 w-4 mr-2 shrink-0" />
            <span className="whitespace-nowrap">Back to Report Types</span>
          </Button>
        </div>

        <div className="bg-accent rounded-lg p-4 sm:p-6 text-on-accent mb-6" data-tour="crt-header">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Create Dynamic Report Type</h1>
          <p className="text-sm sm:text-base text-accent-text">
            Build intelligent multi-step forms with conditional logic
          </p>
        </div>
      </div>

      {/* Main Form */}
      <div className="space-y-6 sm:space-y-8">
        {/* Report Type Builder */}
        <ReportTypeBuilder
          initialData={null}
          onSubmit={handleSubmit}
          isLoading={loading}
        />

        {/* Available Operators Guide */}
        <Card className="bg-accent-soft border-line-accent" data-tour="crt-operators">
          <div className="space-y-4">
            <h4 className="font-medium text-accent-fg flex items-center">
              <Zap className="w-5 h-5 mr-2 text-accent-fg shrink-0" />
              Available Conditional Operators
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-surface p-3 rounded border border-line-accent">
                <div className="text-xs font-semibold text-accent-fg mb-1">equals</div>
                <div className="text-xs text-accent-fg">Exact match (supports text, numbers, booleans)</div>
              </div>

              <div className="bg-surface p-3 rounded border border-line-accent">
                <div className="text-xs font-semibold text-accent-fg mb-1">not equals</div>
                <div className="text-xs text-accent-fg">Does not match the specified value</div>
              </div>

              <div className="bg-surface p-3 rounded border border-line-accent">
                <div className="text-xs font-semibold text-accent-fg mb-1">contains</div>
                <div className="text-xs text-accent-fg">Text contains the specified substring</div>
              </div>

              <div className="bg-surface p-3 rounded border border-line-accent">
                <div className="text-xs font-semibold text-accent-fg mb-1">greater than / less than</div>
                <div className="text-xs text-accent-fg">Numeric comparisons (e.g., age &gt; 18)</div>
              </div>

              <div className="bg-surface p-3 rounded border border-line-accent">
                <div className="text-xs font-semibold text-accent-fg mb-1">is one of</div>
                <div className="text-xs text-accent-fg">Matches any value in a list (comma-separated)</div>
              </div>

              <div className="bg-surface p-3 rounded border border-line-accent">
                <div className="text-xs font-semibold text-accent-fg mb-1">is empty / is not empty</div>
                <div className="text-xs text-accent-fg">Check if field has a value or is blank</div>
              </div>

              <div className="bg-surface p-3 rounded border border-line-accent">
                <div className="text-xs font-semibold text-accent-fg mb-1">starts with / ends with</div>
                <div className="text-xs text-accent-fg">Text pattern matching</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CreateReportType;
