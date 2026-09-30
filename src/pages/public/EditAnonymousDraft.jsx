// src/pages/public/EditAnonymousDraft.jsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, ChevronRight, FileText, Lock, Eye, EyeOff } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/layout/LoadingSpinner';
import MultiStepReportForm from '../../components/forms/MultiStepReportForm';
import { reportsAPI } from '../../api/reports';
import { reportTypesAPI } from '../../api/reportTypes';
import { isDraftReport } from '../../utils/reports';
import { toast } from 'react-toastify';
import useSEO from '../../hooks/useSEO';

/**
 * Resume an unsubmitted anonymous report. Reached from Track Report when the
 * credentials belong to a draft, so the report and password normally arrive in
 * router state; on a refresh the password is asked for again.
 */
const EditAnonymousDraft = () => {
  const { orgSlug, reportNumber } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [report, setReport] = useState(location.state?.report || null);
  const [password, setPassword] = useState(location.state?.password || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Only needed for drafts that were started but never got a type assigned.
  const [reportTypes, setReportTypes] = useState([]);
  const [chosenTypeId, setChosenTypeId] = useState(null);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  useSEO({
    title: `Continue Draft #${reportNumber}`,
    noIndex: true,
  });

  const trackBase = `/${orgSlug || ''}/track-report`;

  // Fall back to the credentials the submit flow stashed for this report.
  useEffect(() => {
    if (password) return;
    try {
      const stored = JSON.parse(localStorage.getItem('reportCredentials') || 'null');
      if (stored?.reportNumber === reportNumber && stored?.password) {
        setPassword(stored.password);
      }
    } catch {
      // Malformed storage — fall through to the password prompt.
    }
  }, [password, reportNumber]);

  // Load (or reload) the draft whenever we have a password but no report yet.
  useEffect(() => {
    if (!password || report) return;

    const loadDraft = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await reportsAPI.trackReport({
          report_number: reportNumber,
          password,
        });
        setReport(data);
      } catch (err) {
        console.error('Failed to load draft:', err);
        setPassword('');
        setError(err.response?.data?.detail || 'Invalid report number or password.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDraft();
  }, [password, report, reportNumber]);

  // Submitted reports are read-only — send them to the details view instead.
  useEffect(() => {
    if (!report || isDraftReport(report)) return;
    toast.info('This report has already been submitted.');
    navigate(`/${orgSlug || ''}/report-details/${report.report_number || reportNumber}`, {
      replace: true,
      state: { report, password, fromTrackReport: true },
    });
  }, [report, orgSlug, reportNumber, password, navigate]);

  // Keep the widget/session credentials in sync, same as the submit flow.
  useEffect(() => {
    if (!report || !password) return;
    localStorage.setItem(
      'reportCredentials',
      JSON.stringify({
        reportNumber,
        password,
        ...(orgSlug ? { organization_slug: orgSlug } : {}),
      })
    );
  }, [report, password, reportNumber, orgSlug]);

  // A draft that never picked a type needs one before the form can be built.
  useEffect(() => {
    if (!report || report.report_type_id || reportTypes.length > 0) return;

    const fetchReportTypes = async () => {
      setIsLoadingTypes(true);
      try {
        const types = await reportTypesAPI.getReportTypes(true, true, orgSlug);
        setReportTypes(types || []);
      } catch (err) {
        console.error('Failed to fetch report types:', err);
        toast.error('Failed to load report types');
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchReportTypes();
  }, [report, reportTypes.length, orgSlug]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    setPassword(passwordInput.trim());
    setPasswordInput('');
  };

  const backLink = (
    <button
      onClick={() => navigate(trackBase)}
      className="inline-flex items-center text-sm font-medium text-ink-muted hover:text-ink transition-colors mb-6"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to Report Tracking
    </button>
  );

  if (isLoading) {
    return <LoadingSpinner message="Loading your draft..." />;
  }

  // No usable password — ask for it rather than bouncing the reporter away.
  if (!report) {
    return (
      <div className="min-h-screen bg-canvas px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-md mx-auto">
          {backLink}
          <Card>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-soft border border-line-accent rounded-xl mb-3">
                <Lock className="w-6 h-6 text-accent-fg" />
              </div>
              <h1 className="text-xl font-bold text-ink">Continue Draft #{reportNumber}</h1>
              <p className="text-sm text-ink-muted mt-1">
                Enter the password you saved with this report to keep filling it in.
              </p>
            </div>

            {error && (
              <Alert variant="error" className="mb-4">
                {error}
              </Alert>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  label="Report Password"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  startAdornment={<Lock className="w-4 h-4" />}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-ink-subtle hover:text-ink transition-colors absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="submit" variant="primary" fullWidth disabled={!passwordInput.trim()}>
                Continue Draft
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  const reportTypeId = report.report_type_id || chosenTypeId;

  if (!reportTypeId) {
    return (
      <div className="min-h-screen bg-canvas px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-5xl mx-auto">
          {backLink}
          <h1 className="text-2xl font-bold text-ink mb-2">Continue Your Report</h1>
          <p className="text-ink-muted mb-6">
            This report doesn't have a type yet. Choose one to keep going — your report
            number <span className="font-mono font-semibold text-ink">{reportNumber}</span> and
            password stay the same.
          </p>

          {isLoadingTypes ? (
            <LoadingSpinner message="Loading report types..." />
          ) : reportTypes.length === 0 ? (
            <Card>
              <Alert variant="warning">
                <p>No report types available at this time. Please try again later.</p>
              </Alert>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setChosenTypeId(type.id)}
                  className="text-left h-full group focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus rounded-xl"
                >
                  <Card className="h-full flex flex-col transition-[border-color,box-shadow,transform] duration-200 ease-out-xp group-hover:border-line-accent group-hover:shadow-md group-hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-ink text-base leading-snug">{type.name}</h3>
                      <ChevronRight className="w-5 h-5 text-ink-subtle shrink-0 transition-colors group-hover:text-accent-fg" />
                    </div>
                    <p className="text-sm text-ink-muted leading-relaxed mb-4">
                      {type.description || 'No description available'}
                    </p>
                    {type.sections && (
                      <div className="mt-auto">
                        <span className="inline-flex items-center rounded-full border border-line bg-subtle px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                          <FileText className="w-3 h-3 mr-1.5" />
                          {type.sections.length} step{type.sections.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    // Extra bottom padding on mobile keeps content clear of the floating chat button
    <div className="min-h-screen bg-canvas px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-28 sm:pb-12">
      <MultiStepReportForm
        reportTypeId={reportTypeId}
        reportNumber={reportNumber}
        password={password}
        existingReportNumber={reportNumber}
        initialStepData={report.step_data || null}
        initialFormData={report.form_data || null}
        initialStep={report.current_step ?? null}
        // A type picked just now still needs the server-side select-type call.
        skipTypeSelection={Boolean(report.report_type_id)}
        isEditingDraft
        isAnonymous
        organizationSlug={orgSlug || report.organization_slug || null}
        onSuccess={(submitted) =>
          navigate(`/${orgSlug || ''}/report-details/${reportNumber}`, {
            replace: true,
            state: { report: submitted || report, password, fromTrackReport: true },
          })
        }
        onCancel={() => navigate(trackBase)}
      />
    </div>
  );
};

export default EditAnonymousDraft;
