// src/pages/reporter/EditDraftReport.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, ChevronRight, FileText } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { reportsAPI } from '../../api/reports';
import { reportTypesAPI } from '../../api/reportTypes';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Skeleton from '../../components/ui/Skeleton';
import MultiStepReportForm, { ReportFormSkeleton } from '../../components/forms/MultiStepReportForm';
import { isDraftReport } from '../../utils/reports';
import { toast } from 'react-toastify';
import useSEO from '../../hooks/useSEO';

const EditDraftReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const orgSlug = user?.organization_slug || '';

  const [report, setReport] = useState(null);
  // Draft answers live on the progress endpoint — the report's own form_data
  // stays empty until the report is finally submitted.
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Only needed for drafts that were started but never got a type assigned.
  const [reportTypes, setReportTypes] = useState([]);
  const [chosenTypeId, setChosenTypeId] = useState(null);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  useSEO({
    enabled: !loading && !!report,
    title: report ? `Edit Draft #${report.report_number}` : '',
    noIndex: true,
  });

  useEffect(() => {
    const loadDraft = async () => {
      setLoading(true);
      try {
        const data = await reportsAPI.getReport(id);
        console.log(data)
        if (!isDraftReport(data)) {
          toast.error('This report has already been submitted and can no longer be edited.');
          navigate(`/${orgSlug}/reporter/reports/${id}`, { replace: true });
          return;
        }
        setReport(data);

        if (data.report_number && data.report_type_id) {
          try {
            setProgress(await reportsAPI.getProgress(data.report_number));
          } catch (err) {
            // Without progress the form still opens, just without saved answers.
            console.error('Failed to load draft progress:', err);
            toast.warn('Could not load your saved answers. You may need to fill them in again.');
          }
        }

        if (!data.report_type_id) {
          setIsLoadingTypes(true);
          try {
            const types = await reportTypesAPI.getReportTypes(true);
            setReportTypes(types || []);
          } catch (err) {
            console.error('Failed to fetch report types:', err);
            toast.error('Failed to load report types');
          } finally {
            setIsLoadingTypes(false);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load this draft.');
      } finally {
        setLoading(false);
      }
    };

    if (id) loadDraft();
  }, [id, navigate, orgSlug]);

  if (loading) {
    return (
      <div className="py-8 sm:py-12">
        <ReportFormSkeleton
          message="Loading your draft…"
          onBack={() => navigate(`/${orgSlug}/reporter/reports/${id}`)}
        />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <AlertCircle className="w-16 h-16 text-danger-fg mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-ink mb-2">Draft Unavailable</h2>
        <p className="text-ink-muted mb-6">{error || 'Draft not found.'}</p>
        <Button onClick={() => navigate(`/${orgSlug}/reporter/reports`)}>
          Back to My Reports
        </Button>
      </div>
    );
  }

  const reportTypeId = report.report_type_id || chosenTypeId;

  const backLink = (
    <button
      onClick={() => navigate(`/${orgSlug}/reporter/reports/${id}`)}
      className="inline-flex items-center text-sm font-medium text-ink-muted hover:text-ink transition-colors mb-6"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to Report
    </button>
  );

  // Draft with no type yet — pick one before the step form can be built.
  if (!reportTypeId) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {backLink}
        <h1 className="text-2xl font-bold text-ink mb-2">Continue Your Draft</h1>
        <p className="text-ink-muted mb-6">
          This draft doesn't have a report type yet. Choose one to keep going —
          your report number{' '}
          <span className="font-mono font-semibold text-ink">{report.report_number}</span>{' '}
          stays the same.
        </p>

        {isLoadingTypes ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="bg-surface rounded-xl border-2 border-line h-full p-6">
                <Skeleton.Text size="lg" className="mb-2 w-3/4" />
                <Skeleton.Lines lines={2} />
              </div>
            ))}
          </div>
        ) : reportTypes.length === 0 ? (
          <Card>
            <Alert variant="warning">
              <p>No report types available at this time. Please try again later.</p>
            </Alert>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {reportTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setChosenTypeId(type.id)}
                className="text-left group"
              >
                <div className="bg-surface rounded-xl border-2 border-line hover:border-line-accent transition-all duration-200 h-full p-6 hover:shadow-lg group-hover:-translate-y-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-ink text-lg mb-2 group-hover:text-accent-fg transition-colors">
                        {type.name}
                      </h3>
                      <p className="text-sm text-ink-muted line-clamp-3">
                        {type.description || 'Submit a report for this category'}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-ink-subtle group-hover:text-accent-fg group-hover:translate-x-1 transition-all shrink-0 ml-2" />
                  </div>
                  {type.sections?.length > 0 && (
                    <div className="flex items-center pt-4 border-t border-line-subtle">
                      <span className="inline-flex items-center text-xs font-medium text-ink-muted">
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        {type.sections.length} step{type.sections.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12">
      <MultiStepReportForm
        reportTypeId={reportTypeId}
        existingReportNumber={report.report_number}
        // Progress returns answers keyed by step index; the report doc carries
        // the same map as step_data, so either source works.
        initialStepData={progress?.form_data || progress?.step_data || report.step_data || null}
        // The endpoint names this current_section, older builds current_step.
        initialStep={progress?.current_section ?? progress?.current_step ?? report.current_step ?? null}
        initialFormData={report.form_data || null}
        // A type picked just now still needs the server-side select-type call.
        skipTypeSelection={Boolean(report.report_type_id)}
        isEditingDraft
        isAnonymous={false}
        organizationSlug={orgSlug || null}
        onSuccess={() => navigate(`/${orgSlug}/reporter/reports/${id}`)}
        onCancel={() => navigate(`/${orgSlug}/reporter/reports/${id}`)}
      />
    </div>
  );
};

export default EditDraftReport;
