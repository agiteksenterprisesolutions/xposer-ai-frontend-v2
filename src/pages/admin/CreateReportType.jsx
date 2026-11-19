// src/pages/admin/CreateReportType.jsx
//
// New report type: a short start screen (a name, a category, and a blank form
// or a copy of an existing type), then the three-step builder.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import { isRtl } from '../../utils/locale';
import { reportTypesAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { toBuilderShape, toReportTypePayload } from '../../utils/reportTypes';
import { staffPath } from '../../utils/navigation';
import DashboardTour from '../../components/tour/DashboardTour';
import useSEO from '../../hooks/useSEO';
import StartScreen from '../../components/reportTypeBuilder/StartScreen';
import ReportTypeEditor from '../../components/reportTypeBuilder/ReportTypeEditor';
import { asCopy, blankSections } from '../../components/reportTypeBuilder/model';
import { buildCatalog, seedSections } from '../../components/reportTypeBuilder/catalog';

const CREATE_REPORT_TYPE_TOUR_KEY = 'xposer_create_report_type_tour_v2_seen';

const CreateReportType = () => {
  const { t, i18n } = useTranslation('reportTypes');
  useSEO({
    title: t('create.seoTitle'),
    description: t('create.seoDescription'),
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
        title: t('create.tour.stepsTitle'),
        content: t('create.tour.stepsBody'),
        placement: 'bottom',
        skipBeacon: true,
      },
      {
        target: '[data-tour="rtb-canvas"]',
        title: t('create.tour.canvasTitle'),
        content: t('create.tour.canvasBody'),
        placement: isRtl() ? 'left' : 'right',
      },
      {
        target: '[data-tour="rtb-add-question"]',
        title: t('create.tour.addTitle'),
        content: t('create.tour.addBody'),
        placement: 'top',
      },
      {
        target: '[data-tour="rtb-inspector"]',
        title: t('create.tour.inspectorTitle'),
        content: t('create.tour.inspectorBody'),
        placement: isRtl() ? 'right' : 'left',
      },
      {
        target: '[data-tour="rtb-preview"]',
        title: t('create.tour.previewTitle'),
        content: t('create.tour.previewBody'),
        placement: 'bottom',
      },
    ],
    [t, i18n.resolvedLanguage],
  );

  const begin = async ({ name, category, mode, copyId }) => {
    if (mode === 'scratch') {
      // A new type starts with the standard questions that are on by default,
      // each in its step; without the catalogue, with one empty step.
      setStarting(true);
      const catalog = await reportTypesAPI
        .fieldCatalog()
        .then(buildCatalog)
        .catch(() => null);
      setStarting(false);
      const seeded = catalog ? seedSections(catalog) : [];
      setStart({ name, category, sections: seeded.length ? seeded : blankSections() });
      return;
    }
    setStarting(true);
    try {
      const source = await reportTypesAPI.getReportType(copyId);
      const copy = asCopy(toBuilderShape(source), name);
      setStart(category ? { ...copy, category } : copy);
    } catch {
      toast.error(t('create.copyFailed'));
    } finally {
      setStarting(false);
    }
  };

  const save = async (form) => {
    setSaving(true);
    try {
      const created = await reportTypesAPI.createReportType(toReportTypePayload(form));
      toast.success(form.status === 'draft' ? t('create.savedDraft', { name: form.name }) : t('create.published', { name: form.name }));
      // Saved, but the server found something that will stop cases being
      // handled (an owner role nobody holds, say): open it where that shows.
      const createdId = created?.id || created?._id;
      if (createdId && created.governance_problems?.length) {
        navigate(staffPath(user?.organization_slug, `report-types/${createdId}`), { state: { step: 'handling' } });
      } else {
        navigate(listPath);
      }
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
