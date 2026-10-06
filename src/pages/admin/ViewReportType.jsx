// src/pages/admin/ViewReportType.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import ReportTypeBuilderSkeleton from '../../components/forms/ReportTypeBuilderSkeleton';
import ReportTypeBuilder from '../../components/forms/ReportTypeBuilder';
import { reportTypesAPI } from '../../api';
import { toast } from 'react-toastify';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { toBuilderShape } from '../../utils/reportTypes';

/**
 * Read-only counterpart to EditReportType: the same builder, locked to its
 * preview, so the page shows only the form as a reporter would meet it. The
 * Edit button hands off to the editor.
 */
const ViewReportType = () => {
  const { id } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const canManage = useCan()(PERM.reportTypeManage);

  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState(null);
  const [error, setError] = useState('');

  useSEO({
    enabled: !loading && !!reportType,
    title: reportType ? `${reportType.name}` : '',
    description: reportType?.description,
    noIndex: true,
  });

  useEffect(() => {
    let cancelled = false;

    const loadReportType = async () => {
      setLoading(true);
      try {
        const data = await reportTypesAPI.getReportType(id);
        if (!cancelled) setReportType(data);
      } catch (err) {
        console.error('Failed to load report type:', err);
        if (!cancelled) setError('Failed to load report type. Please try again.');
        toast.error('Failed to load report type');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadReportType();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const listPath = `/${user?.organization_slug}/staff/report-types`;

  if (loading) return <ReportTypeBuilderSkeleton mode="view" />;

  if (error || !reportType) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Alert variant="error">
          <div className="flex items-center">
            {error || 'Report type not found'}
          </div>
        </Alert>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate(listPath)} startIcon={ArrowLeft}>
            Back to Report Types
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ReportTypeBuilder
      initialData={toBuilderShape(reportType)}
      readOnly
      onEdit={canManage ? () => navigate(`${listPath}/${id}`) : undefined}
      onBack={() => navigate(listPath)}
    />
  );
};

export default ViewReportType;
