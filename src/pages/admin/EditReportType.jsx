// src/pages/admin/EditReportType.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import ReportTypeBuilder from '../../components/forms/ReportTypeBuilder';
import { reportTypesAPI } from '../../api';
import { toast } from 'react-toastify';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import { toBuilderShape, summarizeReportType } from '../../utils/reportTypes';
// import Loader from '../../components/ui/loa';

const EditReportType = () => {
  const { id } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportType, setReportType] = useState(null);
  const [error, setError] = useState('');

  useSEO({
    enabled: !loading && !!reportType,
    title: reportType ? `Edit — ${reportType.name}` : '',
    description: reportType?.description,
    noIndex: true,
  });

  // Load report type data
  useEffect(() => {
    const loadReportType = async () => {
      setLoading(true);
      try {
        const data = await reportTypesAPI.getReportType(id);
        setReportType(data);
      } catch (err) {
        console.error('Failed to load report type:', err);
        setError('Failed to load report type. Please try again.');
        toast.error('Failed to load report type');
      } finally {
        setLoading(false);
      }
    };

    loadReportType();
  }, [id]);

  // Handle form submission
  const handleSubmit = async (formData) => {
    setSaving(true);

    try {
      // Transform the data to match API expectations
      const dataToSubmit = {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active,
        // Send sections array with their questions (not flattened)
        sections: formData.sections.map(section => ({
          id: section.id,
          title: section.title,
          description: section.description || '',
          order: section.order || 0,
          conditional_logic: section.conditional_logic || null,
          questions: section.questions.map(question => {
            const baseQuestion = {
              id: question.id,
              type: question.type,
              label: question.label,
              name: question.name,
              required: question.required || false,
              placeholder: question.placeholder || '',
              help_text: question.help_text || '',
              default_value: question.default_value || '',
              validation: question.validation || {},
              order: question.order || 0,
              conditional_logic: question.conditional_logic || null,
            };

            // Add options for select/multiselect/radio
            if (['select', 'multiselect', 'radio'].includes(question.type)) {
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

            return baseQuestion;
          })
        }))
      };

      console.log('Submitting data:', JSON.stringify(dataToSubmit, null, 2));
      await reportTypesAPI.updateReportType(id, dataToSubmit);

      // Navigate back after a short delay
      setTimeout(() => {
        navigate(`/${user?.organization_slug}/staff/report-types`);
      }, 1500);

    } catch (error) {
      console.error('Error updating report type:', error);
      const errorMessage = error.response?.data?.detail ||
        error.response?.data?.message ||
        'Failed to update report type';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    navigate(`/${user?.organization_slug}/staff/report-types`);
  };

  // Must come before the not-found guard below: on the first render the fetch
  // has not resolved, so `reportType` is still null and the page would flash
  // "Report type not found" until it arrives.
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-9 w-48 bg-active rounded-lg" />
          <div className="h-28 bg-active rounded-xl" />
          <div className="h-96 bg-active rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !reportType) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Alert variant="error">
          <div className="flex items-center">
            {error || 'Report type not found'}
          </div>
        </Alert>
        <div className="mt-4">
          <Button
            variant="secondary"
            onClick={() => navigate(`/${user?.organization_slug}/staff/report-types`)}
            startIcon={ArrowLeft}
          >
            Back to Report Types
          </Button>
        </div>
      </div>
    );
  }

  // Shared with the view page so the two cannot drift apart.
  const transformedData = toBuilderShape(reportType);
  const counts = summarizeReportType(reportType);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <Button
        variant="ghost"
        size="small"
        onClick={handleCancel}
        className="hover:bg-active"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Report Types
      </Button>
      <div className="flex items-center justify-between mb-8">



      </div>

      {/* Stats Summary */}
      <Card className="bg-accent-soft border-line-accent mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent-fg">{reportType.name}</div>
            <div className="text-sm text-accent-fg">Report Type</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent-fg">
              {counts.sections}
            </div>
            <div className="text-sm text-accent-fg">Sections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent-fg">
              {counts.questions}
            </div>
            <div className="text-sm text-accent-fg">Total Questions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent-fg">
              {counts.required}
            </div>
            <div className="text-sm text-accent-fg">Required Questions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent-fg">
              {reportType.is_active ? 'Active' : 'Inactive'}
            </div>
            <div className="text-sm text-accent-fg">Status</div>
          </div>
        </div>
      </Card>

      {/* Report Type Builder */}
      <ReportTypeBuilder
        initialData={transformedData}
        onSubmit={handleSubmit}
        isLoading={saving}
      />
    </div>
  );
};

export default EditReportType;
