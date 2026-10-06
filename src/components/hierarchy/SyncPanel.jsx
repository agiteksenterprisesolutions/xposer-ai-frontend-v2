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
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import { ConfirmationModal } from '../ui/Modal';
import { Checkbox } from '../roles/PermissionPicker';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { describeError } from '../../utils/errors';

const AUTH_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'api_key', label: 'API key in a header' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'basic', label: 'Basic (username and password)' },
];

// Our directory fields, and what to tell the user about each mapping.
const MAPPED_FIELDS = [
  { field: 'external_id', label: 'Employee ID', required: true, example: 'employeeId' },
  { field: 'name', label: 'Name', required: true, example: 'displayName' },
  { field: 'email', label: 'Email', example: 'workEmail' },
  { field: 'designation', label: 'Job title', example: 'job.title' },
  { field: 'department', label: 'Department', example: 'job.department' },
  { field: 'manager_external_id', label: "Manager's employee ID", example: 'manager.employeeId' },
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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

/** The API may send titles as strings or as { designation, people }. */
const titleOf = (entry) => (typeof entry === 'string' ? entry : entry?.designation || JSON.stringify(entry));

const ErrorAlert = ({ error }) => {
  if (!error) return null;
  if (error.status === 502) {
    return (
      <Alert variant="error" title="Could not reach your HR system">
        {error.summary} Nothing in the directory was changed.
      </Alert>
    );
  }
  return (
    <Alert variant="error" title={error.summary}>
      {error.problems.length > 0 && (
        <ul className="list-disc space-y-1 pl-4">
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
  const skipped = preview.would_skip_missing_id_or_name || 0;
  const unmapped = preview.unmapped_designations || [];
  const sample = preview.sample || preview.sample_rows || preview.rows || [];
  const mappingUsed = preview.field_mapping_used || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label="Records returned" value={preview.records_returned} />
        <Figure label="Would be synced" value={preview.would_upsert} />
        <Figure label="Would be skipped" value={skipped} tone={skipped > 0 ? 'danger' : 'default'} />
        <Figure label="Titles on no level" value={unmapped.length} tone={unmapped.length > 0 ? 'warning' : 'default'} />
      </div>

      {preview.records_returned === 0 && (
        <Alert variant="warning" title="Your HR system returned no records">
          Check the employees path, and the results path if the list is nested inside the response.
        </Alert>
      )}

      {skipped > 0 && (
        <Alert variant="error" title={`${skipped} record${skipped === 1 ? '' : 's'} would be skipped for having no ID or name`}>
          This almost always means the mapping for <strong>Employee ID</strong> or <strong>Name</strong> points at the
          wrong field. A real sync drops these rows without saying so — fix the mapping and preview again before syncing.
        </Alert>
      )}

      {unmapped.length > 0 && (
        <Alert variant="warning" title="Job titles that match no level">
          <p>People with these titles would sync with no level. Add each title to a level's job titles first, or map them on the Coverage tab after syncing.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unmapped.map((entry, index) => (
              <span key={index} className="rounded-full border border-warning-line bg-surface px-2 py-0.5 text-xs text-ink">
                {titleOf(entry)}
              </span>
            ))}
          </div>
        </Alert>
      )}

      {Object.keys(mappingUsed).length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">Mapping used</p>
          <p className="mt-1 font-mono text-xs text-ink-secondary">
            {Object.entries(mappingUsed)
              .map(([ours, theirs]) => `${ours} ← ${theirs}`)
              .join(' · ')}
          </p>
        </div>
      )}

      {sample.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-subtle text-ink-subtle">
              <tr>
                {MAPPED_FIELDS.map((f) => (
                  <th key={f.field} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {sample.map((row, index) => (
                <tr key={index}>
                  {MAPPED_FIELDS.map((f) => (
                    <td key={f.field} className={`px-3 py-2 ${row[f.field] ? 'text-ink' : f.required ? 'text-danger-fg' : 'text-ink-subtle'}`}>
                      {row[f.field] || (f.required ? 'missing' : '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line-subtle px-3 py-2 text-xs text-ink-muted">
            A sample of rows as they would be stored. Nothing has been written.
          </p>
        </div>
      )}
    </div>
  );
};

const SyncResult = ({ result, onGoTo }) => {
  const unmatched = result.unmatched_designations || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure label="Synced" value={result.synced} />
        <Figure label="Placed on a level" value={result.matched_to_a_level} />
        <Figure label="Deactivated (left HR)" value={result.deactivated} />
        <Figure label="Titles on no level" value={unmatched.length} tone={unmatched.length > 0 ? 'warning' : 'default'} />
      </div>
      {unmatched.length > 0 && (
        <Alert variant="warning" title="Next: map these job titles">
          <p>People with these titles were synced with no level, so they can't be escalated from yet.</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-4">
            {unmatched.map((entry, index) => (
              <li key={index}>{titleOf(entry)}</li>
            ))}
          </ul>
          <Button className="mt-3" variant="outline" size="small" onClick={() => onGoTo('coverage')}>
            Map them on the Coverage tab
          </Button>
        </Alert>
      )}
    </div>
  );
};

/** The HR connection form while its settings load. */
export const SyncSkeleton = () => (
  <div className="space-y-6" aria-busy="true">
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton.Text className="w-48" />
      <Skeleton.Text className="w-4/5" />
    </div>
    <Card title="Connection" icon={PlugZap}>
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

const SyncPanel = ({ onChanged, onGoTo }) => {
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
    if (await saveIfNeeded()) toast.success('HR connection saved.');
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
      toast.success(`Synced ${result?.synced ?? 0} people from HR.`);
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
        <Alert variant="error" title="Couldn't load the HR connection">
          {loadError}
        </Alert>
      )}

      {!isConfigured && !loadError && (
        <Alert variant="info" title="No HR system connected">
          Connect any HR system that returns employees as JSON. Until then, add people by hand or paste them on the
          Directory tab.
        </Alert>
      )}

      <Card title="Connection" icon={PlugZap}>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="API base URL"
              value={form.api_base_url}
              onChange={set('api_base_url')}
              required
              placeholder="https://hr.example.com/api"
              className="font-mono"
            />
            <Input
              label="Employees path"
              value={form.employees_path}
              onChange={set('employees_path')}
              placeholder="/employees"
              className="font-mono"
              helperText="The path (or full URL) that returns the list of employees."
            />
            <Input
              label="Results path"
              value={form.results_path}
              onChange={set('results_path')}
              placeholder="e.g. data.employees"
              className="font-mono"
              helperText="Where the list sits inside the response, as a dot-path. Leave empty if the response is the list."
            />
            <div className="space-y-1.5">
              <label htmlFor="sync-auth" className="text-xs font-medium text-ink-secondary">
                Authentication
              </label>
              <select
                id="sync-auth"
                value={form.auth_type}
                onChange={set('auth_type')}
                className="w-full rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink hover:border-line-strong"
              >
                {AUTH_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {needsCredential && form.auth_type !== 'basic' && (
              <Input
                label="Header name"
                value={form.auth_header_name}
                onChange={set('auth_header_name')}
                className="font-mono"
                helperText={form.auth_type === 'api_key' ? 'Often X-API-Key — check your HR system.' : 'Usually Authorization.'}
              />
            )}
            {needsCredential && (
              <Input
                label={form.auth_type === 'basic' ? 'Username and password' : form.auth_type === 'api_key' ? 'API key' : 'Token'}
                type="password"
                autoComplete="new-password"
                value={credential}
                onChange={(event) => setCredential(event.target.value)}
                placeholder={credentialSaved ? '•••••••• saved — leave empty to keep' : form.auth_type === 'basic' ? 'user:password' : ''}
                className="font-mono"
                helperText={
                  credentialSaved
                    ? 'A credential is saved and never shown again. Type a new one only to replace it.'
                    : form.auth_type === 'basic'
                      ? 'As user:password.'
                      : 'Stored securely and never shown again.'
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium text-ink">Field mapping</p>
              <p className="text-xs text-ink-muted">
                The name of each field in your HR system's JSON. Use dots for nested fields — e.g. <span className="font-mono">job.title</span>.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MAPPED_FIELDS.map((f) => (
                <Input
                  key={f.field}
                  label={f.label}
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
                label="Sync every (hours)"
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
                Sync automatically on this schedule
              </span>
            </label>
          </div>

          {lastSync && <p className="text-xs text-ink-muted">Last synced {lastSync}.</p>}

          <ErrorAlert error={error} />

          <div className="flex flex-col-reverse gap-2 border-t border-line-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-muted">
              {isDirty ? 'Previewing saves these settings first.' : 'Preview reads from your HR system and writes nothing.'}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {isConfigured && isDirty && (
                <Button variant="ghost" onClick={saveOnly} isLoading={busy === 'save'} disabled={invalid || Boolean(busy)}>
                  Save only
                </Button>
              )}
              <Button
                variant="outline"
                startIcon={RefreshCw}
                onClick={() => setConfirmSync(true)}
                isLoading={busy === 'sync'}
                disabled={!isConfigured || isDirty || Boolean(busy)}
                title={isDirty ? 'Save and preview your changes first' : 'Pull from HR into the live directory'}
              >
                Sync now
              </Button>
              <Button
                startIcon={Eye}
                onClick={saveAndPreview}
                isLoading={busy === 'save' || busy === 'preview'}
                disabled={invalid || Boolean(busy)}
              >
                {isDirty ? 'Save & preview' : 'Preview'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {preview && (
        <Card title="Preview" icon={Eye}>
          <PreviewResult preview={preview} />
        </Card>
      )}

      {syncResult && (
        <Card title="Sync complete" icon={CheckCircle2}>
          <SyncResult result={syncResult} onGoTo={onGoTo} />
        </Card>
      )}

      {!preview && !syncResult && isConfigured && (
        <p className="flex items-center gap-2 text-xs text-ink-subtle">
          <AlertTriangle className="h-3.5 w-3.5" />
          Preview before every first sync or mapping change — a wrong mapping otherwise looks like a successful sync of
          nobody.
        </p>
      )}

      <ConfirmationModal
        isOpen={confirmSync}
        onClose={() => setConfirmSync(false)}
        onConfirm={runSync}
        title="Sync from HR now?"
        message="This pulls every employee from your HR system into the live directory. People who were synced before but are missing from this pull will be deactivated. People added by hand, and corrections to level and manager, are kept."
        confirmText="Sync now"
        variant="primary"
        isLoading={busy === 'sync'}
      />
    </div>
  );
};

export default SyncPanel;
