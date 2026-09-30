// src/components/agents/AgentTokenModal.jsx
//
// Mint, rotate or revoke an agent's credential for the multiagent service.
//
// A token is shown exactly once: only its hash is stored, and nothing can ask
// for it again. So the reveal step cannot be dismissed by accident — no
// overlay click, no Escape, no close button — until the user says it is
// stored. Rotating invalidates the previous token the moment it succeeds.
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

const COPY = {
  mint: {
    title: 'Create a token',
    body: 'The multiagent service uses this token to act as the agent. It is shown once, so have somewhere safe ready to store it.',
    action: 'Create token',
    variant: 'primary',
  },
  rotate: {
    title: 'Rotate the token',
    body: 'A new token replaces the current one immediately. Anything still using the old token stops working until it is given the new one.',
    action: 'Rotate token',
    variant: 'warning',
  },
  revoke: {
    title: 'Revoke the token',
    body: 'The agent stops being able to act as soon as the token is revoked. You can create a new one later.',
    action: 'Revoke token',
    variant: 'danger',
  },
};

/** mode: 'mint' | 'rotate' | 'revoke' */
const AgentTokenModal = ({ agent, mode, onClose, onDone }) => {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);
  const [stored, setStored] = useState(false);
  const copy = COPY[mode];

  const run = async () => {
    setWorking(true);
    setError(null);
    try {
      if (mode === 'revoke') {
        await orgAgentsAPI.revokeToken(agent.id);
        toast.success(`Token revoked for ${agent.name}.`);
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
      toast.error('Could not copy — select the token and copy it manually.');
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
        title={`Token for ${agent.name}`}
        size="medium"
        closeOnOverlayClick={false}
        closeOnEsc={false}
        showCloseButton={false}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <Checkbox checked={stored} onChange={() => setStored((v) => !v)} labelledBy="token-stored" />
              <span id="token-stored">I've stored this token somewhere safe</span>
            </label>
            <Button onClick={onClose} disabled={!stored}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert variant="warning" title="This is the only time the token is shown">
            {issued.note || 'Store it now — it cannot be recovered. Rotating replaces it immediately.'}
          </Alert>
          <div className="flex items-stretch gap-2">
            <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-line bg-sunken px-3 py-2.5 font-mono text-sm text-ink">
              {issued.token}
            </code>
            <Button variant="secondary" startIcon={copied ? Check : Copy} onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Agent code <span className="font-mono text-ink">{issued.agent_code || agent.code}</span>
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={working ? () => {} : onClose}
      title={`${copy.title} — ${agent.name}`}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={working}>
            Cancel
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
