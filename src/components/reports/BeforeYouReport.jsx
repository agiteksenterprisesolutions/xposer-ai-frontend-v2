// src/components/reports/BeforeYouReport.jsx
//
// "Before you report" (XPAI-114). Shown before every report: before the
// report-type picker and before the AI assistant. The text comes from
// GET /organizations/by-slug/{slug}/before-you-report and is rendered as
// sent, in order; `key` only picks an icon. The reporter ticks the
// acknowledgement and continues; the page's content_hash goes into page
// memory (store/reportAckStore) and is sent on POST /reports/init.
//
// Loads nothing from third parties: the text is ours, the icons are bundled.
//
//   <BeforeYouReport slug="acme" onContinue={() => …} notice={…} />
//
// The API text can be in a different language from the interface, so each
// card takes its direction from its own text (dir="auto"), bullets included.
//
// `notice` is shown above the page, e.g. after a 409 ack_outdated ("the page
// changed, please read it again"). `compact` fits the chat panel.
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  Info,
  Lock,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { reportsAPI } from '../../api/reports';
import { useReportAckStore } from '../../store/reportAckStore';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';

const ICONS = {
  clarify_concern: ClipboardCheck,
  internal_resolution: Users,
  protect_confidentiality: Lock,
  understand_policy: BookOpen,
  personal_safety: ShieldAlert,
};

const BeforeYouReport = ({ slug, onContinue, onBack, notice = null, compact = false }) => {
  const { t } = useTranslation('submit');
  const acknowledge = useReportAckStore((s) => s.acknowledge);
  const [page, setPage] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [ticked, setTicked] = useState(false);
  const checkboxId = useId();
  const titleId = useId();

  const load = useCallback(async () => {
    setStatus('loading');
    setTicked(false);
    try {
      setPage(await reportsAPI.getBeforeYouReport(slug));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [slug]);

  // Reloaded whenever a notice arrives too: after a 409 the text may have changed.
  useEffect(() => {
    if (slug) load();
  }, [slug, load, notice]);

  const handleContinue = () => {
    if (!ticked || !page?.content_hash) return;
    acknowledge(page.content_hash, slug);
    onContinue?.(page.content_hash);
  };

  const sectionGap = compact ? 'gap-4' : 'gap-6';
  const headingSize = compact ? 'text-lg' : 'text-2xl sm:text-3xl';

  return (
    <section
      aria-labelledby={titleId}
      className={compact ? 'flex flex-col gap-4 text-start' : 'mx-auto w-full max-w-3xl flex flex-col gap-6 text-start'}
    >
      {notice && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-warning-line bg-warning-soft p-3 text-sm text-warning-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p dir="auto">{notice}</p>
        </div>
      )}

      {status === 'loading' && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t('beforeYouReport.loading')}</span>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-danger-line bg-danger-soft p-4 text-sm text-danger-fg">
          <h2 id={titleId} className="font-semibold">{t('beforeYouReport.loadFailedTitle')}</h2>
          <p>{t('beforeYouReport.loadFailedBody')}</p>
          <Button variant="secondary" size="small" onClick={load}>{t('common:actions.retry')}</Button>
        </div>
      )}

      {status === 'ready' && page && (
        <>
          <header dir="auto" className="flex flex-col gap-2">
            <h2 id={titleId} className={`${headingSize} font-bold text-ink`}>{page.title}</h2>
            {page.intro && <p className="text-ink-secondary leading-relaxed">{page.intro}</p>}
          </header>

          <ol className={`flex flex-col ${sectionGap}`}>
            {(page.sections || []).map((section, index) => {
              const Icon = ICONS[section.key] || Info;
              return (
                <li key={section.key || index} dir="auto" className="flex gap-3 rounded-xl border border-line bg-surface p-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-fg">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-ink">{section.heading}</h3>
                    {section.points?.length > 0 && (
                      <ul className="mt-2 flex list-disc flex-col gap-1.5 ps-5 text-sm text-ink-secondary leading-relaxed marker:text-ink-subtle">
                        {section.points.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-col gap-4 border-t border-line pt-4">
            <label htmlFor={checkboxId} className="flex cursor-pointer items-start gap-3 text-sm font-medium text-ink">
              <input
                id={checkboxId}
                type="checkbox"
                checked={ticked}
                onChange={(e) => setTicked(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--xp-accent)]"
              />
              <span dir="auto">{page.acknowledgement}</span>
            </label>
            <div className={`flex gap-3 ${compact ? 'flex-col-reverse' : 'flex-col-reverse sm:flex-row sm:justify-end'}`}>
              {onBack && (
                <Button variant="secondary" onClick={onBack} fullWidth={compact}>
                  {t('common:actions.back')}
                </Button>
              )}
              <Button onClick={handleContinue} disabled={!ticked} fullWidth={compact}>
                {t('beforeYouReport.continue')}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default BeforeYouReport;
