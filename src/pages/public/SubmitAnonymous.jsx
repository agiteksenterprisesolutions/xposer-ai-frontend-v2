import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Shield,
  Lock,
  FileText,
  AlertCircle,
  ChevronRight,
  CheckCircle,
  Key,
  Eye,
  EyeOff,
  Copy,
  Download,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import MultiStepReportForm from '../../components/forms/MultiStepReportForm';
import { reportTypesAPI } from '../../api/reportTypes';
import { reportsAPI } from '../../api/reports';
import { toast } from 'react-toastify';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import { copyToClipboard } from '../../utils/clipboard';
import { isStaffUser } from '../../utils/roles';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';

// The two stages this page owns are separate screens with nothing in common,
// so each is toured (and dismissed) on its own. The multi-step form stage is
// left alone — it walks the reporter through its own steps already.
const TOUR_KEYS = {
  init: 'xposer_anon_init_tour_seen',
  selectType: 'xposer_anon_select_type_tour_seen',
};

/** Radio rows are full cards so the whole row is a tap target on mobile. */
const PasswordOption = ({ checked, onChange, title, description, children }) => (
  <label
    className={`block rounded-xl border p-4 cursor-pointer transition-colors ${checked
        ? 'border-line-accent bg-accent-soft'
        : 'border-line bg-subtle hover:border-line-strong hover:bg-hover'
      }`}
  >
    <span className="flex items-start gap-3">
      <input
        type="radio"
        name="passwordOption"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
      />
      <span className="min-w-0">
        <span className={`block text-sm font-medium ${checked ? 'text-accent-fg' : 'text-ink'}`}>
          {title}
        </span>
        <span className="block text-xs text-ink-muted mt-0.5">{description}</span>
      </span>
    </span>
    {children}
  </label>
);

const SubmitAnonymous = () => {
  const { orgSlug } = useParams();
  const { user } = useAuthStore();
  /** Prefer session org when logged in; otherwise use slug from /:orgSlug/... */
  const effectiveOrgSlug = user?.organization_slug ?? orgSlug;
  const navigate = useNavigate();
  const [stage, setStage] = useState('init'); // 'init', 'selectType', 'form'
  const [reportTypes, setReportTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);

  // Credentials state
  const [credentials, setCredentials] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();

  // Each stage of the wizard gets its own title.
  useSEO({
    title:
      stage === 'form' && selectedType
        ? `Submit Report — ${selectedType.name}`
        : stage === 'selectType'
          ? 'Select Report Type'
          : 'Submit an Anonymous Report',
    description:
      'File a report anonymously. No personal information is required — you receive credentials to track progress securely.',
    keywords: ['anonymous report', 'whistleblower', 'confidential reporting'],
    // The wizard holds live report data once credentials exist.
    noIndex: stage !== 'init',
  });

  // Fetch report types
  useEffect(() => {
    const fetchReportTypes = async () => {
      setIsLoadingTypes(true);
      try {
        const types = await reportTypesAPI.getReportTypes(true, true, effectiveOrgSlug); // Pass org slug
        setReportTypes(types || []);
      } catch (error) {
        console.error('Failed to fetch report types:', error);
        toast.error('Failed to load report types');
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchReportTypes();
  }, []);

  // Step 1: Initialize and get credentials
  const handleInitialize = async () => {
    if (isStaffUser(user)) {
      toast.error('You are signed in to a staff account. Log out to file an anonymous report.');
      return null
    }
    if (useCustomPassword && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      const customPassword = useCustomPassword ? password : null;
      const response = await reportsAPI.startAnonymousReport(
        customPassword,
        effectiveOrgSlug || undefined
      );

      const newCredentials = {
        reportNumber: response.report_number,
        password: response.password,
        ...(effectiveOrgSlug ? { organization_slug: effectiveOrgSlug } : {}),
      };

      // CRITICAL: Store immediately before setting state to avoid race condition
      localStorage.setItem('reportCredentials', JSON.stringify(newCredentials));
      console.log('Credentials stored immediately:', newCredentials.reportNumber);

      setCredentials(newCredentials);
      setStage('selectType');
      toast.success('Credentials created! Now select a report type.');
    } catch (error) {
      console.error('Failed to initialize:', error);
      toast.error(error.response?.data?.detail || 'Failed to initialize report');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Select report type
  const handleTypeSelect = async (typeId) => {
    const type = reportTypes.find(t => t.id === typeId);
    if (!type || !credentials) return;

    setIsLoading(true);
    try {
      await reportsAPI.selectReportType(
        credentials.reportNumber,
        typeId,
        credentials.password,
        effectiveOrgSlug || credentials.organization_slug || undefined
      );

      // Ensure credentials are in localStorage before moving to form stage
      // (in case user refreshed page or localStorage was cleared)
      localStorage.setItem('reportCredentials', JSON.stringify(credentials));

      setSelectedType(type);
      setStage('form');
      // toast.success(`Report type "${type.name}" selected.`);
    } catch (error) {
      console.error('Failed to select report type:', error);
      toast.error(error.response?.data?.detail || 'Failed to select report type');
    } finally {
      setIsLoading(false);
    }
  };

  // A report started from a signed-in account has no report password — the
  // account is what opens it — so there is nothing to show, copy or save.
  const hasReportPassword = Boolean(credentials?.password);

  // Handle copy credentials
  const handleCopyCredentials = async () => {
    if (!credentials) return;
    const text = hasReportPassword
      ? `Report Number: ${credentials.reportNumber}\nPassword: ${credentials.password}`
      : `Report Number: ${credentials.reportNumber}`;
    const copied = await copyToClipboard(text);
    if (copied) {
      toast.success('Credentials copied to clipboard!');
    } else {
      toast.error('Could not copy — please select the credentials and copy them manually.');
    }
  };

  // Handle download credentials
  const handleDownloadCredentials = () => {
    if (!credentials) return;
    const content = hasReportPassword
      ? `
Xposer AI Report Credentials
================================

Report Number: ${credentials.reportNumber}
Password: ${credentials.password}

IMPORTANT:
----------
1. Save these credentials in a secure location
2. You will need both credentials to track your report
3. These credentials cannot be recovered if lost
4. Do not share these credentials with anyone

Track your report at: ${window.location.origin}/track-report
Generated on: ${new Date().toLocaleString()}

Security Notice:
---------------
This report is submitted anonymously. No personal information is stored.
    `
      : `
Xposer AI Report Credentials
================================

Report Number: ${credentials.reportNumber}

IMPORTANT:
----------
1. This report is filed under your account — sign in to open it
2. No report password is needed, and none exists for this report
3. Keep the report number somewhere you can find it again

Track your report at: ${window.location.origin}/track-report
Generated on: ${new Date().toLocaleString()}
    `;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${credentials.reportNumber}_credentials.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Backup sync: Keep localStorage in sync with state (for edge cases)
  useEffect(() => {
    if (credentials) {
      localStorage.setItem('reportCredentials', JSON.stringify(credentials));
    }
  }, [credentials]);

  const handleSuccess = () => {
    const slug = effectiveOrgSlug || credentials?.organization_slug;
    if (slug) {
      navigate(`/${slug}/track-report?report=${credentials.reportNumber}`);
    } else {
      navigate(`/track-report?report=${credentials.reportNumber}`);
    }
  };

  const tourSteps = useMemo(() => {
    if (stage === 'init') {
      return [
        {
          target: '[data-tour="anon-how-it-works"]',
          title: 'Four steps, no account',
          content:
            'You never enter a name or email. Credentials come first, and they are the only thing tying you to the report.',
          placement: 'bottom',
          skipBeacon: true,
        },
        {
          target: '[data-tour="anon-password-options"]',
          title: 'Choose your password',
          content:
            'Let us generate a strong one, or set your own if you would rather memorize it. Either way it is paired with a report number.',
          placement: isDesktop ? 'right' : 'bottom',
        },
        {
          target: '[data-tour="anon-credentials-warning"]',
          title: 'Save them immediately',
          content:
            'Nothing about you is stored, which also means lost credentials cannot be recovered or reset. Copy them somewhere safe.',
          placement: 'top',
        },
        {
          target: '[data-tour="anon-start"]',
          title: 'Start when ready',
          content:
            'This creates your credentials and moves you on to picking a report type. Nothing is submitted yet.',
          placement: 'top',
        },
      ];
    }

    if (stage === 'selectType') {
      const steps = [];

      if (credentials) {
        steps.push({
          target: '[data-tour="anon-credentials"]',
          title: 'Your credentials',
          content:
            'Copy or download these now — you will need both to finish this report later and to track it afterwards.',
          placement: 'bottom',
          skipBeacon: true,
        });
      }

      steps.push({
        target: '[data-tour="anon-types"]',
        title: 'Pick a category',
        content:
          'Each category asks a different set of questions. Choose the closest fit — compliance can re-categorize it later if needed.',
        placement: 'top',
        skipBeacon: !credentials,
      });

      steps.push({
        target: '[data-tour="anon-info"]',
        title: 'What happens next',
        content:
          'Fill in the form, submit, then follow progress and reply to questions using your credentials.',
        placement: isDesktop ? 'left' : 'top',
      });

      return steps;
    }

    return [];
  }, [stage, credentials, isDesktop]);

  const renderInitStage = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-accent-soft border border-line-accent rounded-2xl mb-4">
          <Key className="h-7 w-7 sm:h-8 sm:w-8 text-accent-fg" />
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink tracking-[-0.02em]">
          Start Anonymous Report
        </h1>
        <p className="text-ink-muted mt-3 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          First, create secure credentials to protect your anonymity.
          You'll need these to continue and track your report.
        </p>
      </div>

      <Card>
        <div
          className="flex items-start gap-3 pb-5 mb-5 border-b border-line-subtle"
          data-tour="anon-how-it-works"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-success-soft text-success-fg">
            <Shield className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-ink text-sm">How It Works</h3>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              1. Get credentials → 2. Select report type → 3. Fill form → 4. Submit
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-4" data-tour="anon-password-options">
            <PasswordOption
              checked={!useCustomPassword}
              onChange={() => {
                setUseCustomPassword(false);
                setPassword('');
              }}
              title="Auto-generate secure password (recommended)"
              description="A strong random password will be generated for you"
            />

            <PasswordOption
              checked={useCustomPassword}
              onChange={() => setUseCustomPassword(true)}
              title="Create your own password"
              description="Minimum 6 characters, maximum 50 characters"
            >
              {useCustomPassword && (
                <div className="mt-3 pl-7">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={50}
                    helperText={
                      password.length > 0 && password.length < 6
                        ? `${6 - password.length} more character${6 - password.length === 1 ? '' : 's'} needed`
                        : 'Minimum 6 characters'
                    }
                    error={undefined}
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-ink-subtle transition-colors hover:text-ink"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                  />
                </div>
              )}
            </PasswordOption>
          </div>

          <div data-tour="anon-credentials-warning">
            <Alert variant="warning" title="Save Your Credentials!">
              You will receive a unique report number and password.{' '}
              <strong>Save these immediately</strong> — you'll need them to continue and
              track your report. They cannot be recovered if lost.
            </Alert>
          </div>

          <Button
            data-tour="anon-start"
            onClick={handleInitialize}
            isLoading={isLoading}
            disabled={isLoading || (useCustomPassword && password.length < 6)}
            fullWidth
            size="large"
            variant="primary"
          >
            Get Secure Credentials
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderSelectTypeStage = () => (
    <div className="max-w-6xl mx-auto">
      {/* The chat widget comes from PublicLayout; it reads credentials from localStorage. */}
      <div className="mb-8">
        <button
          onClick={() => setStage('init')}
          className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink mb-6"
        >
          ← Back to Credentials
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-success-soft border border-success-line rounded-2xl mb-4">
            <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 text-success-fg" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink tracking-[-0.02em]">
            Select Report Type
          </h1>
          <p className="text-ink-muted mt-3 text-sm sm:text-base">
            Choose the category that best fits your concern
          </p>
        </div>

        {/* Credentials Display */}
        {credentials && (
          <Card className="mb-8 bg-accent-soft border-line-accent" data-tour="anon-credentials">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* flex-1 so the two credential columns spread across the card
                  rather than collapsing to their content width */}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-ink mb-3 text-sm">Your Report Credentials</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">
                      Report Number
                    </span>
                    <div className="text-base sm:text-lg font-bold text-accent-fg font-mono break-all mt-0.5">
                      {credentials.reportNumber}
                    </div>
                  </div>
                  {hasReportPassword && (
                    <div className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">
                        Password
                      </span>
                      <div className="text-base sm:text-lg font-bold text-ink font-mono break-all mt-0.5">
                        {credentials.password}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleCopyCredentials}
                  startIcon={Copy}
                >
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleDownloadCredentials}
                  startIcon={Download}
                >
                  Download
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 mb-12">
        {/* Report Types Grid */}
        <div className="lg:col-span-2" data-tour="anon-types">
          {isLoadingTypes ? (
            // Skeletons rather than a bare string — keeps the layout from jumping
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <Card key={i} className="h-full flex flex-col" aria-hidden="true">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <Skeleton.Text size="base" className="w-3/4" />
                    <Skeleton className="h-5 w-5 shrink-0 rounded" />
                  </div>
                  <div className="mb-4">
                    <span className="flex h-[1.625em] items-center text-sm"><Skeleton className="h-3 w-full" /></span>
                    <span className="flex h-[1.625em] items-center text-sm"><Skeleton className="h-3 w-2/3" /></span>
                  </div>
                  <Skeleton className="mt-auto h-6.5 w-16 rounded-full" />
                </Card>
              ))}
            </div>
          ) : reportTypes.length === 0 ? (
            <Card>
              <Alert variant="warning">
                <p>No report types available at this time. Please try again later.</p>
              </Alert>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {reportTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleTypeSelect(type.id)}
                  disabled={isLoading}
                  className="text-left h-full group disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus rounded-xl"
                >
                  <Card className="h-full flex flex-col transition-[border-color,box-shadow,transform] duration-200 ease-out-xp group-hover:border-line-accent group-hover:shadow-md group-hover:-translate-y-0.5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-semibold text-ink text-base leading-snug">
                        {type.name}
                      </h3>
                      <ChevronRight className="w-5 h-5 text-ink-subtle shrink-0 transition-colors group-hover:text-accent-fg" />
                    </div>

                    <p className="text-sm text-ink-muted leading-relaxed mb-4">
                      {type.description || 'No description available'}
                    </p>

                    {type.sections && (
                      <div className="mt-auto">
                        <span className="inline-flex items-center rounded-full border border-line bg-subtle px-2.5 py-1 text-[11px] font-medium text-ink-muted">
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

        {/* Sidebar Info */}
        <div className="space-y-4 lg:space-y-6" data-tour="anon-info">
          <Card>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-success-soft text-success-fg">
                <Shield className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-ink text-sm">Complete Anonymity</h3>
                <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                  No personal information is required. Your credentials are your only identifier.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-accent-soft text-accent-fg">
                <Lock className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-ink text-sm">Secure &amp; Encrypted</h3>
                <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                  All reports are encrypted end-to-end. We don't store IP addresses or metadata.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-info-soft text-info-fg">
                <FileText className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-ink text-sm">What Happens Next?</h3>
                <ul className="text-sm text-ink-muted mt-2 space-y-1.5">
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>Select a report type from the options</li>
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>Fill out the multi-step form</li>
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>Submit your report securely</li>
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>Track progress using your credentials</li>
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>Receive updates securely</li>
                </ul>
              </div>
            </div>
          </Card>

          <Alert
            variant="warning"
            title={hasReportPassword ? 'Save Your Credentials First!' : 'Save Your Report Number'}
          >
            {hasReportPassword
              ? "Make sure you've saved your report number and password before continuing. You cannot proceed without them."
              : 'This report is filed under your account, so no password is needed — but keep the report number to find it again.'}
          </Alert>
        </div>
      </div>
    </div>
  );

  return (
    // Extra bottom padding on mobile keeps content clear of the floating chat button
    <div className="min-h-screen bg-canvas px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-28 sm:pb-12">
      {/* Keyed on the stage so switching screens remounts the tour and the new
          stage's steps get their own auto-start rather than reusing the last
          stage's `seen` flag. */}
      {TOUR_KEYS[stage] && (
        <DashboardTour
          key={stage}
          ref={tourRef}
          storageKey={TOUR_KEYS[stage]}
          steps={tourSteps}
        />
      )}

      {stage === 'init' && renderInitStage()}
      {stage === 'selectType' && renderSelectTypeStage()}
      {stage === 'form' && selectedType && credentials && (
        <MultiStepReportForm
          reportTypeId={selectedType.id}
          reportNumber={credentials.reportNumber}
          password={credentials.password}
          organizationSlug={effectiveOrgSlug || credentials.organization_slug}
          onSuccess={handleSuccess}
          onCancel={() => {
            setStage('selectType');
            setSelectedType(null);
          }}
          isAnonymous={true}
        />
      )}
    </div>
  );
};

export default SubmitAnonymous;
