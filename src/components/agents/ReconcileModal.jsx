// src/components/agents/ReconcileModal.jsx
//
// Clean up stale knowledge-base assignments. Opens on a dry run, shows the
// change to each document as a diff the user confirms, then applies it.
//
// One change deserves a callout: a document left with no valid agent is
// reassigned to every consulting agent (`reassigned_to_all`). That is a
// widening of access, not just a tidy-up, so it is flagged per document.
// Nothing is re-parsed or re-embedded — only who may retrieve it changes.
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { ArrowRight, Maximize2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import { agentKbAPI } from '../../api';
import { describeError } from '../../utils/errors';

const Codes = ({ codes, nameOf, strike = false, empty }) => {
  const { t } = useTranslation('agents');
  return codes.length === 0 ? (
    <span className="text-xs text-ink-subtle">{empty ?? t('reconcile.none')}</span>
  ) : (
    <span className="flex flex-wrap gap-1">
      {codes.map((code) => (
        <Badge key={code} size="small" variant={strike ? 'warning' : 'secondary'} className={strike ? 'line-through' : ''}>
          {code === '*' ? t('docRoles.all') : nameOf(code)}
        </Badge>
      ))}
    </span>
  );
};

const ReconcileModal = ({ agents = [], onClose, onDone }) => {
  const { t } = useTranslation('agents');
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
      toast.success(t('reconcile.done', { count: changed }));
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
      title={t('reconcile.title')}
      size="large"
      closeOnOverlayClick={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={applying}>
            {changes.length ? t('common:actions.cancel') : t('common:actions.close')}
          </Button>
          {changes.length > 0 && (
            <Button onClick={apply} isLoading={applying}>
              {t('reconcile.apply', { count: changes.length })}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {loading && <div className="h-32 animate-pulse rounded-xl bg-active" />}

        {error && <Alert variant="error" title={error.summary} />}

        {plan && changes.length === 0 && (
          <Alert variant="success" title={t('reconcile.nothingTitle')}>
            {t('reconcile.nothingBody')}
          </Alert>
        )}

        {changes.length > 0 && (
          <>
            <p className="text-sm text-ink-secondary">
              {t('reconcile.intro', { count: plan.unchanged ?? 0 })}
            </p>

            {widened > 0 && (
              <Alert variant="warning" title={t('reconcile.widenedTitle', { count: widened })}>
                {t('reconcile.widenedBody')}
              </Alert>
            )}

            <ul className="divide-y divide-line-subtle rounded-xl border border-line">
              {changes.map((change) => (
                <li key={change.document_id} className={`space-y-2 px-4 py-3 ${change.reassigned_to_all ? 'bg-warning-soft' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink" dir="auto">{change.filename}</span>
                    {change.reassigned_to_all && (
                      <Badge variant="warning" size="small">
                        <Maximize2 className="h-3 w-3" />
                        {t('reconcile.widenedBadge')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 text-xs sm:flex-row sm:items-center">
                    <Codes codes={change.from || []} nameOf={nameOf} />
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    {change.reassigned_to_all ? (
                      <Badge size="small" variant="secondary">
                        {t('docRoles.all')}
                      </Badge>
                    ) : (
                      <Codes codes={change.to || []} nameOf={nameOf} />
                    )}
                  </div>
                  {change.removed?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      {t('reconcile.removing')} <Codes codes={change.removed} nameOf={nameOf} strike />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {plan.consulting_agents?.length > 0 && (
              <p className="text-xs text-ink-muted">
                {t('reconcile.consulting', { names: plan.consulting_agents.map(nameOf).join(t('listSeparator')) })}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default ReconcileModal;
