// src/pages/admin/CreateReportType.jsx
//
// New report type: a short start screen (a name, a category, and a blank form
// or a copy of an existing type), then the three-step builder.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { reportTypesAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { toBuilderShape, toReportTypePayload } from '../../utils/reportTypes';
import { staffPath } from '../../utils/navigation';
import DashboardTour from '../../components/tour/DashboardTour';
import useSEO from '../../hooks/useSEO';
import StartScreen from '../../components/reportTypeBuilder/StartScreen';
import ReportTypeEditor from '../../components/reportTypeBuilder/ReportTypeEditor';
import { asCopy, blankSections } from '../../components/reportTypeBuilder/model';

const CREATE_REPORT_TYPE_TOUR_KEY = 'xposer_create_report_type_tour_v2_seen';

const CreateReportType = () => {
  useSEO({
    title: 'New report type',
    description: 'Define a new report category and build its intake form.',
    noIndex: true,
  });
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const listPath = staffPath(user?.organization_slug, 'report-types');
  const [start, setStart] = useState(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);

  const tourSteps = useMemo(
    () => [
      {
        target: '[data-tour="rtb-steps"]',
        title: 'Three short steps',
        content: 'Write the questions, set how reports are handled, then review and publish. Move between them at any time.',
        placement: 'bottom',
        skipBeacon: true,
      },
      {
        target: '[data-tour="rtb-canvas"]',
        title: 'The form as reporters see it',
        content: 'One step at a time. Click a question or the step title to change it.',
        placement: 'right',
      },
      {
        target: '[data-tour="rtb-add-question"]',
        title: 'Add questions',
        content: 'The common question types are one click away. "More types" has the rest.',
        placement: 'top',
      },
      {
        target: '[data-tour="rtb-inspector"]',
        title: 'Settings for what you selected',
        content: 'Wording, whether it is required, when it is shown, and how sensitive the answer is.',
        placement: 'left',
      },
      {
        target: '[data-tour="rtb-preview"]',
        title: 'Preview',
        content: 'Page through the form exactly as a reporter would, on desktop or phone.',
        placement: 'bottom',
      },
    ],
    [],
  );

  const begin = async ({ name, category, mode, copyId }) => {
    if (mode === 'scratch') {
      setStart({ name, category, sections: blankSections() });
      return;
    }
    setStarting(true);
    try {
      const source = await reportTypesAPI.getReportType(copyId);
      const copy = asCopy(toBuilderShape(source), name);
      setStart(category ? { ...copy, category } : copy);
    } catch {
      toast.error("Couldn't load that report type. Try again.");
    } finally {
      setStarting(false);
    }
  };

  const save = async (form) => {
    setSaving(true);
    try {
      await reportTypesAPI.createReportType(toReportTypePayload(form));
      toast.success(form.status === 'draft' ? `"${form.name}" saved as a draft` : `"${form.name}" is published`);
      navigate(listPath);
      return true;
    } catch {
      // createReportType has already shown the server's reason.
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (!start) {
    return <StartScreen onStart={begin} onCancel={() => navigate(listPath)} starting={starting} />;
  }

  return (
    <>
      <DashboardTour storageKey={CREATE_REPORT_TYPE_TOUR_KEY} steps={tourSteps} />
      <ReportTypeEditor initialData={start} isNew saving={saving} onSave={save} onExit={() => navigate(listPath)} />
    </>
  );
};

export default CreateReportType;
