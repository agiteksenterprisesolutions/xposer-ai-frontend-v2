import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  Shield,
  Lock,
  FileText,
  AlertCircle,
  CheckCircle,
  Key,
  Eye,
  EyeOff,
  Copy,
  Download,
  ArrowLeft,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Input from '../../components/ui/Input';
import MultiStepReportForm from '../../components/forms/MultiStepReportForm';
import { reportTypesAPI } from '../../api/reportTypes';
import ReportTypePicker, { DeflectionModal } from '../../components/forms/ReportTypePicker';
import { useDeflectionExits } from '../../hooks/useDeflectionExits';
import { reportsAPI, isAckOutdated, ackOutdatedMessage } from '../../api/reports';
import BeforeYouReport from '../../components/reports/BeforeYouReport';
import { currentAckHash } from '../../store/reportAckStore';
import { toast } from 'react-toastify';
import { useAuthStore } from '../../store/authStore';
import { describeError } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';
import { copyToClipboard } from '../../utils/clipboard';
import { isStaffUser } from '../../utils/roles';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import { intlLocale } from '../../utils/locale';

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
  const { t } = useTranslation('submit');
  const { user } = useAuthStore();
  /** Prefer session org when logged in; otherwise use slug from /:orgSlug/... */
  const effectiveOrgSlug = user?.organization_slug ?? orgSlug;
  const deflection = useDeflectionExits(effectiveOrgSlug);
  // The deflection popup opens once, on arrival, before credentials exist, so
  // a complaint or an HR request never creates an anonymous report it doesn't need.
  const [deflectionClosed, setDeflectionClosed] = useState(false);
  const navigate = useNavigate();
  // 'before' ("Before you report", XPAI-114) → 'init' (credentials) → 'selectType' → 'form'
  const [stage, setStage] = useState('before');
  // Set when the server refused a stale acknowledgement (409 ack_outdated).
  const [ackNotice, setAckNotice] = useState(null);
  // "Is this the right place?" comes first, over the "Before you report" page.
  const deflecting = (stage === 'before' || stage === 'init') && !deflection.loading && deflection.exits.length > 0 && !deflectionClosed;
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
        ? t('anonymous.seo.form', { name: selectedType.name })
        : stage === 'selectType'
          ? t('anonymous.seo.selectType')
          : stage === 'before'
            ? t('anonymous.seo.before')
            : t('anonymous.seo.init'),
    description: t('anonymous.seo.description'),
    keywords: ['anonymous report', 'whistleblower', 'confidential reporting'],
    // The wizard holds live report data once credentials exist.
    noIndex: stage !== 'init' && stage !== 'before',
  });

  // Fetch report types
  useEffect(() => {
    const fetchReportTypes = async () => {
      setIsLoadingTypes(true);
      try {
        const types = await reportTypesAPI.getReportTypes(true, false, effectiveOrgSlug); // Pass org slug
        setReportTypes(types || []);
      } catch (error) {
        console.error('Failed to fetch report types:', error);
        toast.error(t('shared.loadTypesFailed'));
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchReportTypes();
  }, []);

  // Step 1: Initialize and get credentials
  const handleInitialize = async () => {
    if (isStaffUser(user)) {
      toast.error(t('anonymous.toast.staffSignedIn'));
      return null
    }
    if (useCustomPassword && password.length < 6) {
      toast.error(t('anonymous.toast.passwordTooShort'));
      return;
    }

    // Every report starts from the "Before you report" page.
    if (!currentAckHash(effectiveOrgSlug)) {
      setStage('before');
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
      toast.success(t('anonymous.toast.credentialsCreated'));
    } catch (error) {
      if (isAckOutdated(error)) {
        setAckNotice(ackOutdatedMessage(error) || t('beforeYouReport.outdated'));
        setStage('before');
        return;
      }
      console.error('Failed to initialize:', error);
      toast.error(describeError(error).summary || t('anonymous.toast.initFailed'));
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
        effectiveOrgSlug || credentials.organization_slug || undefined,
        { quiet: true },
      );

      // Ensure credentials are in localStorage before moving to form stage
      // (in case user refreshed page or localStorage was cleared)
      localStorage.setItem('reportCredentials', JSON.stringify(credentials));

      setSelectedType(type);
      setStage('form');
      // toast.success(`Report type "${type.name}" selected.`);
    } catch (error) {
      // 403 anonymous_not_allowed carries { code, message }; older errors a string.
      toast.error(describeError(error).summary || t('anonymous.toast.selectTypeFailed'));
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
      ? t('anonymous.copyText', { number: credentials.reportNumber, password: credentials.password })
      : t('anonymous.copyTextNoPassword', { number: credentials.reportNumber });
    const copied = await copyToClipboard(text);
    if (copied) {
      toast.success(t('anonymous.toast.copied'));
    } else {
      toast.error(t('anonymous.toast.copyFailed'));
    }
  };

  // Handle download credentials
  const handleDownloadCredentials = () => {
    if (!credentials) return;
    const fileValues = {
      number: credentials.reportNumber,
      password: credentials.password,
      trackUrl: `${window.location.origin}/track-report`,
      date: new Date().toLocaleString(intlLocale()),
    };
    const content = hasReportPassword
      ? t('anonymous.file.withPassword', fileValues)
      : t('anonymous.file.account', fileValues);

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
          title: t('anonymous.tour.howTitle'),
          content: t('anonymous.tour.howBody'),
          placement: 'bottom',
          skipBeacon: true,
        },
        {
          target: '[data-tour="anon-password-options"]',
          title: t('anonymous.tour.passwordTitle'),
          content: t('anonymous.tour.passwordBody'),
          // Beside the options, on the side away from the reading start.
          placement: isDesktop ? (document.documentElement.dir === 'rtl' ? 'left' : 'right') : 'bottom',
        },
        {
          target: '[data-tour="anon-credentials-warning"]',
          title: t('anonymous.tour.saveTitle'),
          content: t('anonymous.tour.saveBody'),
          placement: 'top',
        },
        {
          target: '[data-tour="anon-start"]',
          title: t('anonymous.tour.startTitle'),
          content: t('anonymous.tour.startBody'),
          placement: 'top',
        },
      ];
    }

    if (stage === 'selectType') {
      const steps = [];

      if (credentials) {
        steps.push({
          target: '[data-tour="anon-credentials"]',
          title: t('anonymous.tour.credentialsTitle'),
          content: t('anonymous.tour.credentialsBody'),
          placement: 'bottom',
          skipBeacon: true,
        });
      }

      steps.push({
        target: '[data-tour="anon-types"]',
        title: t('anonymous.tour.typesTitle'),
        content: t('anonymous.tour.typesBody'),
        placement: 'top',
        skipBeacon: !credentials,
      });

      steps.push({
        target: '[data-tour="anon-info"]',
        title: t('anonymous.tour.nextTitle'),
        content: t('anonymous.tour.nextBody'),
        placement: isDesktop ? (document.documentElement.dir === 'rtl' ? 'right' : 'left') : 'top',
      });

      return steps;
    }

    return [];
  }, [stage, credentials, isDesktop, t]);

  const renderInitStage = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-accent-soft border border-line-accent rounded-2xl mb-4">
          <Key className="h-7 w-7 sm:h-8 sm:w-8 text-accent-fg" />
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink tracking-[-0.02em]">
          {t('anonymous.init.title')}
        </h1>
        <p className="text-ink-muted mt-3 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          {t('anonymous.init.intro')}
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
            <h3 className="font-semibold text-ink text-sm">{t('anonymous.init.howTitle')}</h3>
            <p className="text-sm text-ink-muted mt-1 leading-relaxed">
              {t('anonymous.init.howSteps')}
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
              title={t('anonymous.init.autoTitle')}
              description={t('anonymous.init.autoDesc')}
            />

            <PasswordOption
              checked={useCustomPassword}
              onChange={() => setUseCustomPassword(true)}
              title={t('anonymous.init.customTitle')}
              description={t('anonymous.init.customDesc')}
            >
              {useCustomPassword && (
                <div className="mt-3 ps-7">
                  <Input
 autoComplete="new-password"
                    label={t('anonymous.init.passwordLabel')}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={50}
                    helperText={
                      password.length > 0 && password.length < 6
                        ? t('anonymous.init.moreChars', { count: 6 - password.length })
                        : t('anonymous.init.minChars')
                    }
                    error={undefined}
                    endAdornment={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-ink-subtle transition-colors hover:text-ink"
                        aria-label={showPassword ? t('shared.hidePassword') : t('shared.showPassword')}
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
            <Alert variant="warning" title={t('anonymous.init.saveTitle')}>
              <Trans t={t} i18nKey="anonymous.init.saveBody" components={{ strong: <strong /> }} />
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
            {t('anonymous.init.start')}
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
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t('anonymous.select.back')}
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-success-soft border border-success-line rounded-2xl mb-4">
            <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 text-success-fg" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ink tracking-[-0.02em]">
            {t('anonymous.select.title')}
          </h1>
          <p className="text-ink-muted mt-3 text-sm sm:text-base">
            {t('anonymous.select.subtitle')}
          </p>
        </div>

        {/* Credentials Display */}
        {credentials && (
          <Card className="mb-8 bg-accent-soft border-line-accent" data-tour="anon-credentials">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* flex-1 so the two credential columns spread across the card
                  rather than collapsing to their content width */}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-ink mb-3 text-sm">{t('anonymous.select.credentialsTitle')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">
                      {t('anonymous.select.reportNumber')}
                    </span>
                    <div className="text-base sm:text-lg font-bold text-accent-fg font-mono break-all mt-0.5">
                      {credentials.reportNumber}
                    </div>
                  </div>
                  {hasReportPassword && (
                    <div className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-subtle">
                        {t('anonymous.select.password')}
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
                  {t('anonymous.select.copy')}
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleDownloadCredentials}
                  startIcon={Download}
                >
                  {t('anonymous.select.download')}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 mb-12">
        {/* Report Types Grid */}
        <div className="lg:col-span-2" data-tour="anon-types">
          {/* Types that refuse anonymous reports aren't listed to a signed-out reporter at all. */}
          {!user && !isLoadingTypes && (
            <p className="mb-3 text-sm text-ink-muted">
              <Trans
                t={t}
                i18nKey="anonymous.select.signInHint"
                components={{
                  lnk: <Link to={effectiveOrgSlug ? `/${effectiveOrgSlug}/login` : '/login'} className="font-medium text-link hover:underline" />,
                }}
              />
            </p>
          )}
          <ReportTypePicker
            types={reportTypes}
            loading={isLoadingTypes}
            onSelect={(type) => handleTypeSelect(type.id)}
            disabled={isLoading}
            wide={false}
            exits={deflection.exits}
            openDeflection={false}
          />
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4 lg:space-y-6" data-tour="anon-info">
          <Card>
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-success-soft text-success-fg">
                <Shield className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-ink text-sm">{t('anonymous.select.anonymityTitle')}</h3>
                <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                  {t('anonymous.select.anonymityBody')}
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
                <h3 className="font-semibold text-ink text-sm">{t('anonymous.select.secureTitle')}</h3>
                <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                  {t('anonymous.select.secureBody')}
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
                <h3 className="font-semibold text-ink text-sm">{t('anonymous.select.nextTitle')}</h3>
                <ul className="text-sm text-ink-muted mt-2 space-y-1.5">
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>{t('anonymous.select.next1')}</li>
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>{t('anonymous.select.next2')}</li>
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>{t('anonymous.select.next3')}</li>
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>{t('anonymous.select.next4')}</li>
                  <li className="flex gap-2"><span className="text-ink-subtle">•</span>{t('anonymous.select.next5')}</li>
                </ul>
              </div>
            </div>
          </Card>

          <Alert
            variant="warning"
            title={hasReportPassword ? t('anonymous.select.warnTitlePassword') : t('anonymous.select.warnTitleNumber')}
          >
            {hasReportPassword
              ? t('anonymous.select.warnBodyPassword')
              : t('anonymous.select.warnBodyNumber')}
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
      {/* The tour waits for the deflection popup, so the two never overlap. */}
      {TOUR_KEYS[stage] && !(stage === 'init' && (deflection.loading || deflecting)) && (
        <DashboardTour
          key={stage}
          ref={tourRef}
          storageKey={TOUR_KEYS[stage]}
          steps={tourSteps}
        />
      )}

      {stage === 'before' && (
        <BeforeYouReport
          slug={effectiveOrgSlug}
          notice={ackNotice}
          onContinue={() => {
            setAckNotice(null);
            setStage('init');
          }}
        />
      )}
      {stage === 'init' && renderInitStage()}
      <DeflectionModal isOpen={deflecting} onClose={() => setDeflectionClosed(true)} exits={deflection.exits} />
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
