// src/pages/admin/SsoConnections.jsx
//
// Sign-in for named reporters (XPAI-108, SSO.md §3). Tenant admins only
// (sso:manage). Each connection is one place employees sign in to report
// under their name: their company's Microsoft Entra directory or Google
// Workspace (through the customer's own app), or a work email confirmed by an
// emailed code. Every email domain belongs to exactly one connection.
//
// Without connections, employees can only report anonymously. The anonymous
// path is never affected by anything here.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Skeleton from '../../components/ui/Skeleton';
import { ConfirmationModal } from '../../components/ui/Modal';
import { ssoAPI } from '../../api/sso';
import { entitiesAPI } from '../../api/entities';
import { localized } from '../../api/jurisdiction';
import { errorSummary } from '../../utils/errors';
import { formatRelativeTime } from '../../utils/formatters';
import useSEO from '../../hooks/useSEO';
import ProviderIcon from '../../components/sso-admin/ProviderIcon';
import ConnectionEditor from '../../components/sso-admin/ConnectionEditor';
import CopyField from '../../components/sso-admin/CopyField';
import TestResult from '../../components/sso-admin/TestResult';
import { usesApp } from '../../components/sso-admin/ssoUtils';

const Status = ({ connection }) => {
  const { t } = useTranslation('ssoAdmin');
  const problems = connection.problems || [];
  const errors = problems.filter((p) => p.severity === 'error');
  const warnings = problems.filter((p) => p.severity !== 'error');
  const test = connection.last_test;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {errors.length > 0 && <Badge size="small" variant="danger">{t('status.errors', { count: errors.length })}</Badge>}
        {warnings.length > 0 && <Badge size="small" variant="warning">{t('status.warnings', { count: warnings.length })}</Badge>}
        {test ? (
          <Badge size="small" variant={test.ok ? 'success' : 'danger'} dot>
            {test.ok ? t('status.testOk', { when: formatRelativeTime(test.at) }) : t('status.testFailed', { when: formatRelativeTime(test.at) })}
          </Badge>
        ) : (
          !problems.some((p) => p.code === 'test.never') && <Badge size="small" variant="default">{t('status.notTested')}</Badge>
        )}
        {!problems.length && test?.ok && <span className="sr-only">{t('status.ready')}</span>}
      </div>
      {problems.length > 0 && (
        <ul className="space-y-0.5 text-xs">
          {problems.map((p, i) => (
            <li key={i} className={p.severity === 'error' ? 'text-danger-fg' : 'text-warning-fg'}>
              <span className="sr-only">{p.severity === 'error' ? t('status.errorPrefix') : t('status.warningPrefix')}</span>
              {p.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SsoConnections = () => {
  const { t } = useTranslation('ssoAdmin');
  useSEO({ title: t('page.title'), description: t('page.intro'), noIndex: true });
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [entities, setEntities] = useState([]);
  const [editing, setEditing] = useState(null); // a connection, or 'new'
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(null);
  const [testResults, setTestResults] = useState({});

  const load = useCallback(() => {
    setError(null);
    ssoAPI
      .listConnections()
      .then((data) => setItems(data?.items || []))
      .catch((err) => setError(errorSummary(err)));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    entitiesAPI.list().then((list) => setEntities(list.filter((e) => e.is_active !== false))).catch(() => setEntities([]));
  }, []);

  const entityName = (code) => {
    if (!code) return t('wholeGroup');
    const e = entities.find((x) => x.code === code);
    return e ? localized(e.name) : code;
  };

  const replace = (connection) =>
    setItems((list) => {
      const rest = (list || []).filter((c) => c.id !== connection.id);
      return (list || []).some((c) => c.id === connection.id) ? (list || []).map((c) => (c.id === connection.id ? connection : c)) : [...rest, connection];
    });

  const toggle = async (c) => {
    setBusy(`toggle:${c.id}`);
    try {
      const updated = await ssoAPI.updateConnection(c.id, { enabled: !c.enabled });
      replace(updated?.id ? updated : { ...c, enabled: !c.enabled });
      toast.success(c.enabled ? t('toast.paused', { name: c.name }) : t('toast.enabled', { name: c.name }));
    } catch (err) {
      toast.error(errorSummary(err));
    } finally {
      setBusy(null);
    }
  };

  const test = async (c) => {
    setBusy(`test:${c.id}`);
    try {
      const result = await ssoAPI.testConnection(c.id);
      setTestResults((r) => ({ ...r, [c.id]: result }));
      if (result?.connection) replace(result.connection);
    } catch (err) {
      setTestResults((r) => ({ ...r, [c.id]: { ok: false, checks: [], error: errorSummary(err) } }));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const c = deleting;
    setBusy(`delete:${c.id}`);
    try {
      await ssoAPI.deleteConnection(c.id);
      setItems((list) => (list || []).filter((x) => x.id !== c.id));
      toast.success(t('toast.deleted', { name: c.name }));
      setDeleting(null);
    } catch {
      // The interceptor has shown why.
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{t('page.title')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">{t('page.intro')}</p>
        </div>
        <Button startIcon={Plus} onClick={() => setEditing('new')}>{t('actions.add')}</Button>
      </div>

      <Alert variant="info">{t('page.anonymousNote')}</Alert>

      {error && <Alert variant="error">{error}</Alert>}

      {!items && !error ? (
        <Card>
          <Card.Content className="space-y-3">
            {[0, 1].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </Card.Content>
        </Card>
      ) : items?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <KeyRound className="h-7 w-7 text-ink-subtle" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">{t('empty.title')}</p>
          <p className="max-w-md text-sm text-ink-muted">{t('empty.body')}</p>
          <Button className="mt-2" startIcon={Plus} onClick={() => setEditing('new')}>{t('actions.add')}</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {(items || []).map((c) => {
            const off = c.enabled === false;
            return (
              <li key={c.id}>
                <Card>
                  <Card.Content className="space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
                          <ProviderIcon provider={c.provider} />
                        </span>
                        <div className="min-w-0 space-y-1">
                          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold text-ink">
                            <span dir="auto">{c.name}</span>
                            {off && <Badge size="small" variant="default">{t('status.paused')}</Badge>}
                            {c.show_button && <Badge size="small" variant="info">{t('status.button', { label: c.button_label || c.name })}</Badge>}
                          </h2>
                          <p className="text-sm text-ink-secondary">
                            {t(`providers.${c.provider}`, { defaultValue: c.provider })} · <span dir="auto">{entityName(c.entity_code)}</span>
                          </p>
                          <p className="flex flex-wrap gap-1">
                            {(c.domains || []).map((d) => (
                              <span key={d} dir="ltr" className="rounded bg-subtle px-1.5 py-px font-mono text-xs text-ink-secondary">{d}</span>
                            ))}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:justify-end">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!off}
                          aria-label={t('actions.enabledFor', { name: c.name })}
                          disabled={busy === `toggle:${c.id}`}
                          onClick={() => toggle(c)}
                          className={`relative me-2 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${off ? 'bg-line-strong' : 'bg-accent'}`}
                        >
                          <span aria-hidden="true" className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${off ? 'translate-x-0.5 rtl:-translate-x-0.5' : 'translate-x-5.5 rtl:-translate-x-5.5'}`} />
                        </button>
                        <Button variant="secondary" size="small" isLoading={busy === `test:${c.id}`} onClick={() => test(c)} aria-label={t('actions.testFor', { name: c.name })}>
                          {t('actions.test')}
                        </Button>
                        <Button variant="ghost" size="small" aria-label={t('actions.editFor', { name: c.name })} onClick={() => setEditing(c)}>
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="small" aria-label={t('actions.deleteFor', { name: c.name })} onClick={() => setDeleting(c)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                    <Status connection={c} />
                    {usesApp(c.provider) && c.redirect_uri && (
                      <CopyField label={t('fields.redirectUri')} value={c.redirect_uri} hint={t(`hints.redirect.${c.provider}`)} />
                    )}
                    {testResults[c.id] && <TestResult result={testResults[c.id]} />}
                  </Card.Content>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <ConnectionEditor
          connection={editing === 'new' ? null : editing}
          entities={entities}
          onClose={() => setEditing(null)}
          onSaved={replace}
        />
      )}

      <ConfirmationModal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        isLoading={busy === `delete:${deleting?.id}`}
        destructive
        title={t('delete.title', { name: deleting?.name || '' })}
        message={t('delete.body')}
        confirmText={t('delete.confirm')}
      />
    </div>
  );
};

export default SsoConnections;
