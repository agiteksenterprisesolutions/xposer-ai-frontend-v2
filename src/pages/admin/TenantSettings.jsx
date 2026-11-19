// src/pages/admin/TenantSettings.jsx
//
// Organization defaults (XPAI-222, ENTITIES.md §1): the settings every legal
// entity inherits unless it overrides them. Tenant values are read live, so
// changing one here changes every entity that inherits it, at once.
//
// Retention is required and can't be cleared; 0 means keep forever. The
// region is set by the platform and shown read-only.
//
// The tenant's jurisdiction pack and business calendar are dated (XPAI-224,
// PACK_HISTORY.md §2): they're changed from a date in the pack history below,
// never in the form. The platform only picks the first jurisdiction pack when
// the tenant is created.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Skeleton from '../../components/ui/Skeleton';
import { tenantSettingsAPI } from '../../api/entities';
import { useRegionPacks } from '../../hooks/useRegionPacks';
import { describeError } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';
import { CURRENCIES, CURRENCY_PATTERN, Field, inputClass } from '../../components/entities/formParts';
import PackHistory from '../../components/entities/PackHistory';

const FIELDS = ['default_language', 'default_currency', 'default_retention_years'];

const toForm = (s) => ({
  default_language: s?.default_language || '',
  default_currency: s?.default_currency || '',
  default_retention_years: s?.default_retention_years ?? '',
});

const TenantSettings = () => {
  const { t } = useTranslation('entities');
  useSEO({ title: t('tenant.title'), description: t('tenant.intro'), noIndex: true });
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(toForm(null));
  const [loadError, setLoadError] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const region = settings?.platform?.region || null;
  const { packs } = useRegionPacks(region, { enabled: Boolean(settings) });

  const load = useCallback(() => {
    setLoadError(null);
    tenantSettingsAPI
      .get()
      .then((s) => {
        setSettings(s);
        setForm(toForm(s));
      })
      .catch((err) => setLoadError(describeError(err).summary));
  }, []);
  useEffect(load, [load]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError(null);
  };

  const original = useMemo(() => toForm(settings), [settings]);
  const dirty = FIELDS.some((f) => String(form[f]) !== String(original[f]));

  const save = async () => {
    const next = {};
    const years = String(form.default_retention_years).trim();
    if (years === '') next.default_retention_years = t('errors.retentionRequired');
    else if (!/^\d+$/.test(years)) next.default_retention_years = t('errors.retention');
    if (form.default_currency && !CURRENCY_PATTERN.test(form.default_currency)) next.default_currency = t('errors.currency');
    setErrors(next);
    if (Object.keys(next).length) return;

    // Only what changed; an emptied optional field goes as null.
    const body = {};
    FIELDS.forEach((f) => {
      if (String(form[f]) === String(original[f])) return;
      if (f === 'default_retention_years') body[f] = Number.parseInt(years, 10);
      else if (f === 'default_currency') body[f] = form[f] ? form[f].toUpperCase() : null;
      else body[f] = form[f] || null;
    });
    if (!Object.keys(body).length) return;

    setSaving(true);
    try {
      const saved = await tenantSettingsAPI.update(body);
      setSettings(saved);
      setForm(toForm(saved));
      toast.success(t('tenant.saved'));
    } catch (err) {
      const { summary, problems } = describeError(err);
      const field = problems?.[0]?.field?.split('.').pop();
      const code = err?.response?.data?.detail?.code || problems?.[0]?.code;
      if (code === 'use_pack_assignments') setServerError(t('history.errors.usePackHistory'));
      else if (field && FIELDS.includes(field)) setErrors((e) => ({ ...e, [field]: problems[0].message || summary }));
      else setServerError(summary);
    } finally {
      setSaving(false);
    }
  };

  const missing = settings?.missing || [];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{t('tenant.title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('tenant.intro')}</p>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {missing.length > 0 && (
        <Alert variant="warning" title={t('tenant.missingTitle')}>
          {t('tenant.missingBody', {
            fields: missing.map((f) => t(`tenant.fields.${f}`, { defaultValue: f })).join(t('values.listSeparator')),
          })}
        </Alert>
      )}

      {!settings && !loadError ? (
        <Card>
          <Card.Content className="space-y-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </Card.Content>
        </Card>
      ) : settings && (
        <>
          <Card>
            <Card.Header>
              <Card.Title>{t('tenant.defaultsTitle')}</Card.Title>
            </Card.Header>
            <Card.Content className="grid gap-5 sm:grid-cols-2">
              <Field label={t('tenant.fields.default_retention_years')} htmlFor="ts-ret" required error={errors.default_retention_years} hint={t('tenant.retentionHint')}>
                {(describedBy) => (
                  <input
                    id="ts-ret"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    required
                    aria-invalid={errors.default_retention_years ? 'true' : undefined}
                    aria-describedby={describedBy}
                    className={inputClass}
                    value={form.default_retention_years}
                    onChange={(e) => set('default_retention_years', e.target.value)}
                  />
                )}
              </Field>
              <Field label={t('tenant.fields.default_language')} htmlFor="ts-lang">
                <select id="ts-lang" className={inputClass} value={form.default_language} onChange={(e) => set('default_language', e.target.value)}>
                  <option value="">{t('values.notSet')}</option>
                  <option value="en">{t('values.language.en')}</option>
                  <option value="ar">{t('values.language.ar')}</option>
                </select>
              </Field>
              <Field label={t('tenant.fields.default_currency')} htmlFor="ts-cur" error={errors.default_currency} hint={t('tenant.currencyHint')}>
                {(describedBy) => (
                  <>
                    <input
                      id="ts-cur"
                      list="ts-currencies"
                      maxLength={3}
                      dir="ltr"
                      aria-describedby={describedBy}
                      aria-invalid={errors.default_currency ? 'true' : undefined}
                      className={`${inputClass} uppercase`}
                      value={form.default_currency}
                      onChange={(e) => set('default_currency', e.target.value.toUpperCase())}
                    />
                    <datalist id="ts-currencies">
                      {CURRENCIES.map((c) => <option key={c} value={c} />)}
                    </datalist>
                  </>
                )}
              </Field>
              {serverError && <div className="sm:col-span-2"><Alert variant="error">{serverError}</Alert></div>}
            </Card.Content>
            <Card.Footer className="flex justify-end">
              <Button startIcon={Save} onClick={save} isLoading={saving} disabled={!dirty}>
                {t('common:actions.save')}
              </Button>
            </Card.Footer>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title>{t('history.tenantTitle')}</Card.Title>
            </Card.Header>
            <Card.Content>
              {/* Re-read the settings after a change (the packs in force today
                  may move) without touching unsaved edits in the form above. */}
              <PackHistory scope={null} canChange packs={packs} onChanged={() => tenantSettingsAPI.get().then(setSettings).catch(() => {})} />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                {t('tenant.platformTitle')}
              </Card.Title>
            </Card.Header>
            <Card.Content className="space-y-3">
              <p className="text-sm text-ink-muted">{t('tenant.platformIntro')}</p>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-ink-muted">{t('tenant.region')}</dt>
                  <dd className="mt-1 rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-ink-muted">
                    {settings.platform?.region || t('values.notSet')}
                  </dd>
                </div>
              </dl>
            </Card.Content>
          </Card>
        </>
      )}
    </div>
  );
};

export default TenantSettings;
