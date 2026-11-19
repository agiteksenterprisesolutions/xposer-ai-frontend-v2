// src/components/hierarchy/SyncPanel.jsx
//
// Connecting the organization's HR system, so the directory fills itself.
//
// A field mapping is guesswork until it meets the real payload, and a sync
// writes over the live directory — so Preview (which writes nothing) is the
// primary action and Sync the secondary one. The number to watch in a preview
// is `would_skip_missing_id_or_name`: non-zero almost always means the mapping
// points at the wrong key for the employee ID or name, and the real sync drops
// those rows silently, so a wholly wrong mapping looks like a successful sync
// of nobody.
//
// The credential is write-only. It reads back redacted; an empty input means
// "keep the stored one", which is what the PATCH is for.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, PlugZap, RefreshCw } from 'lucide-react';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import { intlLocale } from '../../utils/locale';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import { ConfirmationModal } from '../ui/Modal';
import { Checkbox } from '../roles/PermissionPicker';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { describeError } from '../../utils/errors';

// Labels: sync.auth.<value>.
const AUTH_TYPES = ['none', 'api_key', 'bearer', 'basic'];

// Our directory fields, and what to tell the user about each mapping.
// Labels: sync.fields.<field>.
const MAPPED_FIELDS = [
  { field: 'external_id', required: true, example: 'employeeId' },
  { field: 'name', required: true, example: 'displayName' },
  { field: 'email', example: 'workEmail' },
  { field: 'designation', example: 'job.title' },
  { field: 'department', example: 'job.department' },
  { field: 'manager_external_id', example: 'manager.employeeId' },
];

const DEFAULTS = {
  api_base_url: '',
  employees_path: '/employees',
  auth_type: 'none',
  auth_header_name: 'Authorization',
  results_path: '',
  field_mapping: { external_id: 'id', name: 'name', email: 'email', designation: 'title', department: 'department', manager_external_id: 'manager_id' },
  sync_frequency_hours: 24,
  is_active: true,
};

const toForm = (config) => ({
  api_base_url: config?.api_base_url ?? DEFAULTS.api_base_url,
  employees_path: config?.employees_path ?? DEFAULTS.employees_path,
  auth_type: config?.auth_type ?? DEFAULTS.auth_type,
  auth_header_name: config?.auth_header_name ?? DEFAULTS.auth_header_name,
  results_path: config?.results_path ?? '',
  field_mapping: { ...DEFAULTS.field_mapping, ...(config?.field_mapping || {}) },
  sync_frequency_hours: String(config?.sync_frequency_hours ?? DEFAULTS.sync_frequency_hours),
  is_active: config?.is_active ?? DEFAULTS.is_active,
});

/** The form as the API wants it; `credential` only when something was typed. */
const toPayload = (form, credential) => ({
  api_base_url: form.api_base_url.trim(),
  employees_path: form.employees_path.trim() || DEFAULTS.employees_path,
  auth_type: form.auth_type,
  auth_header_name: form.auth_header_name.trim() || DEFAULTS.auth_header_name,
  results_path: form.results_path.trim() || null,
  field_mapping: Object.fromEntries(
    Object.entries(form.field_mapping).map(([k, v]) => [k, (v || '').trim()]).filter(([, v]) => v),
  ),
  sync_frequency_hours: Number(form.sync_frequency_hours),
  is_active: form.is_active,
  ...(credential ? { credential } : {}),
});

const lastSyncOf = (config) => config?.last_synced_at || config?.last_sync_at || config?.synced_at || null;

const formatWhen = (value) => {
  if (!value) return null;
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(intlLocale());
};

/** The API may send titles as strings or as { designation, people }. */
const titleOf = (entry) => (typeof entry === 'string' ? entry : entry?.designation || JSON.stringify(entry));

const ErrorAlert = ({ error }) => {
  const { t } = useTranslation('hierarchy');
  if (!error) return null;
  if (error.status === 502) {
    return (
      <Alert variant="error" title={t('sync.unreachable')}>
        {error.summary} {t('sync.nothingChanged')}
      </Alert>
    );
  }
  return (
    <Alert variant="error" title={error.summary}>
      {error.problems.length > 0 && (
        <ul className="list-disc space-y-1 ps-4">
          {error.problems.map((problem, index) => (
            <li key={index}>
              {problem.field ? `${problem.field}: ` : ''}
              {problem.message}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
};

const Figure = ({ label, value, tone = 'default' }) => (
  <div
    className={`rounded-xl border p-3 ${
      tone === 'danger' ? 'border-danger-line bg-danger-soft' : tone === 'warning' ? 'border-warning-line bg-warning-soft' : 'border-line bg-surface'
    }`}
  >
    <p className="text-xs text-ink-muted">{label}</p>
    <p className="mt-0.5 text-xl font-bold text-ink tabular-nums">{value ?? '—'}</p>
  </div>
);

const PreviewResult = ({ preview }) => {
  const { t } = useTranslation('hierarchy');
  const skipped = preview.would_skip_missing_id_or_name || 0;
  const unmapped = preview.unmapped_designations || [];
  const sample = preview.sample || preview.sample_rows || preview.rows || [];
  const mappingUsed = preview.field_mapping_used || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label={t('sync.preview.returned')} value={preview.records_returned} />
        <Figure label={t('sync.preview.wouldSync')} value={preview.would_upsert} />
        <Figure label={t('sync.preview.wouldSkip')} value={skipped} tone={skipped > 0 ? 'danger' : 'default'} />
        <Figure label={t('sync.titlesNoLevel')} value={unmapped.length} tone={unmapped.length > 0 ? 'warning' : 'default'} />
      </div>

      {preview.records_returned === 0 && (
        <Alert variant="warning" title={t('sync.preview.noRecords')}>
          {t('sync.preview.noRecordsBody')}
        </Alert>
      )}

      {skipped > 0 && (
        <Alert variant="error" title={t('sync.preview.skippedTitle', { count: skipped })}>
          <Trans t={t} i18nKey="sync.preview.skippedBody" components={{ strong: <strong /> }} />
        </Alert>
      )}

      {unmapped.length > 0 && (
        <Alert variant="warning" title={t('sync.preview.unmappedTitle')}>
          <p>{t('sync.preview.unmappedBody')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unmapped.map((entry, index) => (
              <span key={index} className="rounded-full border border-warning-line bg-surface px-2 py-0.5 text-xs text-ink" dir="auto">
                {titleOf(entry)}
              </span>
            ))}
          </div>
        </Alert>
      )}

      {Object.keys(mappingUsed).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{t('sync.preview.mappingUsed')}</p>
          <p className="mt-1 font-mono text-xs text-ink-secondary" dir="ltr">
            {Object.entries(mappingUsed)
              .map(([ours, theirs]) => `${ours} ← ${theirs}`)
              .join(' · ')}
          </p>
        </div>
      )}

      {sample.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-start text-xs">
            <thead className="bg-subtle text-ink-subtle">
              <tr>
                {MAPPED_FIELDS.map((f) => (
                  <th key={f.field} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {t(`sync.fields.${f.field}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {sample.map((row, index) => (
                <tr key={index}>
                  {MAPPED_FIELDS.map((f) => (
                    <td key={f.field} className={`px-3 py-2 ${row[f.field] ? 'text-ink' : f.required ? 'text-danger-fg' : 'text-ink-subtle'}`}>
                      {row[f.field] || (f.required ? t('sync.preview.missing') : '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line-subtle px-3 py-2 text-xs text-ink-muted">
            {t('sync.preview.sampleNote')}
          </p>
        </div>
      )}
    </div>
  );
};

const SyncResult = ({ result, onGoTo }) => {
  const unmatched = result.unmatched_designations || [];
  const { t } = useTranslation('hierarchy');
  const waiting = result.awaiting_approval_total ?? 0;
  return (
    <div className="space-y-4">
      {waiting > 0 && (
        <Alert variant="info" title={t('sync.result.waiting', { count: waiting })}>
          <p>
            {[
              result.staged_for_approval ? t('sync.result.stagedNew', { count: result.staged_for_approval }) : '',
              t('sync.result.notAddedUntil'),
              result.skipped_dismissed ? t('sync.result.skippedDismissed', { count: result.skipped_dismissed }) : '',
            ]
              .filter(Boolean)
              .join(' ')}
          </p>
          <Button className="mt-3" variant="outline" size="small" onClick={() => onGoTo('approvals')}>
            {t('sync.result.review')}
          </Button>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label={t('sync.result.synced')} value={result.synced} />
        <Figure label={t('sync.result.placed')} value={result.matched_to_a_level} />
        <Figure label={t('sync.result.deactivated')} value={result.deactivated} />
        <Figure label={t('sync.titlesNoLevel')} value={unmatched.length} tone={unmatched.length > 0 ? 'warning' : 'default'} />
      </div>
      {unmatched.length > 0 && (
        <Alert variant="warning" title={t('sync.result.mapTitle')}>
          <p>{t('sync.result.mapBody')}</p>
          <ul className="mt-2 list-disc space-y-0.5 ps-4">
            {unmatched.map((entry, index) => (
              <li key={index} dir="auto">{titleOf(entry)}</li>
            ))}
          </ul>
          <Button className="mt-3" variant="outline" size="small" onClick={() => onGoTo('coverage')}>
            {t('sync.result.mapOnCoverage')}
          </Button>
        </Alert>
      )}
    </div>
  );
};

/** The HR connection form while its settings load. */
export const SyncSkeleton = () => {
  const { t } = useTranslation('hierarchy');
  return (
  <div className="space-y-6" aria-busy="true">
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton.Text className="w-48" />
      <Skeleton.Text className="w-4/5" />
    </div>
    <Card title={t('sync.connection')} icon={PlugZap}>
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton className="h-13 w-full rounded-lg" />
            <Skeleton.Text size="xs" className="mt-1.5 w-4/5" />
          </div>
        ))}
      </div>
    </Card>
  </div>
  );
};

const SyncPanel = ({ onChanged, onGoTo }) => {
  const { t } = useTranslation('hierarchy');
  const [config, setConfig] = useState(undefined); // undefined loading · null none
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(() => toForm(null));
  const [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(null); // 'save' | 'preview' | 'sync'
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [confirmSync, setConfirmSync] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await orgHierarchyAPI.getSyncConfig();
      setConfig(data);
      setForm(toForm(data));
      setCredential('');
      setLoadError(null);
    } catch (err) {
      setLoadError(describeError(err).summary);
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isConfigured = Boolean(config);
  const credentialSaved = Boolean(config?.credential);
  const needsCredential = form.auth_type !== 'none';
  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const setMapping = (field) => (event) =>
    setForm((prev) => ({ ...prev, field_mapping: { ...prev.field_mapping, [field]: event.target.value } }));

  // What would change on the server — only these go in a PATCH.
  const changes = useMemo(() => {
    const next = toPayload(form, credential);
    if (!isConfigured) return next;
    const saved = toPayload(toForm(config), '');
    const diff = {};
    Object.keys(next).forEach((key) => {
      if (JSON.stringify(next[key]) !== JSON.stringify(saved[key])) diff[key] = next[key];
    });
    return diff;
  }, [form, credential, config, isConfigured]);
  const isDirty = !isConfigured || Object.keys(changes).length > 0;

  const hours = Number(form.sync_frequency_hours);
  const invalid =
    !form.api_base_url.trim() ||
    !form.field_mapping.external_id?.trim() ||
    !form.field_mapping.name?.trim() ||
    !Number.isInteger(hours) ||
    hours < 1 ||
    (needsCredential && !credentialSaved && !credential);

  const saveIfNeeded = async () => {
    if (!isDirty) return true;
    setBusy('save');
    try {
      const saved = isConfigured
        ? await orgHierarchyAPI.patchSyncConfig(changes)
        : await orgHierarchyAPI.putSyncConfig(toPayload(form, credential));
      // Re-read unless the write echoed the whole config back.
      const fresh = saved?.api_base_url ? saved : await orgHierarchyAPI.getSyncConfig();
      setConfig(fresh);
      setForm(toForm(fresh));
      setCredential('');
      return true;
    } catch (err) {
      setError(describeError(err));
      return false;
    }
  };

  const saveAndPreview = async () => {
    setError(null);
    setPreview(null);
    setSyncResult(null);
    if (!(await saveIfNeeded())) {
      setBusy(null);
      return;
    }
    setBusy('preview');
    try {
      setPreview(await orgHierarchyAPI.previewSync({ limit: 10 }));
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const saveOnly = async () => {
    setError(null);
    if (await saveIfNeeded()) toast.success(t('sync.saved'));
    setBusy(null);
  };

  const runSync = async () => {
    setConfirmSync(false);
    setError(null);
    setBusy('sync');
    try {
      const result = await orgHierarchyAPI.sync();
      setSyncResult(result);
      setPreview(null);
      const staged = result?.staged_for_approval ?? 0;
      toast.success(
        staged > 0
          ? `${t('sync.toast.synced', { count: result?.synced ?? 0 })} ${t('sync.toast.newWaiting', { count: staged })}`
          : t('sync.toast.syncedFromHr', { count: result?.synced ?? 0 }),
      );
      onChanged?.();
      load();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  if (config === undefined) return <SyncSkeleton />;

  const lastSync = formatWhen(lastSyncOf(config));

  return (
    <div className="space-y-6">
      {loadError && (
        <Alert variant="error" title={t('sync.loadError')}>
          {loadError}
        </Alert>
      )}

      {!isConfigured && !loadError && (
        <Alert variant="info" title={t('sync.notConnected')}>
          {t('sync.notConnectedBody')}
        </Alert>
      )}

      <Card title={t('sync.connection')} icon={PlugZap}>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('sync.baseUrl')}
              value={form.api_base_url}
              onChange={set('api_base_url')}
              required
              placeholder="https://hr.example.com/api"
              className="font-mono"
            />
            <Input
              label={t('sync.employeesPath')}
              value={form.employees_path}
              onChange={set('employees_path')}
              placeholder="/employees"
              className="font-mono"
              helperText={t('sync.employeesPathHelp')}
            />
            <Input
              label={t('sync.resultsPath')}
              value={form.results_path}
              onChange={set('results_path')}
              placeholder={t('sync.resultsPathPlaceholder')}
              className="font-mono"
              helperText={t('sync.resultsPathHelp')}
            />
            <div className="space-y-1.5">
              <label htmlFor="sync-auth" className="text-xs font-medium text-ink-secondary">
                {t('sync.authentication')}
              </label>
              <select
                id="sync-auth"
                value={form.auth_type}
                onChange={set('auth_type')}
                className="w-full rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink hover:border-line-strong"
              >
                {AUTH_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`sync.auth.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            {needsCredential && form.auth_type !== 'basic' && (
              <Input
                label={t('sync.headerName')}
                value={form.auth_header_name}
                onChange={set('auth_header_name')}
                className="font-mono"
                helperText={form.auth_type === 'api_key' ? t('sync.headerApiKey') : t('sync.headerUsual')}
              />
            )}
            {needsCredential && (
              <Input
                label={form.auth_type === 'basic' ? t('sync.cred.basic') : form.auth_type === 'api_key' ? t('sync.cred.apiKey') : t('sync.cred.token')}
                type="password"
                autoComplete="new-password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                placeholder={credentialSaved ? t('sync.cred.savedPlaceholder') : form.auth_type === 'basic' ? 'user:password' : ''}
                className="font-mono"
                helperText={
                  credentialSaved
                    ? t('sync.cred.savedHelp')
                    : form.auth_type === 'basic'
                      ? t('sync.cred.basicHelp')
                      : t('sync.cred.newHelp')
                }
              />
            )}
          </div>

          {/graph\.microsoft\.com/i.test(form.api_base_url) && (
            <Alert variant="warning" title={t('sync.graph.title')}>
              <ul className="list-disc space-y-1 ps-4">
                <li>
                  <Trans t={t} i18nKey="sync.graph.resultsPath" components={{ code: <span className="font-mono" dir="ltr" /> }} />
                </li>
                <li>
                  <Trans t={t} i18nKey="sync.graph.expand" components={{ code: <span className="font-mono" dir="ltr" /> }} />
                </li>
                <li>{t('sync.graph.paging')}</li>
              </ul>
            </Alert>
          )}

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-ink">{t('sync.mapping')}</p>
              <p className="text-xs text-ink-muted">
                <Trans t={t} i18nKey="sync.mappingHelp" components={{ code: <span className="font-mono" dir="ltr" /> }} />
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MAPPED_FIELDS.map((f) => (
                <Input
                  key={f.field}
                  label={t(`sync.fields.${f.field}`)}
                  value={form.field_mapping[f.field] || ''}
                  onChange={setMapping(f.field)}
                  required={f.required}
                  placeholder={f.example}
                  className="font-mono"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="sm:w-48">
              <Input
                label={t('sync.frequency')}
                type="number"
                min="1"
                step="1"
                value={form.sync_frequency_hours}
                onChange={set('sync_frequency_hours')}
              />
            </div>
            <label className="flex items-start gap-3 pb-2">
              <Checkbox
                checked={form.is_active}
                onChange={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                labelledBy="sync-active"
              />
              <span id="sync-active" className="text-sm text-ink">
                {t('sync.automatic')}
              </span>
            </label>
          </div>

          {lastSync && <p className="text-xs text-ink-muted">{t('sync.lastSynced', { when: lastSync })}</p>}

          <ErrorAlert error={error} />

          <div className="flex flex-col-reverse gap-2 border-t border-line-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-muted">
              {isDirty ? t('sync.previewSavesFirst') : t('sync.previewReadsOnly')}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {isConfigured && isDirty && (
                <Button variant="ghost" onClick={saveOnly} isLoading={busy === 'save'} disabled={invalid || Boolean(busy)}>
                  {t('sync.saveOnly')}
                </Button>
              )}
              <Button
                variant="outline"
                startIcon={RefreshCw}
                onClick={() => setConfirmSync(true)}
                isLoading={busy === 'sync'}
                disabled={!isConfigured || isDirty || Boolean(busy)}
                title={isDirty ? t('sync.syncNowDirty') : t('sync.syncNowHint')}
              >
                {t('sync.syncNow')}
              </Button>
              <Button
                startIcon={Eye}
                onClick={saveAndPreview}
                isLoading={busy === 'save' || busy === 'preview'}
                disabled={invalid || Boolean(busy)}
              >
                {isDirty ? t('sync.savePreview') : t('escalation.d.preview')}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {preview && (
        <Card title={t('escalation.d.preview')} icon={Eye}>
          <PreviewResult preview={preview} />
        </Card>
      )}

      {syncResult && (
        <Card title={t('sync.complete')} icon={CheckCircle2}>
          <SyncResult result={syncResult} onGoTo={onGoTo} />
        </Card>
      )}

      {!preview && !syncResult && isConfigured && (
        <p className="flex items-center gap-2 text-xs text-ink-subtle">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          {t('sync.previewAdvice')}
        </p>
      )}

      <ConfirmationModal
        isOpen={confirmSync}
        onClose={() => setConfirmSync(false)}
        onConfirm={runSync}
        title={t('sync.confirmTitle')}
        message={t('sync.confirmMessage')}
        confirmText={t('sync.syncNow')}
        variant="primary"
        isLoading={busy === 'sync'}
      />
    </div>
  );
};

export default SyncPanel;
