// src/components/agents/AgentTokenModal.jsx
//
// Mint, rotate or revoke an agent's credential for the multiagent service.
//
// A token is shown exactly once: only its hash is stored, and nothing can ask
// for it again. So the reveal step cannot be dismissed by accident — no
// overlay click, no Escape, no close button — until the user says it is
// stored. Rotating invalidates the previous token the moment it succeeds.
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { Checkbox } from '../roles/PermissionPicker';
import { orgAgentsAPI } from '../../api/orgAgents';
import { copyToClipboard } from '../../utils/clipboard';
import { describeError } from '../../utils/errors';

// Text for each mode lives under token.<mode>.{title,body,action}.
const VARIANT = { mint: 'primary', rotate: 'warning', revoke: 'danger' };

/** mode: 'mint' | 'rotate' | 'revoke' */
const AgentTokenModal = ({ agent, mode, onClose, onDone }) => {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);
  const [stored, setStored] = useState(false);
  const { t } = useTranslation('agents');
  const copy = {
    title: t(`token.${mode}.title`),
    body: t(`token.${mode}.body`),
    action: t(`token.${mode}.action`),
    variant: VARIANT[mode],
  };

  const run = async () => {
    setWorking(true);
    setError(null);
    try {
      if (mode === 'revoke') {
        await orgAgentsAPI.revokeToken(agent.id);
        toast.success(t('token.revoked', { name: agent.name }));
        onDone?.();
      } else {
        setIssued(await orgAgentsAPI.mintToken(agent.id));
        // The list's has_token is now stale; refresh it behind the reveal.
        onDone?.({ keepOpen: true });
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setWorking(false);
    }
  };

  const handleCopy = async () => {
    if (!(await copyToClipboard(issued.token))) {
      toast.error(t('token.copyFailed'));
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (issued) {
    return (
      <Modal
        isOpen
        onClose={() => {}}
        title={t('token.revealTitle', { name: agent.name })}
        size="medium"
        closeOnOverlayClick={false}
        closeOnEsc={false}
        showCloseButton={false}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <Checkbox checked={stored} onChange={() => setStored((v) => !v)} labelledBy="token-stored" />
              <span id="token-stored">{t('token.stored')}</span>
            </label>
            <Button onClick={onClose} disabled={!stored}>
              {t('token.done')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert variant="warning" title={t('token.onceTitle')}>
            {issued.note || t('token.onceBody')}
          </Alert>
          <div className="flex items-stretch gap-2">
            <code dir="ltr" className="min-w-0 flex-1 select-all break-all rounded-lg border border-line bg-sunken px-3 py-2.5 font-mono text-sm text-ink">
              {issued.token}
            </code>
            <Button variant="secondary" startIcon={copied ? Check : Copy} onClick={handleCopy}>
              {copied ? t('common:actions.copied') : t('common:actions.copy')}
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            {t('token.agentCode')} <span className="font-mono text-ink" dir="ltr">{issued.agent_code || agent.code}</span>
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={working ? () => {} : onClose}
      title={t('token.modalTitle', { action: copy.title, name: agent.name })}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={working}>
            {t('common:actions.cancel')}
          </Button>
          <Button variant={copy.variant} startIcon={KeyRound} onClick={run} isLoading={working}>
            {copy.action}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-secondary">{copy.body}</p>
        {error && <Alert variant="error" title={error.summary} />}
      </div>
    </Modal>
  );
};

export default AgentTokenModal;
