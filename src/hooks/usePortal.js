// src/hooks/usePortal.js
//
// The public portal page data for /:tenant and /:tenant/:entity (XPAI-226,
// PORTAL.md §1): name, branding, logo and default language. Also records the
// address in the portal store, so reports started from here are filed under
// it, and opens the page in its default language unless the visitor has
// picked one themselves.
//
//   const { status, portal } = usePortal(orgSlug, entitySlug);
//   status: 'loading' | 'ready' | 'not_found' | 'rate_limited' | 'error'
import { useEffect, useState } from 'react';
import i18n, { LANGUAGES, CHOSEN_KEY } from '../i18n';
import { portalAPI } from '../api/portal';
import { usePortalStore } from '../store/portalStore';

const visitorChoseLanguage = () => {
  try {
    return localStorage.getItem(CHOSEN_KEY) === '1';
  } catch {
    return false;
  }
};

export function usePortal(tenant, entity = null) {
  const enter = usePortalStore((s) => s.enter);
  const [state, setState] = useState({ status: tenant ? 'loading' : 'ready', portal: null });

  useEffect(() => {
    if (!tenant) return undefined;
    let cancelled = false;
    setState({ status: 'loading', portal: null });
    portalAPI
      .getPublicPortal(tenant, entity)
      .then((portal) => {
        if (cancelled) return;
        enter(portal.organization?.slug || tenant, portal.entity?.slug || null);
        const lang = portal.default_language;
        if (lang && !visitorChoseLanguage() && LANGUAGES.some((l) => l.code === lang) && i18n.resolvedLanguage !== lang) {
          i18n.changeLanguage(lang);
        }
        setState({ status: 'ready', portal });
      })
      .catch((error) => {
        if (cancelled) return;
        const status = error?.response?.status;
        setState({
          status: status === 404 ? 'not_found' : status === 429 ? 'rate_limited' : 'error',
          portal: null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [tenant, entity, enter]);

  return state;
}

/** A bilingual `{ en, ar }` value in the current language, else the other one. */
export const pickLang = (value, lang = i18n.resolvedLanguage) => {
  if (!value || typeof value === 'string') return value || '';
  return value[lang] || value.en || value.ar || '';
};

export default usePortal;
