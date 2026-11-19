// src/pages/admin/Portal.jsx
//
// The reporter portal (PORTAL.md §2–§3, XPAI-226): where reporters go to
// report, and how it looks.
//
// - Addresses: the tenant's own address (set by the platform) and one per
//   legal entity. Tenant admins only (portal:manage). The address a report
//   starts at fixes its entity.
// - Branding: display name, colours and logo, for the tenant or one entity.
//   Shown on the public portal page and printed on the QR posters.
//
// An entity admin (ENTITY_ADMIN.md) gets branding only, for their own entity.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Tabs from '../../components/ui/Tabs';
import AddressesSection from '../../components/portal/AddressesSection';
import BrandingSection from '../../components/portal/BrandingSection';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';

const Portal = () => {
  const { t } = useTranslation('portal');
  useSEO({ title: t('page.title'), description: t('page.seoDescription'), noIndex: true });
  const can = useCan();
  const isTenantAdmin = can(PERM.portalManage);
  const user = useAuthStore((s) => s.user);
  // An entity admin manages only their own entity's branding.
  const ownEntity = !isTenantAdmin ? user?.entity_code || null : null;
  const [tab, setTab] = useState(isTenantAdmin ? 'addresses' : 'branding');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{t('page.title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">{t('page.intro')}</p>
      </div>

      {isTenantAdmin ? (
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List aria-label={t('page.tabsLabel')}>
            <Tabs.Trigger value="addresses">{t('page.tabAddresses')}</Tabs.Trigger>
            <Tabs.Trigger value="branding">{t('page.tabBranding')}</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="addresses" className="mt-5">
            <AddressesSection />
          </Tabs.Content>
          <Tabs.Content value="branding" className="mt-5">
            <BrandingSection />
          </Tabs.Content>
        </Tabs>
      ) : (
        <BrandingSection canChooseScope={false} fixedEntityCode={ownEntity} />
      )}
    </div>
  );
};

export default Portal;
