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

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'login', label: 'Signing in', icon: LogIn },
  { id: 'anonymous', label: 'Anonymous reporting', icon: Ghost },
  { id: 'tracking', label: 'Tracking a report', icon: Search },
  { id: 'ai-widget', label: 'AI assistant', icon: Bot },
  { id: 'account', label: 'Account reporting', icon: UserCheck },
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
        <Icon className="h-5 w-5" />
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

const HowToUse = () => {
  useSEO({
    title: 'How to Use Xposer AI',
    description:
      'A step-by-step guide for reporters: signing in, submitting an anonymous report, using the AI assistant, and reporting from your account.',
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

  return (
    <div className="min-h-screen bg-canvas px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-28 sm:pb-20">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <header className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent-soft border border-line-accent mb-4">
            <BookOpen className="h-7 w-7 text-accent-fg" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-[-0.02em]">
            How to use Xposer AI
          </h1>
          <p className="text-ink-muted mt-3 text-sm sm:text-base leading-relaxed">
            Everything a reporter needs: how to sign in, how to file a report
            without giving your name, how the AI assistant works, and how to
            follow a report through to its outcome.
          </p>
        </header>

        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-8 lg:gap-12">
          {/* Section nav */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1" aria-label="Guide sections">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm no-underline transition-colors ${activeId === id
                    ? 'bg-accent-soft text-accent-fg font-medium'
                    : 'text-ink-muted hover:text-ink hover:bg-hover'
                    }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 space-y-14 sm:space-y-20">
            {/* ── Overview ─────────────────────────────────────────────── */}
            <Section
              id="overview"
              icon={BookOpen}
              eyebrow="Start here"
              title="Two ways to report"
              intro="Every concern you raise reaches the same compliance team and is handled with the same care. The only decision you have to make up front is whether your name travels with the report."
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <Card hover>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle border border-line text-ink-muted">
                      <Ghost className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink">Anonymous report</h3>
                      <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                        No name, no email, no account. You get a report number and
                        password, and those credentials are the only link between
                        you and the report.
                      </p>
                      <p className="text-xs text-ink-subtle mt-2">
                        Best when you would rather not be identified at all.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card hover>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle border border-line text-ink-muted">
                      <UserCheck className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink">Account report</h3>
                      <p className="text-sm text-ink-muted mt-1 leading-relaxed">
                        Sign in with the account your organization gave you. Your
                        reports are collected in one dashboard, and the team can
                        reach you directly with follow-up questions.
                      </p>
                      <p className="text-xs text-ink-subtle mt-2">
                        Best when you want easy tracking and faster follow-up.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <Alert variant="info" title="Either way, you stay in control" className="mt-4">
                Both routes are encrypted, both let you follow progress, and both
                let you exchange messages with the compliance team without
                revealing anything you have not chosen to share.
              </Alert>
            </Section>

            {/* ── Login ────────────────────────────────────────────────── */}
            <Section
              id="login"
              icon={LogIn}
              eyebrow="Step 1"
              title="Signing in to your account"
              intro="Accounts are created by your organization — there is no public sign-up. If you have credentials, sign in from your organization's portal page."
            >
              <Card>
                <ol className="space-y-5">
                  <Step n="1" title="Open your organization's portal">
                    Your portal lives at a web address that ends in your
                    organization's name, for example{' '}
                    <code className="font-mono text-[13px] text-ink bg-subtle border border-line rounded px-1.5 py-0.5">
                      /{orgSlug || 'your-organization'}
                    </code>
                    . Use the link your organization shared with you, then choose{' '}
                    <strong className="text-ink">Login</strong>.
                  </Step>
                  <Step n="2" title="Enter your username and password">
                    Type the username or email address your organization issued,
                    then your password. Use the eye icon to reveal what you typed
                    if you want to double-check it.
                  </Step>
                  <Step n="3" title="You land on the right dashboard">
                    Signing in takes you straight to your dashboard. As a reporter
                    that is your reports overview.
                  </Step>
                  <Step n="4" title="No account? You can still report">
                    You do not need to sign in to raise a concern — skip ahead to{' '}
                    <a href="#anonymous" className="text-link hover:text-link-hover">
                      anonymous reporting
                    </a>
                    .
                  </Step>
                </ol>

                <Shot
                  src="/guide/login.webp"
                  alt="The Xposer AI sign-in screen with username and password fields"
                  caption="The sign-in screen. Passwords are never stored in readable form, and all traffic is encrypted."
                />
              </Card>

              <Alert variant="warning" title="Forgot your password?" className="mt-4">
                Password resets are handled by your organization's administrator.
              </Alert>
            </Section>

            {/* ── Anonymous reporting ──────────────────────────────────── */}
            <Section
              id="anonymous"
              icon={Ghost}
              eyebrow="Step 2"
              title="Submitting an anonymous report"
              intro="Anonymous reporting takes four steps: get credentials, choose a category, fill in the form, and submit. You are never asked for your name, email, or phone number."
            >
              <Card>
                <h3 className="text-sm font-semibold text-ink mb-4">
                  Stage 1 — Create your secure credentials
                </h3>
                <ol className="space-y-5">
                  <Step n="1" title="Open the anonymous report page">
                    Choose{' '}
                    <strong className="text-ink">Report now</strong> in the top
                    bar. You will land on{' '}
                    <strong className="text-ink">Start Anonymous Report</strong>.
                  </Step>
                  <Step n="2" title="Pick how your password is created">
                    Leave{' '}
                    <strong className="text-ink">Auto-generate secure password</strong>{' '}
                    selected — it produces a strong random password. Choose{' '}
                    <strong className="text-ink">Create your own password</strong>{' '}
                    only.
                  </Step>
                  <Step n="3" title="Select “Get Secure Credentials”">
                    This creates an empty, unsubmitted report and issues your
                    8-digit report number plus its password.
                  </Step>
                </ol>

                <Shot
                  src="/guide/anon-credentials.webp"
                  alt="Start Anonymous Report page showing password options and the Get Secure Credentials button"
                  caption="Stage 1. The “Take a tour” button replays a short walkthrough of this screen at any time."
                />
              </Card>

              <Alert variant="warning" title="Save your credentials before you go further" className="mt-4">
                Your report number and password cannot be recovered or reset —
                Use{' '}
                <strong>Copy</strong> or <strong>Download</strong> on the next
                screen and keep them somewhere only you can reach.
              </Alert>

              <Card className="mt-6">
                <h3 className="text-sm font-semibold text-ink mb-4">
                  Stage 2 — Choose a report type
                </h3>
                <ol className="space-y-5">
                  <Step n="1" title="Save the credentials shown at the top">
                    <span className="inline-flex items-center gap-1 align-middle">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </span>{' '}
                    puts both values on your clipboard;{' '}
                    <span className="inline-flex items-center gap-1 align-middle">
                      <Download className="h-3.5 w-3.5" /> Download
                    </span>{' '}
                    saves them as a text file.
                  </Step>
                  <Step n="2" title="Pick the closest category">
                    Each category asks a different set of questions. Pick the category that matches your concern.
                  </Step>
                </ol>

                <Shot
                  src="/guide/anon-select-type.webp"
                  alt="Select Report Type page showing report credentials and category cards"
                  caption="Stage 2. Your report number and password appear once, at the top of this screen."
                />
              </Card>

              <Card className="mt-6">
                <h3 className="text-sm font-semibold text-ink mb-4">
                  Stage 3 — Fill in the form and submit
                </h3>
                <ol className="space-y-5">
                  <Step n="1" title="Work through the steps">
                    The progress bar shows where you are. Required questions are
                    marked with a red asterisk; everything else is optional.
                  </Step>
                  <Step n="2" title="Attach evidence if you have it">
                    Documents, images, video and spreadsheets can be attached to
                    the report.
                  </Step>
                  <Step n="3" title="Submit">
                    When you submit, the report reaches the compliance team.
                  </Step>
                </ol>

                <Shot
                  src="/guide/anon-form.webp"
                  alt="Multi-step anonymous report form showing step 1 of 3 with incident detail questions"
                  caption="Stage 3. Your report number stays visible in the top right while you fill in the form."
                />
              </Card>
            </Section>

            {/* ── Tracking ─────────────────────────────────────────────── */}
            <Section
              id="tracking"
              icon={Search}
              eyebrow="Step 3"
              title="Tracking your report and replying"
              intro="You can check your report's status and reply to the compliance team. All communication remains anonymous."
            >
              <Card>
                <ol className="space-y-5">
                  <Step n="1" title="Open “Track a report”">
                    It is reachable from the portal without signing in.
                  </Step>
                  <Step n="2" title="Enter your report number and password">
                    Enter the report number and password you saved when you created the report.
                  </Step>
                  <Step n="3" title="Read the status and any messages">
                    You will see the current status —{' '}
                    <strong className="text-ink">Pending</strong>,{' '}
                    <strong className="text-ink">In Progress</strong>,{' '}
                    <strong className="text-ink">Resolved</strong> — along with any
                    questions from the investigator.
                  </Step>
                  <Step n="4" title="Reply or add more information">
                    Anything you remember later, or any new evidence, can be added
                    to the existing report rather than filed as a new one.
                  </Step>
                </ol>

                <Shot
                  src="/guide/track-report.webp"
                  alt="Anonymous Report Tracker page with report number and password fields"
                  caption="Tracking needs no account — only the credentials issued when you started the report."
                />
              </Card>
            </Section>

            {/* ── AI widget ────────────────────────────────────────────── */}
            <Section
              id="ai-widget"
              icon={Bot}
              eyebrow="Assistant"
              title="Reporting with the AI assistant"
              intro="Submit your report with state of the art AI assistant tailored for handling ethics and compliance reporting. You can use voice or text to submit your report. "
            >
              <Card>
                <ol className="space-y-5">
                  <Step n="1" title="Open the chat bubble">
                    <span className="inline-flex items-center gap-1 align-middle">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </span>{' '}
                    Bottom-right of the screen, on every portal page.
                  </Step>
                  <Step n="2" title="Choose how to report">
                    <strong className="text-ink">Anonymous Report</strong> keeps
                    your identity out of it entirely.{' '}
                    <strong className="text-ink">Account Report</strong> ties the
                    report to your signed-in account — if you are not signed in,
                    the assistant offers to take you to the login page.
                  </Step>
                  <Step n="3" title="Create a secure ID">
                    For an anonymous conversation the assistant asks for the same
                    password choice as the form: auto-generated, or your own.
                    Select <strong className="text-ink">Create Secure ID</strong>{' '}
                    and save the credentials it shows you.
                  </Step>
                  <Step n="4" title="Describe what happened, in your own words">
                    Type into the message box and the assistant asks follow-up
                    questions, filling in the report as you talk.
                  </Step>
                </ol>

                <div className="grid sm:grid-cols-2 gap-6">
                  <Shot
                    src="/guide/widget-home.webp"
                    alt="AI assistant panel offering Anonymous Report or Account Report"
                    caption="The assistant's opening screen: choose anonymous or account reporting."
                  />
                  <Shot
                    src="/guide/widget-password.webp"
                    alt="AI assistant Secure Credentials step with password options and Create Secure ID button"
                    caption="Anonymous conversations start with the same credential step as the form."
                  />
                </div>

                <div className="mt-6 grid sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-line bg-subtle p-4">
                    <Mic className="h-4 w-4 text-accent-fg mb-2" />
                    <h4 className="text-sm font-semibold text-ink">Speak instead of typing</h4>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      The microphone button turns on voice.
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-subtle p-4">
                    <Paperclip className="h-4 w-4 text-accent-fg mb-2" />
                    <h4 className="text-sm font-semibold text-ink">Attach evidence</h4>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      The paperclip attaches documents, images and video to the
                      report, up to 50&nbsp;MB per file.
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-subtle p-4">
                    <Key className="h-4 w-4 text-accent-fg mb-2" />
                    <h4 className="text-sm font-semibold text-ink">End the session</h4>
                    <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                      <strong className="text-ink">End Session</strong> clears the
                      credentials from this browser. Make sure you have saved them
                      first.
                    </p>
                  </div>
                </div>
              </Card>

              <Alert variant="info" title="The assistant is a helper, not the investigator" className="mt-4">
                It helps you get a complete report on the record. A human
                compliance officer reviews what you submit and decides what
                happens next.
              </Alert>
            </Section>

            {/* ── Account reporting ────────────────────────────────────── */}
            <Section
              id="account"
              icon={UserCheck}
              eyebrow="With an account"
              title="Reporting from your account"
              intro="Signed in, everything you have raised lives in one place: statuses, history, and messages from the compliance team."
            >
              <Card>
                <h3 className="text-sm font-semibold text-ink mb-4">Your dashboard</h3>
                <ul className="space-y-3 text-sm text-ink-muted">
                  <li className="flex gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success-fg" />
                    <span>
                      Counters at the top show how many reports you have filed and
                      how many are pending, in progress, or resolved.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success-fg" />
                    <span>
                      <strong className="text-ink">My Reports</strong> lists each
                      report with its status; switch between grid and list, or
                      filter by status.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success-fg" />
                    <span>
                      <strong className="text-ink">Recent Activity</strong> shows
                      the latest movement on your cases.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-success-fg" />
                    <span>
                      <strong className="text-ink">Take a tour</strong> replays a
                      guided walkthrough of the dashboard whenever you want it.
                    </span>
                  </li>
                </ul>

                <Shot
                  src="/guide/reporter-dashboard.webp"
                  alt="Reporter dashboard showing report counters, report cards and recent activity"
                  caption="The reporter dashboard. The sidebar carries Submit Report, My Reports, and an Anonymous Report shortcut."
                />
              </Card>

              <Card className="mt-6">
                <h3 className="text-sm font-semibold text-ink mb-4">Filing a new report</h3>
                <ol className="space-y-5">
                  <Step n="1" title="Choose “Submit Report”">
                    From the sidebar, or the{' '}
                    <strong className="text-ink">Submit New Report</strong> button
                    on My Reports.
                  </Step>
                  <Step n="2" title="Select a report type">
                    Same categories as the anonymous route, with the number of
                    steps shown on each card.
                  </Step>
                  <Step n="3" title="Complete the guided form">
                    Identical multi-step form, minus the credential handling —
                    your account already identifies the report as yours.
                  </Step>
                  <Step n="4" title="Follow it from My Reports">
                    Status changes and messages from the compliance team appear
                    against the report. No report number to keep safe.
                  </Step>
                </ol>

                <div className="grid sm:grid-cols-2 gap-6">
                  <Shot
                    src="/guide/reporter-submit.webp"
                    alt="Submit a New Report page with report type cards"
                    caption="Choosing a category for an account report."
                  />
                  <Shot
                    src="/guide/reporter-reports.webp"
                    alt="My Reports page listing submitted reports with status badges"
                    caption="My Reports: search, filter by status or priority, and open any report."
                  />
                </div>
              </Card>

              <Alert variant="info" title="Prefer to stay unnamed on one particular concern?" className="mt-4">
                Even with an account you can use{' '}
                <strong>Anonymous Report</strong> at the bottom of the sidebar. That
                report is credential-based like any other anonymous submission.
              </Alert>
            </Section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default HowToUse;
