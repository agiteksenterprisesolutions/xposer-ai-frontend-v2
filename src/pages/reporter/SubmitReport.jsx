import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  FileText,
  Shield,
  Clock,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Button from '../../components/ui/Button';
import MultiStepReportForm from '../../components/forms/MultiStepReportForm';
import { reportTypesAPI } from '../../api/reportTypes';
import LoadingSpinner from '../../components/layout/LoadingSpinner';
import { toast } from 'react-toastify';
import useSEO from '../../hooks/useSEO';
import { normalizeListResponse } from '../../utils/pagination';
import ReportTypePicker from '../../components/forms/ReportTypePicker';
import { useDeflectionExits } from '../../hooks/useDeflectionExits';
import BeforeYouReport from '../../components/reports/BeforeYouReport';
import { currentAckHash } from '../../store/reportAckStore';

const SubmitReport = () => {
  const { t } = useTranslation('submit');
  useSEO({
    title: t('reporterSubmit.seoTitle'),
    description: t('reporterSubmit.seoDescription'),
    noIndex: true,
  });
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  // 'beforeYouReport' (XPAI-114) → 'typeSelection' → 'multiStepForm'. Every
  // report starts by reading "Before you report".
  const [stage, setStage] = useState('beforeYouReport');
  // Set when the server refused a stale acknowledgement (409 ack_outdated).
  const [ackNotice, setAckNotice] = useState(null);
  const [reportTypes, setReportTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const deflection = useDeflectionExits(user?.organization_slug);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(`/${user ? user.organization_slug : ''}/login`, {
        state: { from: `/${user ? user.organization_slug : ''}/reporter/submit` }
      });
    } else {
      const fetchReportTypes = async () => {
        setIsLoadingTypes(true);
        try {
          // The picker shows every active type as a card, so pull the full set
          // rather than a single page of the API's envelope.
          const response = await reportTypesAPI.getReportTypes(true, false);
          setReportTypes(normalizeListResponse(response).items);
        } catch (error) {
          console.error('Failed to fetch report types:', error);
          toast.error(t('shared.loadTypesFailed'));
        } finally {
          setIsLoadingTypes(false);
        }
      };

      fetchReportTypes();
    }
  }, [isAuthenticated, navigate]);

  const handleTypeSelect = (typeId) => {
    const type = reportTypes.find(t => t.id === typeId);
    if (!type) return;

    setSelectedType(type);
    setStage('multiStepForm');
  };

  const handleSuccess = () => {
    setTimeout(() => {
      setStage('beforeYouReport');
      setSelectedType(null);
    }, 3000);
  };

  if (!isAuthenticated) {
    return <LoadingSpinner message={t('reporterSubmit.redirecting')} />;
  }

  const renderTypeSelection = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-10">
        <button
          onClick={() => navigate(`/${user ? user?.organization_slug : ''}/reporter/dashboard`)}
          className="inline-flex items-center text-sm font-medium text-ink-muted hover:text-ink transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 me-2 group-hover:-translate-x-1 rtl:group-hover:translate-x-1 transition-transform" />
          {t('reporterSubmit.back')}
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-ink mb-3">
            {t('reporterSubmit.title')}
          </h1>
          <p className="text-lg text-ink-muted max-w-3xl">
            {t('reporterSubmit.intro')}
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-accent-soft rounded-lg p-4 border border-line-accent">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-accent-fg mt-0.5 me-3 shrink-0" />
              <div>
                <h3 className="font-semibold text-accent-fg text-sm mb-1">{t('reporterSubmit.secureTitle')}</h3>
                <p className="text-xs text-accent-fg">{t('reporterSubmit.secureBody')}</p>
              </div>
            </div>
          </div>

          <div className="bg-success-soft rounded-lg p-4 border border-success-line">
            <div className="flex items-start">
              <FileText className="w-5 h-5 text-success-fg mt-0.5 me-3 shrink-0" />
              <div>
                <h3 className="font-semibold text-success-fg text-sm mb-1">{t('reporterSubmit.guidedTitle')}</h3>
                <p className="text-xs text-success-fg">{t('reporterSubmit.guidedBody')}</p>
              </div>
            </div>
          </div>

          <div className="bg-accent-soft rounded-lg p-4 border border-line-accent">
            <div className="flex items-start">
              <Clock className="w-5 h-5 text-accent-fg mt-0.5 me-3 shrink-0" />
              <div>
                <h3 className="font-semibold text-accent-fg text-sm mb-1">{t('reporterSubmit.timelyTitle')}</h3>
                <p className="text-xs text-accent-fg">{t('reporterSubmit.timelyBody')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report type picker: deflection, then category, then type. */}
      <ReportTypePicker
        types={reportTypes}
        loading={isLoadingTypes || deflection.loading}
        onSelect={(type) => handleTypeSelect(type.id)}
        exits={deflection.loading ? null : deflection.exits}
        key={deflection.loading ? 'loading' : 'ready'}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas py-8 sm:py-12">
      {stage === 'beforeYouReport' ? (
        <div className="px-4 sm:px-6 lg:px-8">
          <BeforeYouReport
            slug={user?.organization_slug}
            notice={ackNotice}
            onContinue={() => {
              setAckNotice(null);
              setStage('typeSelection');
            }}
          />
        </div>
      ) : stage === 'typeSelection' ? (
        renderTypeSelection()
      ) : selectedType ? (
        <MultiStepReportForm
          reportTypeId={selectedType.id}
          onSuccess={handleSuccess}
          onCancel={() => {
            // A started report used the acknowledgement; the next one reads the page again.
            setStage(currentAckHash(user?.organization_slug) ? 'typeSelection' : 'beforeYouReport');
            setSelectedType(null);
          }}
          onAckOutdated={(message) => {
            setAckNotice(message || t('beforeYouReport.outdated'));
            setSelectedType(null);
            setStage('beforeYouReport');
          }}
          isAnonymous={false}
        />
      ) : null}
    </div>
  );
};

export default SubmitReport;
