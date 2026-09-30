// src/components/auth/SocialAuthButtons.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { isFirebaseConfigured, authLog, authError } from '../../lib/firebase';
import Button from '../ui/Button';

/** Google's brand mark. Inlined because a CDN round-trip isn't worth four paths. */
const GoogleIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84a10.13 10.13 0 0 1-4.4 6.65v5.52h7.12c4.16-3.83 6.56-9.47 6.56-16.18z" />
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.12-5.52c-1.97 1.32-4.49 2.1-7.44 2.1-5.72 0-10.57-3.86-12.3-9.06H4.34v5.7A22 22 0 0 0 24 46z" />
    <path fill="#FBBC05" d="M11.7 28.19a13.2 13.2 0 0 1 0-8.38v-5.7H4.34a22 22 0 0 0 0 19.78l7.36-5.7z" />
    <path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.04 29.93 1 24 1 15.4 1 7.96 5.94 4.34 13.11l7.36 5.7c1.73-5.2 6.58-9.06 12.3-9.06z" />
  </svg>
);

/** Microsoft's four-square logo. */
const MicrosoftIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 23 23" aria-hidden="true">
    <path fill="#F25022" d="M1 1h10v10H1z" />
    <path fill="#7FBA00" d="M12 1h10v10H12z" />
    <path fill="#00A4EF" d="M1 12h10v10H1z" />
    <path fill="#FFB900" d="M12 12h10v10H12z" />
  </svg>
);

const PROVIDER_BUTTONS = [
  { id: 'google', label: 'Google', Icon: GoogleIcon },
  { id: 'microsoft', label: 'Microsoft', Icon: MicrosoftIcon },
];

/**
 * Google + Microsoft sign-in (plus a divider) for the Login and Register
 * pages. Renders nothing when the deployment has no Firebase project
 * configured, so self-hosted installs don't get buttons that can only fail.
 *
 * @param {(user: object) => void} onSuccess  called with the app user once the
 *        provider's ID token has been exchanged for an app JWT
 * @param {(message: string) => void} onError called with a display-ready message
 */
const SocialAuthButtons = ({
  onSuccess,
  onError,
  organizationSlug,
  disabled = false,
  dividerLabel = 'or continue with',
  /** "Continue with" on Login, "Sign up with" on Register. */
  actionLabel = 'Continue with',
  providers = ['google', 'microsoft'],
}) => {
  const socialLogin = useAuthStore((state) => state.socialLogin);
  const resumeSocialLogin = useAuthStore((state) => state.resumeSocialLogin);
  // Which provider is mid-flight, so only that button spins. `__resume__`
  // covers the redirect check that runs before any click.
  const [pendingProvider, setPendingProvider] = useState(null);
  const resumedRef = useRef(false);

  // Picks up a sign-in that fell back to a full-page redirect: the browser
  // lands back here, and the pending credential is exchanged for an app JWT.
  // The ref keeps StrictMode's double-mount from consuming it twice.
  useEffect(() => {
    if (!isFirebaseConfigured) {
      authError('Firebase is not configured — check the VITE_FIREBASE_* env vars and restart the dev server');
      return;
    }
    if (resumedRef.current) {
      authLog('mount: redirect check already ran (StrictMode re-mount), skipping');
      return;
    }
    resumedRef.current = true;

    authLog('mount: checking for a pending redirect sign-in');
    setPendingProvider('__resume__');
    resumeSocialLogin({ organizationSlug })
      .then((result) => {
        if (!result) {
          authLog('mount: no pending redirect — normal page load');
          return;
        }
        authLog('mount: redirect sign-in resolved', result);
        if (result.success) {
          onSuccess?.(result.user);
        } else if (!result.cancelled) {
          onError?.(result.error || 'Sign-in failed. Please try again.');
        }
      })
      .catch((error) => {
        // resumeSocialLogin handles its own errors, so this only fires on a
        // genuine bug — but without it the buttons would hang on the spinner.
        authError('mount: unexpected failure while resuming redirect', error);
      })
      .finally(() => {
        // Unconditional on purpose. StrictMode tears this effect down and the
        // ref blocks the re-run, so anything gated on a per-run "cancelled"
        // flag here would leave the buttons stuck loading forever.
        authLog('mount: redirect check finished, buttons enabled');
        setPendingProvider(null);
      });

    // Runs once per mount; the callbacks are re-created every render and would
    // otherwise retrigger the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isFirebaseConfigured) return null;

  const handleClick = async (providerId) => {
    authLog(`click: starting ${providerId} sign-in`);
    setPendingProvider(providerId);
    onError?.('');
    try {
      const result = await socialLogin(providerId, { organizationSlug });
      authLog(`click: socialLogin(${providerId}) returned`, result);

      // The browser is navigating away for the redirect fallback — leave the
      // spinner up rather than flashing the idle state before unload.
      if (result?.pending) {
        authLog('click: redirect flow took over, this page is unloading');
        return;
      }

      if (result?.success) {
        onSuccess?.(result.user);
      } else if (result?.cancelled) {
        authLog('click: user closed the popup, no error shown');
      } else {
        onError?.(result?.error || 'Sign-in failed. Please try again.');
      }
    } catch (error) {
      authError(`click: unexpected failure during ${providerId} sign-in`, error);
      onError?.(error?.message || 'Sign-in failed. Please try again.');
    } finally {
      setPendingProvider(null);
    }
  };

  const visibleProviders = PROVIDER_BUTTONS.filter((p) => providers.includes(p.id));
  const busy = pendingProvider !== null;

  return (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-line-subtle" />
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-surface text-xs uppercase tracking-wide text-ink-subtle">
            {dividerLabel}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {visibleProviders.map(({ id, label, Icon }) => {
          const isPending = pendingProvider === id;
          return (
            <Button
              key={id}
              type="button"
              variant="secondary"
              size="large"
              fullWidth
              onClick={() => handleClick(id)}
              isLoading={isPending}
              // The whole group locks while any provider is mid-flight, so a
              // stray second click can't open two popups at once.
              disabled={disabled || busy}
            >
              {!isPending && <Icon className="w-4 h-4 shrink-0" />}
              {`${actionLabel} ${label}`}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default SocialAuthButtons;
