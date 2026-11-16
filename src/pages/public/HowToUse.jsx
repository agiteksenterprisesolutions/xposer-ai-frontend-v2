// src/pages/public/HowToUse.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BookOpen,
  LogIn,
  Ghost,
  Bot,
  UserCheck,
  Search,
  ShieldCheck,
  Key,
  Copy,
  Download,
  MessageCircle,
  Mic,
  Paperclip,
  FileText,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import Card from '../../components/ui/Card';
import Alert from '../../components/ui/Alert';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';

/**
 * Reporter-facing walkthrough of the whole product: signing in, reporting
 * anonymously, using the AI assistant, and reporting from an account.
 *
 * The screenshots in /public/guide are captures of the real screens, so when a
 * screen changes materially they need re-capturing alongside the copy here.
 */

// Labels are keys under public:howTo.nav, translated at render.
const SECTIONS = [
  { id: 'overview', icon: BookOpen },
  { id: 'login', icon: LogIn },
  { id: 'anonymous', icon: Ghost },
  { id: 'tracking', icon: Search },
  { id: 'ai-widget', icon: Bot },
  { id: 'account', icon: UserCheck },
];

/** A numbered instruction with a heading and body text. */
const Step = ({ n, title, children }) => (
  <li className="flex gap-4">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-fg text-[13px] font-semibold border border-line-accent">
      {n}
    </span>
    <div className="min-w-0 pt-0.5">
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <div className="text-sm text-ink-muted mt-1 leading-relaxed">{children}</div>
    </div>
  </li>
);

/** Screenshot of a real screen, with a caption underneath. */
const Shot = ({ src, alt, caption }) => (
  <figure className="mt-6">
    <div className="overflow-hidden rounded-xl border border-line bg-subtle shadow-sm">
      <img src={src} alt={alt} loading="lazy" className="block w-full h-auto" />
    </div>
    {caption && (
      <figcaption className="mt-2 text-xs text-ink-subtle leading-relaxed">
        {caption}
      </figcaption>
    )}
  </figure>
);

const Section = ({ id, icon: Icon, eyebrow, title, intro, children }) => (
  <section id={id} className="scroll-mt-24">
    <div className="flex items-start gap-3 mb-4">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-fg border border-line-accent">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
          {eyebrow}
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-[-0.01em]">
          {title}
        </h2>
      </div>
    </div>
    {intro && (
      <p className="text-sm sm:text-base text-ink-muted leading-relaxed mb-6 max-w-3xl">
        {intro}
      </p>
    )}
    {children}
  </section>
);

const B = <strong className="text-ink" />;

const HowToUse = () => {
  const { t } = useTranslation('public');
  useSEO({
    title: t('howTo.seo.title'),
    description: t('howTo.seo.description'),
    keywords: ['how to report', 'whistleblowing guide', 'anonymous reporting help'],
  });

  const { orgSlug: paramSlug } = useParams();
  const { user } = useAuthStore();
  const orgSlug = user?.organization_slug ?? paramSlug;
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  /** Org-scoped paths, falling back to the root routes when no org is in play. */
  const path = useMemo(() => {
    const base = orgSlug ? `/${orgSlug}` : '';
    return {
      login: `${base}/login`,
      submitAnonymous: orgSlug ? `/${orgSlug}/submit-anonymous` : '/login',
      trackReport: `${base}/track-report`,
      help: `${base}/help`,
      security: `${base}/security`,
    };
  }, [orgSlug]);

  // Highlight the section currently in view in the side nav.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  /** Translated rich text: <b> bold, <code> inline code, <a> in-page link. */
  const rich = (key, values) => (
    <Trans
      t={t}
      i18nKey={key}
      values={values}
      components={{
        b: B,
        strong: <strong />,
        code: <code dir="ltr" className="font-mono text-[13px] text-ink bg-subtle border border-line rounded px-1.5 py-0.5" />,
        anon: <a href="#anonymous" className="text-link underline underline-offset-2 hover:text-link-hover" />,
      }}
    />
  );

  return (
    <div className="min-h-screen bg-canvas px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-28 sm:pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <header className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-soft border border-line-accent mb-4">
            <BookOpen className="h-7 w-7 text-accent-fg" aria-hidden="true" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-[-0.02em]">
            {t('howTo.title')}
          </h1>
          <p className="text-ink-muted mt-3 text-sm sm:text-base leading-relaxed">
            {t('howTo.lead')}
          </p>
        </header>

        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-8 lg:gap-12">
          {/* Section nav */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1" aria-label={t('howTo.navLabel')}>
              {SECTIONS.map(({ id, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm no-underline transition-colors ${activeId === id
                    ? 'bg-accent-soft text-accent-fg font-medium'
                    : 'text-ink-muted hover:text-ink hover:bg-hover'
                    }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {t(`howTo.nav.${id}`)}
                </a>
              ))}
            </nav>
          </aside>

          {/* A <div>: the layout already renders the page's <main>. */}
          <div className="min-w-0 space-y-14 sm:space-y-20">
            {/* ── Overview ─────────────────────────────────────────────── */}
            <Section
              id="overview"
              icon={BookOpen}
              eyebrow={t('howTo.overview.eyebrow')}
              title={t('howTo.overview.title')}
              intro={t('howTo.overview.intro')}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <Card hover>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle border border-line text-ink-muted">
                      <Ghost className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink">{t('howTo.overview.anon.title')}</h3>
                      <p className="text-sm text-ink-muted mt-1 leading-relaxed">{t('howTo.overview.anon.body')}</p>
                      <p className="text-xs text-ink-subtle mt-2">{t('howTo.overview.anon.best')}</p>
                    </div>
                  </div>
                </Card>

                <Card hover>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle border border-line text-ink-muted">
                      <UserCheck className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink">{t('howTo.overview.account.title')}</h3>
                      <p className="text-sm text-ink-muted mt-1 leading-relaxed">{t('howTo.overview.account.body')}</p>
                      <p className="text-xs text-ink-subtle mt-2">{t('howTo.overview.account.best')}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <Alert variant="info" title={t('howTo.overview.control.title')} className="mt-4">
                {t('howTo.overview.control.body')}
              </Alert>
            </Section>

            {/* ── Login ────────────────────────────────────────────────── */}
            <Section
              id="login"
              icon={LogIn}
              eyebrow={t('howTo.stepN', { n: 1 })}
              title={t('howTo.login.title')}
              intro={t('howTo.login.intro')}
            >
              <Card>
                <ol className="space-y-5">
                  <Step n="1" title={t('howTo.login.s1.title')}>
                    {rich('howTo.login.s1.body', { slug: orgSlug || t('howTo.login.slugExample') })}
                  </Step>
                  <Step n="2" title={t('howTo.login.s2.title')}>{t('howTo.login.s2.body')}</Step>
                  <Step n="3" title={t('howTo.login.s3.title')}>{t('howTo.login.s3.body')}</Step>
                  <Step n="4" title={t('howTo.login.s4.title')}>{rich('howTo.login.s4.body')}</Step>
                </ol>

                <Shot
                  src="/guide/login.webp"
                  alt={t('howTo.login.shot.alt')}
                  caption={t('howTo.login.shot.caption')}
                />
              </Card>

              <Alert variant="warning" title={t('howTo.login.forgot.title')} className="mt-4">
                {t('howTo.login.forgot.body')}
              </Alert>
            </Section>

            {/* ── Anonymous reporting ──────────────────────────────────── */}
            <Section
              id="anonymous"
              icon={Ghost}
              eyebrow={t('howTo.stepN', { n: 2 })}
              title={t('howTo.anon.title')}
              intro={t('howTo.anon.intro')}
            >
              <Card>
                <h3 className="text-sm font-semibold text-ink mb-4">{t('howTo.anon.stage1.title')}</h3>
                <ol className="space-y-5">
                  <Step n="1" title={t('howTo.anon.stage1.s1.title')}>{rich('howTo.anon.stage1.s1.body')}</Step>
                  <Step n="2" title={t('howTo.anon.stage1.s2.title')}>{rich('howTo.anon.stage1.s2.body')}</Step>
                  <Step n="3" title={t('howTo.anon.stage1.s3.title')}>{t('howTo.anon.stage1.s3.body')}</Step>
                </ol>

                <Shot
                  src="/guide/anon-credentials.webp"
                  alt={t('howTo.anon.stage1.shot.alt')}
                  caption={t('howTo.anon.stage1.shot.caption')}
                />
              </Card>

              <Alert variant="warning" title={t('howTo.anon.save.title')} className="mt-4">
                {rich('howTo.anon.save.body')}
              </Alert>

              <Card className="mt-6">
                <h3 className="text-sm font-semibold text-ink mb-4">{t('howTo.anon.stage2.title')}</h3>
                <ol className="space-y-5">
                  <Step n="1" title={t('howTo.anon.stage2.s1.title')}>
                    <Trans
                      t={t}
                      i18nKey="howTo.anon.stage2.s1.body"
                      components={{
                        copy: <span className="inline-flex items-center gap-1 align-middle" />,
                        copyIcon: <Copy className="h-3.5 w-3.5" aria-hidden="true" />,
                        download: <span className="inline-flex items-center gap-1 align-middle" />,
                        downloadIcon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
                      }}
                    />
                  </Step>
                  <Step n="2" title={t('howTo.anon.stage2.s2.title')}>{t('howTo.anon.stage2.s2.body')}</Step>
                </ol>

                <Shot
                  src="/guide/anon-select-type.webp"
                  alt={t('howTo.anon.stage2.shot.alt')}
                  caption={t('howTo.anon.stage2.shot.caption')}
                />
              </Card>

              <Card className="mt-6">
                <h3 className="text-sm font-semibold text-ink mb-4">{t('howTo.anon.stage3.title')}</h3>
                <ol className="space-y-5">
                  <Step n="1" title={t('howTo.anon.stage3.s1.title')}>{t('howTo.anon.stage3.s1.body')}</Step>
                  <Step n="2" title={t('howTo.anon.stage3.s2.title')}>{t('howTo.anon.stage3.s2.body')}</Step>
                  <Step n="3" title={t('howTo.anon.stage3.s3.title')}>{t('howTo.anon.stage3.s3.body')}</Step>
                </ol>

                <Shot
                  src="/guide/anon-form.webp"
                  alt={t('howTo.anon.stage3.shot.alt')}
                  caption={t('howTo.anon.stage3.shot.caption')}
                />
              </Card>
            </Section>

            {/* ── Tracking ─────────────────────────────────────────────── */}
            <Section
              id="tracking"
              icon={Search}
              eyebrow={t('howTo.stepN', { n: 3 })}
              title={t('howTo.track.title')}
              intro={t('howTo.track.intro')}
            >
              <Card>
                <ol className="space-y-5">
                  <Step n="1" title={t('howTo.track.s1.title')}>{t('howTo.track.s1.body')}</Step>
                  <Step n="2" title={t('howTo.track.s2.title')}>{t('howTo.track.s2.body')}</Step>
                  <Step n="3" title={t('howTo.track.s3.title')}>{rich('howTo.track.s3.body')}</Step>
                  <Step n="4" title={t('howTo.track.s4.title')}>{t('howTo.track.s4.body')}</Step>
                </ol>

                <Shot
                  src="/guide/track-report.webp"
                  alt={t('howTo.track.shot.alt')}
                  caption={t('howTo.track.shot.caption')}
                />
              </Card>
            </Section>

            {/* ── AI widget ────────────────────────────────────────────── */}
            <Section
              id="ai-widget"
              icon={Bot}
              eyebrow={t('howTo.ai.eyebrow')}
              title={t('howTo.ai.title')}
              intro={t('howTo.ai.intro')}
            >
              <Card>
                <ol className="space-y-5">
                  <Step n="1" title={t('howTo.ai.s1.title')}>
                    <span className="inline-flex items-center gap-1 align-middle">
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>{' '}
                    {t('howTo.ai.s1.body')}
                  </Step>
                  <Step n="2" title={t('howTo.ai.s2.title')}>{rich('howTo.ai.s2.body')}</Step>
                  <Step n="3" title={t('howTo.ai.s3.title')}>{rich('howTo.ai.s3.body')}</Step>
                  <Step n="4" title={t('howTo.ai.s4.title')}>{t('howTo.ai.s4.body')}</Step>
                </ol>

                <div className="grid sm:grid-cols-2 gap-6">
                  <Shot
                    src="/guide/widget-home.webp"
                    alt={t('howTo.ai.shotHome.alt')}
                    caption={t('howTo.ai.shotHome.caption')}
                  />
                  <Shot
                    src="/guide/widget-password.webp"
                    alt={t('howTo.ai.shotPassword.alt')}
                    caption={t('howTo.ai.shotPassword.caption')}
                  />
                </div>

                <div className="mt-6 grid sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-line bg-subtle p-4">
                    <Mic className="h-4 w-4 text-accent-fg mb-2" aria-hidden="true" />
                    <h4 className="text-sm font-semibold text-ink">{t('howTo.ai.voice.title')}</h4>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">{t('howTo.ai.voice.body')}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-subtle p-4">
                    <Paperclip className="h-4 w-4 text-accent-fg mb-2" aria-hidden="true" />
                    <h4 className="text-sm font-semibold text-ink">{t('howTo.ai.attach.title')}</h4>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">{t('howTo.ai.attach.body')}</p>
                  </div>
                  <div className="rounded-xl border border-line bg-subtle p-4">
                    <Key className="h-4 w-4 text-accent-fg mb-2" aria-hidden="true" />
                    <h4 className="text-sm font-semibold text-ink">{t('howTo.ai.end.title')}</h4>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">{rich('howTo.ai.end.body')}</p>
                  </div>
                </div>
              </Card>

              <Alert variant="info" title={t('howTo.ai.helper.title')} className="mt-4">
                {t('howTo.ai.helper.body')}
              </Alert>
            </Section>

            {/* ── Account reporting ────────────────────────────────────── */}
            <Section
              id="account"
              icon={UserCheck}
              eyebrow={t('howTo.account.eyebrow')}
              title={t('howTo.account.title')}
              intro={t('howTo.account.intro')}
            >
              <Card>
                <h3 className="text-sm font-semibold text-ink mb-4">{t('howTo.account.dashboard.title')}</h3>
                <ul className="space-y-3 text-sm text-ink-muted">
                  {['counters', 'myReports', 'activity', 'tour'].map((key) => (
                    <li key={key} className="flex gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success-fg" aria-hidden="true" />
                      <span>{rich(`howTo.account.dashboard.${key}`)}</span>
                    </li>
                  ))}
                </ul>

                <Shot
                  src="/guide/reporter-dashboard.webp"
                  alt={t('howTo.account.dashboard.shot.alt')}
                  caption={t('howTo.account.dashboard.shot.caption')}
                />
              </Card>

              <Card className="mt-6">
                <h3 className="text-sm font-semibold text-ink mb-4">{t('howTo.account.file.title')}</h3>
                <ol className="space-y-5">
                  <Step n="1" title={t('howTo.account.file.s1.title')}>{rich('howTo.account.file.s1.body')}</Step>
                  <Step n="2" title={t('howTo.account.file.s2.title')}>{t('howTo.account.file.s2.body')}</Step>
                  <Step n="3" title={t('howTo.account.file.s3.title')}>{t('howTo.account.file.s3.body')}</Step>
                  <Step n="4" title={t('howTo.account.file.s4.title')}>{t('howTo.account.file.s4.body')}</Step>
                </ol>

                <div className="grid sm:grid-cols-2 gap-6">
                  <Shot
                    src="/guide/reporter-submit.webp"
                    alt={t('howTo.account.file.shotSubmit.alt')}
                    caption={t('howTo.account.file.shotSubmit.caption')}
                  />
                  <Shot
                    src="/guide/reporter-reports.webp"
                    alt={t('howTo.account.file.shotReports.alt')}
                    caption={t('howTo.account.file.shotReports.caption')}
                  />
                </div>
              </Card>

              <Alert variant="info" title={t('howTo.account.unnamed.title')} className="mt-4">
                {rich('howTo.account.unnamed.body')}
              </Alert>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToUse;
