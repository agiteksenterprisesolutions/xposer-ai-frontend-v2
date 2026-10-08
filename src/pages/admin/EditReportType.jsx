// src/pages/admin/EditReportType.jsx
//
// Editing a report type in the three-step builder. After a save the editor is
// reseeded from the server's copy, so new questions pick up their real ids
// and the next save edits them in place.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { reportTypesAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import { staffPath } from '../../utils/navigation';
import { toReportTypePayload, toBuilderShape } from '../../utils/reportTypes';
import ReportTypeEditor from '../../components/reportTypeBuilder/ReportTypeEditor';
import ReportTypeEditorSkeleton from '../../components/reportTypeBuilder/ReportTypeEditorSkeleton';
import { fromLoaded } from '../../components/reportTypeBuilder/model';

const EditReportType = () => {
  const { id } = useParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const listPath = staffPath(user?.organization_slug, 'report-types');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reportType, setReportType] = useState(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  // The step open when a save reseeds the editor, so it stays put.
  const stepRef = useRef(location.state?.step || 'questions');

  useSEO({
    enabled: !loading && !!reportType,
    title: reportType ? `Edit — ${reportType.name}` : '',
    description: reportType?.description,
    noIndex: true,
  });

  useEffect(() => {
    let live = true;
    setLoading(true);
    reportTypesAPI
      .getReportType(id)
      .then((data) => live && setReportType(data))
      .catch(() => live && setError("Couldn't load this report type. Try again."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id]);

  const save = async (form) => {
    setSaving(true);
    try {
      // Every field survives the round trip — governance fields, core-field
      // flags, option labels and section keys included.
      const saved = await reportTypesAPI.updateReportType(id, toReportTypePayload(form, { keepIds: true }));
      // governance_problems reflect the settings just saved; fetch them if
      // the save didn't send them back.
      const fresh =
        saved?.sections && Array.isArray(saved.governance_problems)
          ? saved
          : await reportTypesAPI.getReportType(id).catch(() => saved);
      if (fresh?.sections) {
        setReportType(fresh);
        setVersion((v) => v + 1);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ReportTypeEditorSkeleton />;

  if (error || !reportType) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Alert variant="error">{error || 'Report type not found'}</Alert>
        <Button variant="secondary" onClick={() => navigate(listPath)} startIcon={ArrowLeft} className="mt-4">
          Back to report types
        </Button>
      </div>
    );
  }

  return (
    <ReportTypeEditor
      key={`${reportType.id || reportType._id}-${version}`}
      initialData={fromLoaded(toBuilderShape(reportType))}
      isNew={false}
      codeLocked={Boolean(reportType.code)}
      problems={reportType.governance_problems || []}
      saving={saving}
      onSave={save}
      onExit={() => navigate(listPath)}
      initialStep={stepRef.current}
      onStepChange={(step) => {
        stepRef.current = step;
      }}
    />
  );
};

export default EditReportType;
