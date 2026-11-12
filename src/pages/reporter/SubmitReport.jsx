import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const SubmitReport = () => {
  useSEO({
    title: 'Submit a Report',
    description: 'File a new report against your account so you can track and follow up on it.',
    noIndex: true,
  });
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [stage, setStage] = useState('typeSelection');
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
          toast.error('Failed to load report types');
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
      setStage('typeSelection');
      setSelectedType(null);
    }, 3000);
  };

  if (!isAuthenticated) {
    return <LoadingSpinner message="Redirecting to login..." />;
  }

  const renderTypeSelection = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="mb-10">
        <button
          onClick={() => navigate(`/${user ? user?.organization_slug : ''}/reporter/dashboard`)}
          className="inline-flex items-center text-sm font-medium text-ink-muted hover:text-ink transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-ink mb-3">
            Submit a New Report
          </h1>
          <p className="text-lg text-ink-muted max-w-3xl">
            Choose the type of concern you'd like to report. All submissions are handled with confidentiality and care.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-accent-soft rounded-lg p-4 border border-line-accent">
            <div className="flex items-start">
              <Shield className="w-5 h-5 text-accent-fg mt-0.5 mr-3 shrink-0" />
              <div>
                <h3 className="font-semibold text-accent-fg text-sm mb-1">Secure & Confidential</h3>
                <p className="text-xs text-accent-fg">Your report is encrypted and protected</p>
              </div>
            </div>
          </div>

          <div className="bg-success-soft rounded-lg p-4 border border-success-line">
            <div className="flex items-start">
              <FileText className="w-5 h-5 text-success-fg mt-0.5 mr-3 shrink-0" />
              <div>
                <h3 className="font-semibold text-success-fg text-sm mb-1">Guided Process</h3>
                <p className="text-xs text-success-fg">Step-by-step form to help you report</p>
              </div>
            </div>
          </div>

          <div className="bg-accent-soft rounded-lg p-4 border border-line-accent">
            <div className="flex items-start">
              <Clock className="w-5 h-5 text-accent-fg mt-0.5 mr-3 shrink-0" />
              <div>
                <h3 className="font-semibold text-accent-fg text-sm mb-1">Timely Review</h3>
                <p className="text-xs text-accent-fg">Reports are reviewed promptly by our team</p>
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
      {stage === 'typeSelection' ? (
        renderTypeSelection()
      ) : selectedType ? (
        <MultiStepReportForm
          reportTypeId={selectedType.id}
          onSuccess={handleSuccess}
          onCancel={() => {
            setStage('typeSelection');
            setSelectedType(null);
          }}
          isAnonymous={false}
        />
      ) : null}
    </div>
  );
};

export default SubmitReport;
