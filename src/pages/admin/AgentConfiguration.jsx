import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  Terminal,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { agentsAPI } from '../../api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { toast } from 'react-hot-toast';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import Alert from '../../components/ui/Alert';

const AGENT_CONFIG_TOUR_KEY = 'xposer_agent_config_tour_seen';

const ORCHESTRATION_MODES = [
  { id: 'fully_automated', name: 'Fully Automated', desc: 'AI handles entire workflow from triage to resolution' },
  { id: 'ai_triage', name: 'AI Triage', desc: 'AI categorizes and prioritizes, humans handle response' },
  { id: 'ai_manager', name: 'AI Manager', desc: 'AI coordinates reviewer tasks and tracks SLAs' },
  { id: 'fully_human', name: 'Fully Human', desc: 'AI is disabled, manual compliance flow only' },
];

const AgentConfiguration = () => {
  useSEO({
    title: 'AI Configuration',
    description: 'Tune the AI agents that triage, summarize, and route incoming reports.',
    noIndex: true,
  });
  // Config state
  const [config, setConfig] = useState({
    orchestration_mode: 'fully_automated',
    manager_prompt_instructions: '',
    officer_prompt_instructions: '',
    reviewer_prompt_instructions: '',
  });
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const { user } = useAuthStore();
  // agent:read opens this page; changing anything on it needs agent:manage.
  const canManage = useCan()(PERM.agentManage);
  const tourRef = useRef(null);
  const isDesktop = useIsDesktop();

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user?.organization_id) return;
    try {
      const configData = await agentsAPI.getConfig();
      setConfig(configData);
    } catch (error) {
      console.error('Error fetching agent data:', error);
      toast.error('Failed to load configuration');
    } finally {
      setLoadingConfig(false);
    }
  }, [user?.organization_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await agentsAPI.updateConfig(config);
      toast.success('Agent configuration updated');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to update configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-ai-configuration"]',
        title: 'AI Configuration',
        content: 'Tune how AI agents help triage, investigate, and respond to reports.',
        placement: 'right',
        skipBeacon: true,
      });
    }

    steps.push(
      {
        target: '[data-tour="agent-modes"]',
        title: 'Orchestration mode',
        content: 'Choose how much of the workflow AI handles — from fully automated to fully human.',
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="agent-prompts"]',
        title: 'Agent instructions',
        content: 'Give each agent — Manager, Officer, and Reviewer — its own custom instructions for how it should behave.',
        placement: 'left',
      },
      {
        target: '[data-tour="agent-save"]',
        title: 'Save your changes',
        content: 'Changes take effect immediately for all new report processing workflows.',
        placement: 'top',
      }
    );

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: 'Your account',
      content: 'Manage your profile or log out from here.',
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop]);

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-line-accent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <DashboardTour ref={tourRef} storageKey={AGENT_CONFIG_TOUR_KEY} steps={tourSteps} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">AI Agent Configuration</h1>
          <p className="text-sm text-ink-muted">
            Manage how AI agents interact with reports for your organization. Instructions here
            and the policies in your{' '}
            <Link
              to={`/${user?.organization_slug}/staff/agent-kb`}
              className="text-link hover:underline"
            >
              Knowledge Base
            </Link>{' '}
            are additive — where they conflict, these instructions win.
          </p>
        </div>
      </div>

      {!canManage && (
        <Alert variant="info" title="View only">
          Your role can see the agent configuration but not change it. Changing it needs permission to configure AI agents.
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Mode selection */}
        <div className="md:col-span-1" data-tour="agent-modes">
          <Card title="Orchestration Mode" icon={Bot}>
            <div className="space-y-4">
              <div className="grid gap-3">
                {ORCHESTRATION_MODES.map((mode) => (
                  <div
                    key={mode.id}
                    onClick={canManage ? () => setConfig({ ...config, orchestration_mode: mode.id }) : undefined}
                    aria-disabled={!canManage}
                    className={`p-3 rounded-lg border-2 transition-all ${canManage ? 'cursor-pointer' : 'cursor-default'} ${config.orchestration_mode === mode.id
                      ? 'border-line-accent bg-accent-soft'
                      : `border-line-subtle ${canManage ? 'hover:border-line' : ''}`
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{mode.name}</div>
                      {config.orchestration_mode === mode.id && (
                        <CheckCircle2 className="w-4 h-4 text-success-fg" />
                      )}
                    </div>
                    <div className="text-[10px] text-ink mt-1 leading-tight">{mode.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Prompts */}
        <div className="md:col-span-2" data-tour="agent-prompts">
          <Card title="Agent Prompt Instructions" icon={Terminal}>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider">Manager Agent</label>
                  <span className="text-[10px] text-accent-fg font-medium bg-accent-soft px-2 py-0.5 rounded">Primary Coordinator</span>
                </div>
                <textarea
                  className="w-full h-32 p-3 text-sm border rounded-lg bg-subtle font-mono focus:ring-1 focus:ring-accent-ring outline-none transition-all"
                  placeholder="Define core rules for managing reports, assigning priority, and coordinating other agents..."
                  value={config.manager_prompt_instructions || ''}
                  readOnly={!canManage}
                  onChange={(e) => setConfig({ ...config, manager_prompt_instructions: e.target.value })}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider">Officer Agent</label>
                  <span className="text-[10px] text-ink-muted font-medium bg-subtle px-2 py-0.5 rounded">Compliance Expert</span>
                </div>
                <textarea
                  className="w-full h-32 p-3 text-sm border rounded-lg bg-subtle font-mono focus:ring-1 focus:ring-accent-ring outline-none transition-all"
                  placeholder="Specific instructions for identifying policy violations and assessing legal implications..."
                  value={config.officer_prompt_instructions || ''}
                  readOnly={!canManage}
                  onChange={(e) => setConfig({ ...config, officer_prompt_instructions: e.target.value })}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-ink uppercase tracking-wider">Reviewer Agent</label>
                  <span className="text-[10px] text-success-fg font-medium bg-success-soft px-2 py-0.5 rounded">Quality Assurance</span>
                </div>
                <textarea
                  className="w-full h-32 p-3 text-sm border rounded-lg bg-subtle font-mono focus:ring-1 focus:ring-accent-ring outline-none transition-all"
                  placeholder="Final review protocols, verification of evidence, and tone-checking responses..."
                  value={config.reviewer_prompt_instructions || ''}
                  readOnly={!canManage}
                  onChange={(e) => setConfig({ ...config, reviewer_prompt_instructions: e.target.value })}
                />
              </div>

              {canManage && (
                <div className="pt-4">
                  <Button
                    className="w-full py-4 bg-accent text-on-accent hover:bg-accent shadow-md border-none transition-all duration-300"
                    startIcon={Save}
                    isLoading={savingConfig}
                    onClick={handleSaveConfig}
                    data-tour="agent-save"
                  >
                    Save Agent Configuration
                  </Button>
                  <p className="text-[10px] text-center text-ink mt-4 italic">
                    Changes take effect immediately for all new report processing workflows.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AgentConfiguration;
