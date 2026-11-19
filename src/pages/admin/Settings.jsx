import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Globe,
  Shield,
  Bell,
  Save,
  Mail,
  Lock,
  Smartphone
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import { SUPPORT_EMAIL } from '../../utils/constants';
import useSEO from '../../hooks/useSEO';

const Settings = () => {
  const { t } = useTranslation('admin');
  useSEO({
    title: t('settings.title'),
    description: t('settings.seoDescription'),
    noIndex: true,
  });
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'general', label: t('settings.tabs.general'), icon: Globe },
    { id: 'security', label: t('settings.tabs.security'), icon: Shield },
    { id: 'notifications', label: t('settings.tabs.notifications'), icon: Bell },
  ];

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-muted">{t('settings.intro')}</p>
        </div>
        <Button variant="secondary" startIcon={Save} isLoading={loading} onClick={handleSave}>
          {t('settings.save')}
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Navigation Tabs */}
        <aside className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id
                ? 'bg-accent-soft text-accent-fg shadow-sm'
                : 'text-ink-muted hover:bg-active'
                }`}
            >
              <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-accent-fg' : 'text-ink-subtle'}`} aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Settings Content */}
        <main className="flex-1">
          {activeTab === 'general' && (
            <Card className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Card.Header>
                <Card.Title>{t('settings.general.title')}</Card.Title>
                <Card.Description>{t('settings.general.description')}</Card.Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <Input label={t('settings.general.orgName')} defaultValue="Agiteks Enterprise" />
                <Input label={t('settings.general.supportEmail')} type="email" defaultValue={SUPPORT_EMAIL || "support@xposer.ai"} />
                <Textarea label={t('settings.general.disclaimer')} defaultValue={t('settings.general.disclaimerDefault')} rows={4} />
                <div className="pt-4 border-t border-line-subtle">
                  <h4 className="text-sm font-semibold text-ink mb-4">{t('settings.general.branding')}</h4>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-xl bg-active border border-dashed border-line-strong flex items-center justify-center text-ink-subtle text-xs text-center p-2">
                      {t('settings.general.uploadLogo')}
                    </div>
                    <div>
                      <Button variant="secondary" size="small">{t('settings.general.changeLogo')}</Button>
                      <p className="text-xs text-ink-muted mt-1">{t('settings.general.logoHint')}</p>
                    </div>
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Card.Header>
                <Card.Title>{t('settings.security.title')}</Card.Title>
                <Card.Description>{t('settings.security.description')}</Card.Description>
              </Card.Header>
              <Card.Content className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-subtle rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-5 w-5 text-ink-muted" aria-hidden="true" />
                    <div>
                      <p id="settings-mfa" className="text-sm font-medium text-ink">{t('settings.security.mfa')}</p>
                      <p className="text-xs text-ink-muted">{t('settings.security.mfaHint')}</p>
                    </div>
                  </div>
                  <input type="checkbox" aria-labelledby="settings-mfa" className="h-4 w-4 text-accent-fg rounded border-line-strong focus:ring-accent-ring" defaultChecked />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-ink">{t('settings.security.passwordRequirements')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label={t('settings.security.minLength')} type="number" defaultValue={12} />
                    <Input label={t('settings.security.sessionTimeout')} type="number" defaultValue={30} />
                  </div>
                </div>

                <div className="pt-4 border-t border-line-subtle flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium text-ink">{t('settings.security.ipAllowlist')}</p>
                    <p className="text-ink-muted">{t('settings.security.ipDisabled')}</p>
                  </div>
                  <Button variant="ghost" size="small" className="text-accent-fg">{t('settings.security.configure')}</Button>
                </div>
              </Card.Content>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Card.Header>
                <Card.Title>{t('settings.notifications.title')}</Card.Title>
                <Card.Description>{t('settings.notifications.description')}</Card.Description>
              </Card.Header>
              <Card.Content className="space-y-6">
                <div className="space-y-4">
                  {[
                    'newReport', 'caseAssignment', 'messageReceipt', 'systemUpdates',
                  ].map((id) => ({ id, title: t(`settings.notifications.items.${id}.title`), desc: t(`settings.notifications.items.${id}.desc`) })).map((item, i) => (
                    <div key={i} className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <p id={`settings-notify-${item.id}`} className="text-sm font-medium text-ink">{item.title}</p>
                        <p className="text-xs text-ink-muted max-w-sm">{item.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" aria-labelledby={`settings-notify-${item.id}`} className="h-4 w-4 text-accent-fg rounded border-line-strong focus:ring-accent-ring" defaultChecked />
                        <Mail className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export default Settings;
