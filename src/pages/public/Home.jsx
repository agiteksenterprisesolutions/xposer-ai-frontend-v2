// src/pages/public/Home.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { reportsAPI } from '../../api';
import useSEO from '../../hooks/useSEO';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import { canSubmitAnonymousReport } from '../../utils/roles';
import { getHomePath } from '../../utils/navigation';

const HOME_TOUR_KEY = 'xposer_home_tour_seen';

// Labels are keys under public:home.triage.items, translated at render.
const triageItems = [
  { key: 'financial', dot: 'bg-red-400', badge: 'high', badgeClass: 'bg-amber-400/10 text-amber-400' },
  { key: 'safety', dot: 'bg-amber-400', badge: 'medium', badgeClass: 'bg-blue-400/10 text-blue-400' },
  { key: 'hr', dot: 'bg-emerald-400', badge: 'triaged', badgeClass: 'bg-emerald-400/10 text-emerald-400' },
];

const Home = () => {
  const { t } = useTranslation('public');
  useSEO({
    title: t('home.seo.title'),
    titleTemplate: null,
    description: t('home.seo.description'),
    keywords: ['whistleblowing', 'anonymous reporting', 'compliance', 'AI triage', 'speak up platform'],
  });
  const { user } = useAuthStore();
  const { orgSlug } = useParams();
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();
  // const [trustStats, setTrustStats] = useState([
  //   { label: 'Reports', value: '—' },
  //   { label: 'Resolved', value: '—' },
  //   { label: 'Anonymous', value: '—' },
  //   { label: 'Active Users', value: '—' },
  // ]);

  // useEffect(() => {
  //   const fetchTrustStats = async () => {
  //     try {
  //       const data = await reportsAPI.getStats();
  //       setTrustStats([
  //         { label: 'Reports', value: data.total_reports ?? '—' },
  //         { label: 'Resolved', value: data.resolved ?? '—' },
  //         { label: 'Anonymous', value: data.anonymous ?? '—' },
  //         { label: 'Active Users', value: data.active_users ?? '—' },
  //       ]);
  //     } catch (e) {
  //       console.error('Error fetching trust indicators:', e);
  //     }
  //   };
  //   fetchTrustStats();
  // }, []);

  const dashboardLink = user
    ? getHomePath(user) || `/${user.organization_slug}`
    : '/login';

  // The hero is the whole page, so the tour walks the pitch, the two CTAs, and
  // the triage panel. The submit CTA only renders under an org slug, so its
  // step has to drop out with it or Joyride stalls on a missing target.
  const tourSteps = useMemo(() => {
    const steps = [
      // {
      //   target: '[data-tour="tour-hero"]',
      //   title: 'Speak up, safely',
      //   content:
      //     'Xposer AI takes a report from the moment it happens to an audit-ready case — encrypted, and without exposing who filed it.',
      //   placement: 'bottom',
      //   skipBeacon: true,
      // },
    ];

    if (orgSlug) {
      steps.push({
        target: '[data-tour="tour-submit"]',
        title: t('home.tour.submit.title'),
        content: t('home.tour.submit.content'),
        placement: 'top',
      });
    }

    steps.push(
      {
        target: '[data-tour="tour-dashboard"]',
        title: user ? t('home.tour.dashboard.title') : t('home.tour.team.title'),
        content: user ? t('home.tour.dashboard.content') : t('home.tour.team.content'),
        placement: 'top',
      },
      // {
      //   target: '[data-tour="tour-triage"]',
      //   title: 'AI triage, in seconds',
      //   content:
      //     'Every report is categorized and prioritized automatically, so urgent cases reach the right people first.',
      //   placement: isDesktop ? 'left' : 'top',
      // }
    );

    // Whichever step leads has to open the tooltip directly; without this
    // Joyride parks on a beacon dot and waits for a click.
    if (steps.length) steps[0] = { ...steps[0], skipBeacon: true };

    return steps;
  }, [orgSlug, user, isDesktop, t]);

  return (
    <>
      <DashboardTour ref={tourRef} storageKey={HOME_TOUR_KEY} steps={tourSteps} />

      <div className="bg-canvas text-ink font-sans antialiased">

        {/* HERO */}
        <section className="relative min-h-screen flex items-center px-6 pt-28 pb-20 overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,217,126,0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 80%, rgba(79,142,247,0.06) 0%, transparent 50%)',
            }}
          />

          <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left: headline */}
            <div data-tour="tour-hero">
              <h1 className="font-extrabold text-[2.6rem] sm:text-5xl lg:text-6xl rtl:text-[2.2rem] rtl:sm:text-4xl rtl:lg:text-5xl leading-[1.06] rtl:leading-[1.3] tracking-[-0.03em] text-balance mb-6">
                {t('home.hero.line1')}{' '}
                <span className="relative inline-block">
                  {t('home.hero.line2')}
                  <span
                    aria-hidden="true"
                    className="absolute inset-s-0 -bottom-1 h-0.75 w-full rounded-full bg-accent-fg/60"
                  />
                </span>{' '}
                <span className="block mt-3 text-accent-fg text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.12] font-bold">
                  {t('home.hero.line3')}
                </span>
              </h1>

              <p className="text-ink-muted text-base sm:text-[1.0625rem] leading-[1.75] text-pretty max-w-xl mb-9 font-light">
                {t('home.hero.lead')}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {orgSlug && canSubmitAnonymousReport(user) && (
                  <Link
                    to={`/${user?.organization_slug ?? orgSlug}/submit-anonymous`}
                    data-tour="tour-submit"
                    className="group inline-flex items-center gap-2 bg-accent-fg text-canvas text-[14.5px] font-semibold px-6 py-3 rounded-lg border border-line-accent shadow-[0_8px_24px_-8px_var(--color-accent-ring)] transition-all duration-200 hover:bg-transparent hover:text-accent-fg hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-8px_var(--color-accent-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                  >
                    {t('home.cta.submit')}
                    <ArrowRight size={15} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                  </Link>
                )}
                <Link
                  to={dashboardLink}
                  data-tour="tour-dashboard"
                  className="inline-flex items-center gap-2 border border-line text-ink-muted text-[14.5px] font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:text-ink hover:border-line-strong hover:bg-subtle hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  {user ? t('home.cta.dashboard') : t('home.cta.teamLogin')}
                </Link>
              </div>
            </div>

            {/* Right: AI triage panel mockup */}
            <div className="relative">
              <div className="absolute -top-6 -inset-e-4 sm:inset-e-2 bg-subtle border border-line-subtle rounded-xl px-5 py-3 shadow-2xl z-10">
                <div className="text-accent-fg font-bold text-2xl leading-none">0.8s</div>
                <div className="text-ink-subtle text-xs mt-1">{t('home.triage.avgTime')}</div>
              </div>

              <div className="bg-subtle/90 border border-line-subtle rounded-2xl p-6 shadow-2xl backdrop-blur-sm ring-1 ring-line-subtle/40" data-tour="tour-triage">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-lg bg-accent-soft flex items-center justify-center shrink-0">
                    <Shield className="text-accent-fg" size={20} />
                  </div>
                  <div>
                    <div className="font-semibold text-ink text-[15px]">{t('home.triage.active')}</div>
                    <div className="text-ink-subtle text-[13px]">{t('home.triage.processing', { count: 3 })}</div>
                  </div>
                </div>

                <div className="flex flex-col gap-1 mb-6">
                  {triageItems.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 py-3 border-b border-line-subtle last:border-b-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                        <span className="text-ink-muted text-[13.5px] truncate">{t(`home.triage.items.${item.key}`)}</span>
                      </div>
                      <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${item.badgeClass}`}>
                        {t(`home.triage.badges.${item.badge}`)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[13px] text-ink-subtle mb-2">
                  <span>{t('home.triage.aiProcessing')}</span>
                  <span>53%</span>
                </div>
                <div className="h-1.5 rounded-full bg-sunken border border-line-subtle overflow-hidden">
                  <div className="h-full w-[53%] rounded-full bg-accent-fg" />
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  );
};

export default Home;
