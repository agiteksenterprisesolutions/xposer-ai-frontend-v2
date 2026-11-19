// src/pages/public/NamedSignIn.jsx
//
// "Report under my name" (XPAI-108, SSO.md §2): a reporter signs in with their
// own company account before filing a named report.
//
//   work email → POST /auth/sso/{slug}/discover
//     microsoft | google → POST …/start → browser goes to the provider, comes
//                          back to /sso/callback/:connectionId (SsoCallback)
//     password           → password form here (login, or emailed code + new
//                          password for a first time / forgotten password)
//
// Reached only from "Report under my name", and only when the organization
// has company sign-in (sso.enabled). The anonymous path never shows any of
// this. Every screen offers "Report anonymously instead".
import { useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Building2, KeyRound, Mail } from 'lucide-react';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Card from '../../components/ui/Card';
import Skeleton from '../../components/ui/Skeleton';
import { ssoAPI, ssoError } from '../../api/sso';
import { useOrgPublic } from '../../hooks/useOrgPublic';
import { useAuthStore } from '../../store/authStore';
import { currentPortalPath } from '../../store/portalStore';
import { PASSWORD_RULES } from '../../utils/passwordPolicy';
import { savePendingSso, afterSsoSignIn } from '../../utils/ssoFlow';
import useSEO from '../../hooks/useSEO';
import { hasStaffAccess } from '../../utils/navigation';

const inputClass =
  'h-11 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-line-accent focus:ring-2 focus:ring-accent-ring';

const ProviderIcon = ({ provider }) => {
  if (provider === 'microsoft') {
    return (
      <svg viewBox="0 0 23 23" className="h-4 w-4" aria-hidden="true">
        <path fill="#F25022" d="M1 1h10v10H1z" /><path fill="#7FBA00" d="M12 1h10v10H12z" />
        <path fill="#00A4EF" d="M1 12h10v10H1z" /><path fill="#FFB900" d="M12 12h10v10H12z" />
      </svg>
    );
  }
  if (provider === 'google') {
    return (
      <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
        <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84a10.13 10.13 0 0 1-4.4 6.65v5.52h7.12c4.16-3.83 6.56-9.47 6.56-16.18z" />
        <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.12-5.52c-1.97 1.32-4.49 2.1-7.44 2.1-5.72 0-10.57-3.86-12.3-9.06H4.34v5.7A22 22 0 0 0 24 46z" />
        <path fill="#FBBC05" d="M11.7 28.19a13.2 13.2 0 0 1 0-8.38v-5.7H4.34a22 22 0 0 0 0 19.78l7.36-5.7z" />
        <path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.04 29.93 1 24 1 15.4 1 7.96 5.94 4.34 13.11l7.36 5.7c1.73-5.2 6.58-9.06 12.3-9.06z" />
      </svg>
    );
  }
  return <KeyRound className="h-4 w-4" aria-hidden="true" />;
};

const NamedSignIn = () => {
  const { t } = useTranslation('sso');
  useSEO({ title: t('signIn.title'), description: t('signIn.intro'), noIndex: true });
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, acceptSsoSession } = useAuthStore();
  const { sso, loading } = useOrgPublic(orgSlug);
  const emailId = useId();
  const passwordId = useId();
  const codeId = useId();
  const newPasswordId = useId();

  // email → (password | code)
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(null); // which action is running
  const [fieldError, setFieldError] = useState(null);
  const [problem, setProblem] = useState(null); // { message, anonymous?, retry?, codeLink? }
  const [codeSent, setCodeSent] = useState(null); // the server's neutral message
  const [resendIn, setResendIn] = useState(0);
  const timer = useRef(null);

  const returnPath = `/${currentPortalPath(orgSlug) || orgSlug}`;
  const anonymousPath = `/${orgSlug}/submit-anonymous`;

  useEffect(() => () => clearInterval(timer.current), []);
  const startCountdown = (seconds) => {
    clearInterval(timer.current);
    setResendIn(seconds);
    timer.current = setInterval(() => {
      setResendIn((s) => {
        if (s <= 1) clearInterval(timer.current);
        return Math.max(0, s - 1);
      });
    }, 1000);
  };

  // A signed-in reporter has nothing to do here.
  if (isAuthenticated && user && !hasStaffAccess(user)) return <Navigate to={`/${user.organization_slug || orgSlug}/reporter/submit`} replace />;

  const reset = () => {
    setFieldError(null);
    setProblem(null);
  };

  // Turn an error into what the reporter sees (SSO.md §2.9).
  const show = (error) => {
    const { code: c, message, status } = ssoError(error);
    const msg = message || t('errors.generic');
    switch (c) {
      case 'email_invalid':
        return setFieldError(msg);
      case 'domain_not_configured':
      case 'connection_unavailable':
        return setProblem({ message: msg, anonymous: true });
      case 'sso_not_configured':
        return setProblem({ message: t('errors.unavailable'), anonymous: true });
      case 'provider_unreachable':
        return setProblem({ message: t('errors.tryShortly'), retry: true });
      case 'connection_broken':
        return setProblem({ message: t('errors.askAdmin') });
      case 'use_password':
        return setStep('password');
      case 'code_invalid':
        return setFieldError(t('errors.codeInvalid'));
      case 'password_weak':
        return setFieldError(msg);
      case 'locked':
        return setProblem({ message: msg, codeLink: true });
      default:
        if (!status) return setProblem({ message: t('errors.network'), retry: true });
        return setProblem({ message: msg });
    }
  };

  const goToProvider = async (connectionId, withEmail = null) => {
    setBusy(connectionId);
    reset();
    try {
      const { authorization_url: url } = await ssoAPI.start(orgSlug, { connectionId, email: withEmail, returnPath });
      // So the callback page knows where to send someone back if they cancel.
      savePendingSso({ slug: orgSlug, returnPath });
      window.location.assign(url);
    } catch (error) {
      setBusy(null);
      show(error);
    }
  };

  const continueWithEmail = async (e) => {
    e.preventDefault();
    reset();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFieldError(t('errors.emailInvalid'));
      return;
    }
    setBusy('discover');
    try {
      const found = await ssoAPI.discover(orgSlug, value);
      if (found.provider === 'password') {
        setBusy(null);
        setStep('password');
        return;
      }
      await goToProvider(found.connection_id, value);
    } catch (error) {
      setBusy(null);
      show(error);
    }
  };

  const signedIn = async (response) => {
    const signedInUser = await acceptSsoSession(response);
    navigate(afterSsoSignIn(response, signedInUser, orgSlug), { replace: true });
  };

  const passwordLogin = async (e) => {
    e.preventDefault();
    reset();
    if (!password) return setFieldError(t('errors.passwordRequired'));
    setBusy('login');
    try {
      await signedIn(await ssoAPI.passwordLogin(orgSlug, { email: email.trim(), password, returnPath }));
    } catch (error) {
      setBusy(null);
      show(error);
    }
  };

  const sendCode = async () => {
    reset();
    setBusy('code');
    try {
      const res = await ssoAPI.passwordCode(orgSlug, email.trim());
      setCodeSent(res.message || t('code.sent'));
      startCountdown(res.resend_after || 60);
      setStep('code');
    } catch (error) {
      show(error);
    } finally {
      setBusy(null);
    }
  };

  const setNewPasswordAndSignIn = async (e) => {
    e.preventDefault();
    reset();
    if (!/^\d{6}$/.test(code.trim())) return setFieldError(t('errors.codeFormat'));
    if (!PASSWORD_RULES.every((r) => r.test(newPassword))) return setFieldError(t('errors.passwordRules'));
    setBusy('set');
    try {
      await signedIn(await ssoAPI.passwordSet(orgSlug, { email: email.trim(), code: code.trim(), password: newPassword, returnPath }));
    } catch (error) {
      setBusy(null);
      show(error);
    }
  };

  const anonymousLink = (
    <Link to={anonymousPath} className="font-medium text-link hover:underline">{t('signIn.anonymousInstead')}</Link>
  );

  let body;
  if (loading) {
    body = <div className="space-y-3"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div>;
  } else if (!sso.enabled) {
    body = <Alert variant="info">{t('signIn.notAvailable')} {anonymousLink}</Alert>;
  } else if (step === 'email') {
    body = (
      <div className="space-y-5">
        {sso.email_sign_in && (
          <form onSubmit={continueWithEmail} noValidate className="space-y-3">
            <label htmlFor={emailId} className="block text-sm font-medium text-ink-secondary">{t('signIn.workEmail')}</label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              inputMode="email"
              dir="ltr"
              className={inputClass}
              value={email}
              onChange={(e) => { setEmail(e.target.value); reset(); }}
              aria-invalid={fieldError ? 'true' : undefined}
              aria-describedby={`${emailId}-desc`}
            />
            <p id={`${emailId}-desc`} className={`text-xs ${fieldError ? 'text-danger-fg' : 'text-ink-muted'}`}>{fieldError || t('signIn.workEmailHint')}</p>
            <Button type="submit" fullWidth isLoading={busy === 'discover'} startIcon={Mail}>{t('signIn.continue')}</Button>
          </form>
        )}
        {sso.buttons?.length > 0 && (
          <div className="space-y-2">
            {sso.email_sign_in && <p className="text-center text-xs text-ink-muted">{t('signIn.or')}</p>}
            {sso.buttons.map((b) => (
              <Button
                key={b.connection_id}
                variant="secondary"
                fullWidth
                isLoading={busy === b.connection_id}
                onClick={() => goToProvider(b.connection_id)}
              >
                <ProviderIcon provider={b.provider} />
                <span dir="auto">{t(`signIn.continueWith.${b.provider}`, { label: b.label, defaultValue: b.label })}</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  } else if (step === 'password') {
    body = (
      <form onSubmit={passwordLogin} noValidate className="space-y-3">
        <p className="text-sm text-ink-secondary">{t('password.for')} <span className="font-medium text-ink" dir="ltr">{email}</span></p>
        <label htmlFor={passwordId} className="block text-sm font-medium text-ink-secondary">{t('password.label')}</label>
        <input
          id={passwordId}
          type="password"
          autoComplete="current-password"
          className={inputClass}
          value={password}
          onChange={(e) => { setPassword(e.target.value); reset(); }}
          aria-invalid={fieldError ? 'true' : undefined}
          aria-describedby={fieldError ? `${passwordId}-err` : undefined}
        />
        {fieldError && <p id={`${passwordId}-err`} className="text-xs text-danger-fg">{fieldError}</p>}
        <Button type="submit" fullWidth isLoading={busy === 'login'}>{t('password.signIn')}</Button>
        <p className="text-sm text-ink-muted">
          {t('password.firstTime')}{' '}
          <button type="button" onClick={sendCode} disabled={busy === 'code'} className="min-h-6 font-medium text-link hover:underline disabled:opacity-60">
            {t('password.emailCode')}
          </button>
        </p>
      </form>
    );
  } else {
    body = (
      <form onSubmit={setNewPasswordAndSignIn} noValidate className="space-y-3">
        {codeSent && <Alert variant="info">{codeSent}</Alert>}
        <label htmlFor={codeId} className="block text-sm font-medium text-ink-secondary">{t('code.label')}</label>
        <input
          id={codeId}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          dir="ltr"
          className={`${inputClass} tracking-[0.3em]`}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); reset(); }}
        />
        <label htmlFor={newPasswordId} className="block text-sm font-medium text-ink-secondary">{t('code.newPassword')}</label>
        <input
          id={newPasswordId}
          type="password"
          autoComplete="new-password"
          className={inputClass}
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); reset(); }}
          aria-describedby={`${newPasswordId}-rules`}
        />
        <ul id={`${newPasswordId}-rules`} className="space-y-0.5 text-xs">
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(newPassword);
            return (
              <li key={rule.id} className={met ? 'text-success-fg' : 'text-ink-muted'}>
                {met ? '✓' : '•'} {rule.label}
                <span className="sr-only">{met ? t('code.ruleMet') : t('code.ruleNotMet')}</span>
              </li>
            );
          })}
        </ul>
        {fieldError && <p className="text-xs text-danger-fg" role="alert">{fieldError}</p>}
        <Button type="submit" fullWidth isLoading={busy === 'set'}>{t('code.continue')}</Button>
        <button type="button" onClick={sendCode} disabled={resendIn > 0 || busy === 'code'} className="min-h-6 text-sm font-medium text-link hover:underline disabled:text-ink-muted disabled:no-underline">
          {resendIn > 0 ? t('code.resendIn', { count: resendIn }) : t('code.resend')}
        </button>
      </form>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-start justify-center px-4 pb-16 pt-24 sm:pt-28">
      <Card className="w-full max-w-md">
        <Card.Content className="space-y-6 p-6 sm:p-8">
          <div className="space-y-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-fg"><Building2 className="h-5 w-5" aria-hidden="true" /></span>
            <h1 className="text-2xl font-bold text-ink">{t('signIn.title')}</h1>
            <p className="text-sm text-ink-muted">{t('signIn.intro')}</p>
          </div>

          {problem && (
            <Alert variant="error">
              <span dir="auto">{problem.message}</span>
              {problem.anonymous && <> {anonymousLink}</>}
              {problem.codeLink && (
                <> <button type="button" onClick={sendCode} className="font-medium text-link hover:underline">{t('password.emailCode')}</button></>
              )}
            </Alert>
          )}

          {body}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
            {step !== 'email' ? (
              <button type="button" onClick={() => { setStep('email'); reset(); }} className="inline-flex min-h-6 items-center gap-1 text-ink-muted hover:text-ink">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t('signIn.otherEmail')}
              </button>
            ) : <span />}
            {anonymousLink}
          </div>
          <p className="text-xs text-ink-muted">{t('signIn.privacy')}</p>
        </Card.Content>
      </Card>
    </div>
  );
};

export default NamedSignIn;
