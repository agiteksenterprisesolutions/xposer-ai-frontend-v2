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
  useSEO({
    title: 'Settings',
    description: 'Organization-wide configuration for the Xposer AI platform.',
    noIndex: true,
  });
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
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
          <p className="text-sm text-ink-muted">Configure global system settings and security policies</p>
        </div>
        <Button variant="secondary" startIcon={Save} isLoading={loading} onClick={handleSave}>
          Save Changes
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Navigation Tabs */}
        <aside className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id
                ? 'bg-accent-soft text-accent-fg shadow-sm'
                : 'text-ink-muted hover:bg-active'
                }`}
            >
              <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'text-accent-fg' : 'text-ink-subtle'}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Settings Content */}
        <main className="flex-1">
          {activeTab === 'general' && (
            <Card className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Card.Header>
                <Card.Title>General Configuration</Card.Title>
                <Card.Description>Core identity and communication settings for your organization.</Card.Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <Input label="Organization Name" defaultValue="Agiteks Enterprise" />
                <Input label="Support Email" type="email" defaultValue={SUPPORT_EMAIL || "support@xposer.ai"} />
                <Textarea label="Legal Disclaimer" defaultValue="Your privacy and anonymity are our top priority..." rows={4} />
                <div className="pt-4 border-t border-line-subtle">
                  <h4 className="text-sm font-semibold text-ink mb-4">Branding</h4>
                  <div className="flex items-center space-x-4">
                    <div className="h-16 w-16 rounded-xl bg-active border border-dashed border-line-strong flex items-center justify-center text-ink-subtle text-xs text-center p-2">
                      Upload Logo
                    </div>
                    <div>
                      <Button variant="secondary" size="small">Change Logo</Button>
                      <p className="text-xs text-ink-muted mt-1">PNG, JPG or SVG. Max 2MB.</p>
                    </div>
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Card.Header>
                <Card.Title>Security Policies</Card.Title>
                <Card.Description>Manage authentication and data protection standards.</Card.Description>
              </Card.Header>
              <Card.Content className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-subtle rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="h-5 w-5 text-ink-muted" />
                    <div>
                      <p className="text-sm font-medium text-ink">Enforce Multi-Factor Authentication</p>
                      <p className="text-xs text-ink-muted">Require MFA for all administrative accounts</p>
                    </div>
                  </div>
                  <input type="checkbox" className="h-4 w-4 text-accent-fg rounded border-line-strong focus:ring-accent-ring" defaultChecked />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-ink">Password Requirements</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Min. Length" type="number" defaultValue={12} />
                    <Input label="Session Timeout (min)" type="number" defaultValue={30} />
                  </div>
                </div>

                <div className="pt-4 border-t border-line-subtle flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium text-ink">IP Whitelisting</p>
                    <p className="text-ink-muted">Restriction is currently disabled</p>
                  </div>
                  <Button variant="ghost" size="small" className="text-accent-fg">Configure</Button>
                </div>
              </Card.Content>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card className="animate-in fade-in slide-in-from-right-4 duration-300">
              <Card.Header>
                <Card.Title>Notification Settings</Card.Title>
                <Card.Description>Control how the system communicates with users.</Card.Description>
              </Card.Header>
              <Card.Content className="space-y-6">
                <div className="space-y-4">
                  {[
                    { title: 'New Report Alerts', desc: 'Notify compliance officers when a new report is submitted' },
                    { title: 'Case Assignment', desc: 'Notify team members when they are assigned to a case' },
                    { title: 'Message Receipt', desc: 'Send emails to users when they receive a new message' },
                    { title: 'System Updates', desc: 'Receive notifications about system maintenance and updates' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-ink">{item.title}</p>
                        <p className="text-xs text-ink-muted max-w-sm">{item.desc}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" className="h-4 w-4 text-accent-fg rounded border-line-strong focus:ring-accent-ring" defaultChecked />
                        <Mail className="h-4 w-4 text-ink-subtle" />
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