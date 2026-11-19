// src/pages/public/SsoCallback.jsx
//
// Where Microsoft/Google send a reporter back after company sign-in
// (SSO.md §2.5): /sso/callback/:connectionId?code=…&state=… — or ?error=…
// when they cancelled. The connection id identifies tenant and entity, so
// the URL the customer registered never breaks when a slug changes.
//
// The callback is called exactly once (a state works only once), then the
// code and state are removed from the address bar before anything else.
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, XCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { ssoAPI, ssoError } from '../../api/sso';
import { useAuthStore } from '../../store/authStore';
import { afterSsoSignIn, readPendingSso } from '../../utils/ssoFlow';
import useSEO from '../../hooks/useSEO';

// Errors after which the only way forward is to start over.
const RESTART = new Set(['state_invalid', 'exchange_failed', 'token_invalid', 'token_expired', 'connection_unavailable']);

const SsoCallback = () => {
  const { t } = useTranslation('sso');
  useSEO({ title: t('callback.title'), noIndex: true });
  const { connectionId } = useParams();
  const navigate = useNavigate();
  const acceptSsoSession = useAuthStore((s) => s.acceptSsoSession);
  const called = useRef(false);
  const [failure, setFailure] = useState(null); // { message, restart, cancelled }
  const pending = readPendingSso();
  const slug = pending?.slug || null;

  useEffect(() => {
    if (called.current) return;
    called.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const providerError = params.get('error');
    // Nothing of the provider's answer stays in the address bar or history.
    window.history.replaceState(null, '', window.location.pathname);

    if (providerError || !code || !state) {
      setFailure({ cancelled: true, restart: true });
      return;
    }
    (async () => {
      try {
        const response = await ssoAPI.callback({ connectionId, code, state });
        const user = await acceptSsoSession(response);
        navigate(afterSsoSignIn(response, user, slug), { replace: true });
      } catch (error) {
        const { code: c, message, status } = ssoError(error);
        if (c === 'connection_broken') setFailure({ message: t('errors.askAdmin') });
        else if (c === 'sso_not_configured') setFailure({ message: t('errors.unavailable') });
        else if (!status) setFailure({ message: t('errors.network'), restart: true });
        else setFailure({ message: message || t('errors.generic'), restart: RESTART.has(c) || !c });
      }
    })();
  }, [connectionId, acceptSsoSession, navigate, slug, t]);

  return (
    <div className="flex min-h-[80vh] items-start justify-center px-4 pb-16 pt-24 sm:pt-28">
      <Card className="w-full max-w-md">
        <Card.Content className="space-y-5 p-6 text-center sm:p-8">
          {!failure ? (
            <div role="status" className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-accent-fg" aria-hidden="true" />
              <h1 className="text-lg font-semibold text-ink">{t('callback.signingIn')}</h1>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <XCircle className="h-9 w-9 text-danger-fg" aria-hidden="true" />
              <h1 className="text-lg font-semibold text-ink">{failure.cancelled ? t('callback.cancelled') : t('callback.failed')}</h1>
              {failure.message && <p className="text-sm text-ink-secondary" dir="auto">{failure.message}</p>}
              <div className="flex w-full flex-col gap-2 pt-2">
                {failure.restart && slug && (
                  <Button to={`/${slug}/report-named`} fullWidth>{t('callback.startAgain')}</Button>
                )}
                {slug ? (
                  <Link to={`/${slug}/submit-anonymous`} className="text-sm font-medium text-link hover:underline">{t('signIn.anonymousInstead')}</Link>
                ) : (
                  <Link to="/" className="text-sm font-medium text-link hover:underline">{t('callback.home')}</Link>
                )}
              </div>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};

export default SsoCallback;
