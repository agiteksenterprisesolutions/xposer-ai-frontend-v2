// src/components/agents/ReconcileModal.jsx
//
// Clean up stale knowledge-base assignments. Opens on a dry run, shows the
// change to each document as a diff the user confirms, then applies it.
//
// One change deserves a callout: a document left with no valid agent is
// reassigned to every consulting agent (`reassigned_to_all`). That is a
// widening of access, not just a tidy-up, so it is flagged per document.
// Nothing is re-parsed or re-embedded — only who may retrieve it changes.
import { useEffect, useState } from 'react';
import { ArrowRight, Maximize2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import { agentKbAPI } from '../../api';
import { describeError } from '../../utils/errors';

const Codes = ({ codes, nameOf, strike = false, empty = 'none' }) =>
  codes.length === 0 ? (
    <span className="text-xs text-ink-subtle">{empty}</span>
  ) : (
    <span className="flex flex-wrap gap-1">
      {codes.map((code) => (
        <Badge key={code} size="small" variant={strike ? 'warning' : 'secondary'} className={strike ? 'line-through' : ''}>
          {code === '*' ? 'All agents' : nameOf(code)}
        </Badge>
      ))}
    </span>
  );

const ReconcileModal = ({ agents = [], onClose, onDone }) => {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const nameOf = (code) => agents.find((agent) => agent.code === code)?.name || code;

  useEffect(() => {
    let cancelled = false;
    agentKbAPI
      .reconcile({ dryRun: true })
      .then((data) => !cancelled && setPlan(data))
      .catch((err) => !cancelled && setError(describeError(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      const result = await agentKbAPI.reconcile();
      const changed = result?.changed ?? plan?.changed ?? 0;
      toast.success(`${changed} document${changed === 1 ? '' : 's'} reassigned.`);
      onDone?.();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setApplying(false);
    }
  };

  const changes = plan?.changes || [];
  const widened = changes.filter((change) => change.reassigned_to_all).length;

  return (
    <Modal
      isOpen
      onClose={applying ? () => {} : onClose}
      title="Fix stale document assignments"
      size="large"
      closeOnOverlayClick={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={applying}>
            {changes.length ? 'Cancel' : 'Close'}
          </Button>
          {changes.length > 0 && (
            <Button onClick={apply} isLoading={applying}>
              Apply {changes.length} change{changes.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {loading && <div className="h-32 animate-pulse rounded-xl bg-active" />}

        {error && <Alert variant="error" title={error.summary} />}

        {plan && changes.length === 0 && (
          <Alert variant="success" title="Nothing to fix">
            Every document is assigned only to agents that can read it.
          </Alert>
        )}

        {changes.length > 0 && (
          <>
            <p className="text-sm text-ink-secondary">
              These assignments point at agents that were deleted, deactivated, or can no longer consult the knowledge
              base. Applying removes them. Nothing is re-read or re-indexed. {plan.unchanged ?? 0} other document
              {plan.unchanged === 1 ? ' is' : 's are'} unaffected.
            </p>

            {widened > 0 && (
              <Alert variant="warning" title={`${widened} document${widened === 1 ? '' : 's'} will be opened up to every agent`}>
                These would be left with no agent at all, so they are reassigned to every agent that can consult the
                knowledge base — a wider audience than before. Check them below, and narrow them afterwards if needed.
              </Alert>
            )}

            <ul className="divide-y divide-line-subtle rounded-xl border border-line">
              {changes.map((change) => (
                <li key={change.document_id} className={`space-y-2 px-4 py-3 ${change.reassigned_to_all ? 'bg-warning-soft' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{change.filename}</span>
                    {change.reassigned_to_all && (
                      <Badge variant="warning" size="small">
                        <Maximize2 className="h-3 w-3" />
                        Widened to all agents
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs sm:flex-row sm:items-center">
                    <Codes codes={change.from || []} nameOf={nameOf} />
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    {change.reassigned_to_all ? (
                      <Badge size="small" variant="secondary">
                        All agents
                      </Badge>
                    ) : (
                      <Codes codes={change.to || []} nameOf={nameOf} />
                    )}
                  </div>
                  {change.removed?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      Removing: <Codes codes={change.removed} nameOf={nameOf} strike />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {plan.consulting_agents?.length > 0 && (
              <p className="text-xs text-ink-muted">
                Agents that can consult the knowledge base now: {plan.consulting_agents.map(nameOf).join(', ')}.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default ReconcileModal;
