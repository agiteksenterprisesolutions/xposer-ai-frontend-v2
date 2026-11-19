// src/components/sso-admin/ConnectionEditor.jsx
//
// Add or edit a sign-in connection for named reporters (SSO.md §3.1).
//
// The provider is fixed once created. Email & password has no app, so the
// directory ID, client ID, secret and redirect URL are hidden for it (the
// server refuses them with 422). The secret is never shown or pre-filled; on
// edit it is only sent when a new one is typed. After the first save the
// connection's redirect URL appears, with Test and the setup guide.
//
// Problems: 400 → detail.problems, nothing saved; 422 → field errors; a
// successful save can still return warnings. Each is shown on its field.
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import TagInput from '../ui/TagInput';
import { ssoAPI } from '../../api/sso';
import { localized } from '../../api/jurisdiction';
import { describeError } from '../../utils/errors';
import ProviderIcon from './ProviderIcon';
import CopyField from './CopyField';
import SetupGuide from './SetupGuide';
import TestResult from './TestResult';
import { GUID, PROVIDERS, domainProblem, groupProblems, normalizeDomain, toBody, toForm, usesApp } from './ssoUtils';

const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent focus:ring-2 focus:ring-accent-ring disabled:bg-sunken';

const Field = ({ id, label, required, hint, errors = [], children }) => {
  const descId = `${id}-desc`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-secondary">
        {label}
        {required && <span className="ms-0.5 text-danger-fg" aria-hidden="true">*</span>}
      </label>
      {children(errors.length || hint ? descId : undefined, errors.length > 0)}
      <div id={descId}>
        {errors.map((e, i) => (
          <p key={i} className={`text-xs ${e.severity === 'warning' ? 'text-warning-fg' : 'text-danger-fg'}`}>{e.message}</p>
        ))}
        {!errors.length && hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
};

const ConnectionEditor = ({ connection, entities, onClose, onSaved }) => {
  const { t, i18n } = useTranslation('ssoAdmin');
  const ids = { provider: useId(), name: useId(), entity: useId(), domains: useId(), tenant: useId(), client: useId(), secret: useId(), label: useId(), show: useId(), enabled: useId() };
  // The saved connection: the one passed in, or the one created here (so the
  // redirect URL and Test appear right after the first save).
  const [saved, setSaved] = useState(connection || null);
  const [form, setForm] = useState(() => toForm(connection));
  const [clientErrors, setClientErrors] = useState({});
  const [serverProblems, setServerProblems] = useState(connection?.problems || []);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const editing = Boolean(saved);
  const app = usesApp(form.provider);

  useEffect(() => {
    setServerProblems(saved?.problems || []);
  }, [saved]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setClientErrors((e) => ({ ...e, [key]: undefined }));
    setServerError(null);
  };

  const { byField, general } = useMemo(() => groupProblems(serverProblems), [serverProblems]);
  const errorsFor = (field) => [...(clientErrors[field] ? [{ severity: 'error', message: clientErrors[field] }] : []), ...(byField[field] || [])];

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t('errors.name');
    if (!form.domains.length) next.domains = t('errors.domainsRequired');
    const bad = form.domains.map((d) => [d, domainProblem(d)]).find(([, p]) => p);
    if (bad) next.domains = t(bad[1] === 'public' ? 'errors.domainPublic' : 'errors.domainFormat', { domain: bad[0] });
    if (form.provider === 'microsoft' && !form.ms_tenant_id.trim()) next.ms_tenant_id = t('errors.tenantIdRequired');
    else if (form.provider === 'microsoft' && !GUID.test(form.ms_tenant_id.trim())) next.ms_tenant_id = t('errors.tenantId');
    if (app && !form.client_id.trim()) next.client_id = t('errors.clientId');
    if (app && !editing && !form.client_secret) next.client_secret = t('errors.secret');
    if (form.show_button && !form.button_label.trim()) next.button_label = t('errors.buttonLabel');
    setClientErrors(next);
    return !Object.keys(next).length;
  };

  const save = async () => {
    if (!validate()) return;
    const body = toBody(form, saved);
    if (editing && !Object.keys(body).length) {
      onClose();
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const result = editing ? await ssoAPI.updateConnection(saved.id, body) : await ssoAPI.createConnection(body);
      const warnings = (result?.problems || []).filter((p) => p.severity === 'warning');
      toast.success(editing ? t('toast.saved') : t('toast.added'));
      if (warnings.length) toast.info(t('toast.warnings', { count: warnings.length }));
      setForm((f) => ({ ...f, client_secret: '' }));
      setSaved(result);
      onSaved(result);
      // A new connection stays open: its redirect URL and Test are what the
      // admin needs next. An edit is done.
      if (editing) onClose();
    } catch (err) {
      const described = describeError(err);
      const detail = err?.response?.data?.detail;
      const problems = Array.isArray(detail?.problems)
        ? detail.problems
        : (described.problems || []).map((p) => ({ severity: 'error', field: p.field, code: p.code, message: p.message }));
      if (problems.length) setServerProblems(problems.map((p) => ({ severity: 'error', ...p })));
      const { general: rest } = groupProblems(problems);
      if (!problems.length || rest.length) setServerError(described.summary);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await ssoAPI.testConnection(saved.id);
      setTestResult(result);
      if (result?.connection) {
        setSaved(result.connection);
        onSaved(result.connection);
      }
    } catch (err) {
      setTestResult({ ok: false, checks: [], error: describeError(err).summary });
    } finally {
      setTesting(false);
    }
  };

  const title = editing ? t('editor.editTitle', { name: saved.name }) : t('editor.addTitle');

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={title}
      size="large"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {editing && !connection ? t('editor.done') : t('common:actions.cancel')}
          </Button>
          <Button onClick={save} isLoading={saving}>
            {editing ? t('common:actions.save') : t('editor.add')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* 1. Provider, fixed once created. */}
        <fieldset className="space-y-2">
          <legend id={ids.provider} className="text-sm font-medium text-ink-secondary">{t('fields.provider')}</legend>
          <div role="radiogroup" aria-labelledby={ids.provider} className="grid gap-2 sm:grid-cols-3">
            {PROVIDERS.map((p) => (
              <label
                key={p}
                className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  form.provider === p ? 'border-line-accent bg-accent-soft text-ink' : 'border-line text-ink-secondary'
                } ${editing ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:bg-hover'}`}
              >
                <input type="radio" name="sso-provider" value={p} checked={form.provider === p} disabled={editing} onChange={() => set('provider', p)} className="h-4 w-4" />
                <ProviderIcon provider={p} className="h-4 w-4" />
                <span>{t(`providers.${p}`)}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-ink-muted">{editing ? t('hints.providerFixed') : t(`hints.provider.${form.provider}`)}</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={ids.name} label={t('fields.name')} required errors={errorsFor('name')} hint={t('hints.name')}>
            {(desc, invalid) => (
              <input id={ids.name} maxLength={120} autoComplete="off" dir="auto" className={inputClass} value={form.name} aria-describedby={desc} aria-invalid={invalid || undefined} onChange={(e) => set('name', e.target.value)} />
            )}
          </Field>
          <Field id={ids.entity} label={t('fields.entity')} errors={errorsFor('entity_code')} hint={t('hints.entity')}>
            {(desc, invalid) => (
              <select id={ids.entity} className={inputClass} value={form.entity_code} aria-describedby={desc} aria-invalid={invalid || undefined} onChange={(e) => set('entity_code', e.target.value)}>
                <option value="">{t('wholeGroup')}</option>
                {entities.map((e) => (
                  <option key={e.code} value={e.code}>{localized(e.name)} ({e.code})</option>
                ))}
                {form.entity_code && !entities.some((e) => e.code === form.entity_code) && <option value={form.entity_code}>{form.entity_code}</option>}
              </select>
            )}
          </Field>
        </div>

        <Field id={ids.domains} label={t('fields.domains')} required errors={errorsFor('domains')} hint={t('hints.domains')}>
          {() => (
            <div dir="ltr" className="text-start">
              <TagInput
                value={form.domains}
                onChange={(v) => set('domains', v)}
                normalize={normalizeDomain}
                placeholder={t('placeholders.domains')}
                ariaLabel={t('fields.domains')}
                emptyText={t('none')}
              />
            </div>
          )}
        </Field>

        {app && (
          <section className="space-y-4 rounded-xl border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">{t(`editor.appHeading.${form.provider}`)}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {form.provider === 'microsoft' && (
                <Field id={ids.tenant} label={t('fields.tenantId')} required errors={errorsFor('ms_tenant_id')} hint={t('hints.tenantId')}>
                  {(desc, invalid) => (
                    <input id={ids.tenant} dir="ltr" autoComplete="off" spellCheck={false} placeholder="00000000-0000-0000-0000-000000000000" className={`${inputClass} font-mono`} value={form.ms_tenant_id} aria-describedby={desc} aria-invalid={invalid || undefined} onChange={(e) => set('ms_tenant_id', e.target.value)} />
                  )}
                </Field>
              )}
              <Field id={ids.client} label={t('fields.clientId')} required errors={errorsFor('client_id')} hint={t(`hints.clientId.${form.provider}`)}>
                {(desc, invalid) => (
                  <input id={ids.client} dir="ltr" autoComplete="off" spellCheck={false} className={`${inputClass} font-mono`} value={form.client_id} aria-describedby={desc} aria-invalid={invalid || undefined} onChange={(e) => set('client_id', e.target.value)} />
                )}
              </Field>
              <Field
                id={ids.secret}
                label={t('fields.secret')}
                required={!editing}
                errors={errorsFor('client_secret')}
                hint={editing && saved?.has_client_secret ? t('hints.secretSet') : t('hints.secret')}
              >
                {(desc, invalid) => (
                  <input id={ids.secret} type="password" dir="ltr" autoComplete="new-password" spellCheck={false} className={`${inputClass} font-mono`} value={form.client_secret} aria-describedby={desc} aria-invalid={invalid || undefined} onChange={(e) => set('client_secret', e.target.value)} />
                )}
              </Field>
            </div>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor={ids.show} className="flex min-h-6 cursor-pointer items-center gap-2 text-sm font-medium text-ink-secondary">
              <input id={ids.show} type="checkbox" className="h-4 w-4" checked={form.show_button} onChange={(e) => set('show_button', e.target.checked)} />
              {t('fields.showButton')}
            </label>
            <p className="text-xs text-ink-muted">{t('hints.showButton')}</p>
          </div>
          <Field id={ids.label} label={t('fields.buttonLabel')} required={form.show_button} errors={errorsFor('button_label')} hint={t('hints.buttonLabel', { provider: t(`providers.${form.provider}`) })}>
            {(desc, invalid) => (
              <input id={ids.label} maxLength={80} autoComplete="off" dir="auto" disabled={!form.show_button} className={inputClass} value={form.button_label} aria-describedby={desc} aria-invalid={invalid || undefined} onChange={(e) => set('button_label', e.target.value)} />
            )}
          </Field>
        </div>

        <label htmlFor={ids.enabled} className="flex min-h-6 w-fit cursor-pointer items-center gap-2 text-sm font-medium text-ink-secondary">
          <input id={ids.enabled} type="checkbox" className="h-4 w-4" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          {t('fields.enabled')}
        </label>

        {general.length > 0 && (
          <Alert variant={general.some((p) => p.severity === 'error') ? 'error' : 'warning'}>
            <ul className="list-disc space-y-1 ps-4">
              {general.map((p, i) => <li key={i}>{p.message}</li>)}
            </ul>
          </Alert>
        )}
        {serverError && <Alert variant="error">{serverError}</Alert>}

        {/* After the first save: the redirect URL, Test, and the setup guide. */}
        {editing && app && (
          <section className="space-y-3 rounded-xl border border-line-accent bg-accent-soft/40 p-4">
            {saved.redirect_uri ? (
              <CopyField label={t('fields.redirectUri')} value={saved.redirect_uri} hint={t(`hints.redirect.${form.provider}`)} />
            ) : (
              <p className="text-sm text-warning-fg">{t('hints.redirectUnset')}</p>
            )}
          </section>
        )}
        {editing && (
          <div className="space-y-2">
            <Button variant="secondary" onClick={runTest} isLoading={testing}>{t('actions.test')}</Button>
            {testResult && <TestResult result={testResult} />}
          </div>
        )}
        {app && <SetupGuide provider={form.provider} redirectUri={saved?.redirect_uri || null} lang={i18n.resolvedLanguage} />}
      </div>
    </Modal>
  );
};

export default ConnectionEditor;
