// src/components/public/PortalHeader.jsx
//
// The organization's (or entity's) own name and logo on its reporter portal
// (XPAI-226, PORTAL.md §1). Branding comes back already resolved: an entity's
// empty fields show the tenant's. Brand colours are used for the frame only,
// never for text, so contrast holds whatever colours an admin picks.
import { useTranslation } from 'react-i18next';
import { portalAPI } from '../../api/portal';
import { pickLang } from '../../hooks/usePortal';

const HEX = /^#[0-9a-f]{6}$/i;

const PortalHeader = ({ portal }) => {
  const { i18n } = useTranslation('public');
  if (!portal) return null;
  const lang = i18n.resolvedLanguage;
  const other = lang === 'ar' ? 'en' : 'ar';
  const branding = portal.branding || {};
  const name = pickLang(branding.display_name, lang) || portal.organization?.name || '';
  const otherName = branding.display_name?.[other];
  const logo = portalAPI.logoSrc(branding.logo_url, branding.logo_version);
  const primary = HEX.test(branding.primary_color || '') ? branding.primary_color : null;
  const accent = HEX.test(branding.accent_color || '') ? branding.accent_color : null;

  return (
    <div
      className="mb-8 inline-flex max-w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 pe-6 shadow-sm"
      style={primary ? { borderInlineStartWidth: 6, borderInlineStartColor: primary } : undefined}
    >
      {logo && (
        <img
          src={logo}
          alt=""
          className="h-14 w-auto max-w-40 shrink-0 object-contain"
          // A broken logo shouldn't leave an empty frame on the reporter's page.
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="min-w-0">
        <p className="text-lg font-bold text-ink leading-tight" dir="auto">{name}</p>
        {otherName && otherName !== name && (
          <p className="text-sm text-ink-muted" lang={other} dir={other === 'ar' ? 'rtl' : 'ltr'}>{otherName}</p>
        )}
        {accent && <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full" style={{ background: accent }} />}
      </div>
    </div>
  );
};

export default PortalHeader;
