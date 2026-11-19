// src/components/portal/BrandingSection.jsx
//
// Portal branding (PORTAL.md §3): a display name in English and Arabic, two
// colours and a logo, for the tenant or for one entity. The same branding is
// shown on the public portal page and printed on the QR posters.
//
// The form is filled from `own` (what is set at this level) and the preview
// from `effective` (what the portal actually shows, after an entity's empty
// fields fall back to the tenant's). Saving sends only what changed; `null`
// clears a field so an entity inherits it again.
//
// Brand colours are only used for bands, borders and swatches, never for text:
// an organization's colour can fail contrast against our backgrounds.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Alert from '../ui/Alert';
import Skeleton from '../ui/Skeleton';
import { ConfirmationModal } from '../ui/Modal';
import { portalAPI } from '../../api/portal';
import { entitiesAPI } from '../../api/entities';
import { describeError } from '../../utils/errors';

const HEX = /^#[0-9A-F]{6}$/;
const MAX_NAME = 120;
const MAX_LOGO = 512 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg'];

const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent focus:ring-2 focus:ring-accent-ring';

const normHex = (value) => {
  const v = (value || '').trim().toUpperCase();
  return v && !v.startsWith('#') ? `#${v}` : v;
};

const formFrom = (own) => ({
  name_en: own?.display_name?.en || '',
  name_ar: own?.display_name?.ar || '',
  primary_color: own?.primary_color || '',
  accent_color: own?.accent_color || '',
});

/** Only the fields that differ from what is saved; '' becomes null (clear). */
const changesFrom = (form, own) => {
  const saved = formFrom(own);
  const out = {};
  const nameEn = form.name_en.trim();
  const nameAr = form.name_ar.trim();
  if (nameEn !== saved.name_en || nameAr !== saved.name_ar) {
    out.display_name = { en: nameEn || null, ar: nameAr || null };
  }
  for (const key of ['primary_color', 'accent_color']) {
    const v = normHex(form[key]);
    if (v !== saved[key]) out[key] = v || null;
  }
  return out;
};

const InheritedTag = () => {
  const { t } = useTranslation('portal');
  return <Badge variant="default" size="small">{t('branding.inherited')}</Badge>;
};

const Field = ({ id, label, hint, error, inherited, onClear, clearLabel, children }) => {
  const { t } = useTranslation('portal');
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-ink-secondary">{label}</label>
        <div className="flex items-center gap-2">
          {inherited && <InheritedTag />}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label={clearLabel}
              className="inline-flex min-h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-link hover:underline"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              {t('branding.clear')}
            </button>
          )}
        </div>
      </div>
      {children}
      <p id={`${id}-hint`} className={`text-xs ${error ? 'text-danger-fg' : 'text-ink-muted'}`}>{error || hint}</p>
    </div>
  );
};

const ColorField = ({ id, label, value, onChange, error, inherited, onClear, clearLabel, placeholder }) => {
  const { t } = useTranslation('portal');
  const valid = HEX.test(normHex(value));
  return (
    <Field id={id} label={label} hint={t('branding.colorHint')} error={error} inherited={inherited} onClear={onClear} clearLabel={clearLabel}>
      <div className="flex items-center gap-2" dir="ltr">
        <input
          type="color"
          value={valid ? normHex(value).toLowerCase() : (placeholder || '#000000').toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={t('branding.pickColor', { field: label })}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onBlur={() => value && onChange(normHex(value))}
          placeholder={placeholder || '#RRGGBB'}
          maxLength={7}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={`${id}-hint`}
          className={`${inputClass} font-mono uppercase`}
        />
      </div>
    </Field>
  );
};

/** What the public portal header will look like, from `effective`. */
const BrandingPreview = ({ effective, logoSrc }) => {
  const { t } = useTranslation('portal');
  const primary = effective?.primary_color || 'var(--xp-accent)';
  const accent = effective?.accent_color || 'var(--xp-accent)';
  const nameEn = effective?.display_name?.en;
  const nameAr = effective?.display_name?.ar;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm" aria-label={t('branding.previewLabel')} role="img">
      <div className="h-2" style={{ background: primary }} />
      <div className="flex items-center gap-4 p-5">
        {logoSrc ? (
          <img src={logoSrc} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-line bg-white object-contain p-1" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-xs text-ink-subtle">
            {t('branding.noLogoShort')}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {nameEn && <p className="truncate text-lg font-bold text-ink" dir="ltr">{nameEn}</p>}
          {nameAr && <p className="truncate text-lg font-bold text-ink" lang="ar" dir="rtl">{nameAr}</p>}
          {!nameEn && !nameAr && <p className="text-sm text-ink-muted">{t('branding.noName')}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line px-5 py-3">
        <span className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-on-accent bg-accent" style={{ boxShadow: `inset 0 -3px 0 ${accent}` }}>
          {t('branding.previewButton')}
        </span>
        <span className="h-4 w-4 rounded-full border border-line" style={{ background: primary }} />
        <span className="h-4 w-4 rounded-full border border-line" style={{ background: accent }} />
      </div>
    </div>
  );
};

const BrandingSection = ({ canChooseScope = true, fixedEntityCode = null }) => {
  const { t, i18n } = useTranslation('portal');
  const scopeId = useId();
  const nameEnId = useId();
  const nameArId = useId();
  const primaryId = useId();
  const accentId = useId();
  const fileRef = useRef(null);

  const [entities, setEntities] = useState([]);
  const [scope, setScope] = useState(fixedEntityCode || '');
  const entityCode = scope || null;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(formFrom(null));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [ownLogo, setOwnLogo] = useState(null); // object URL of the logo set at this level
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [confirmLogoRemove, setConfirmLogoRemove] = useState(false);
  const [tenantLogo, setTenantLogo] = useState(null); // for the preview when an entity inherits it

  useEffect(() => {
    if (!canChooseScope) return;
    entitiesAPI.list().then((list) => setEntities((list || []).filter((e) => e.is_active !== false))).catch(() => {});
  }, [canChooseScope]);

  const replaceUrl = (setter) => (blob) =>
    setter((old) => {
      if (old) URL.revokeObjectURL(old);
      return blob ? URL.createObjectURL(blob) : null;
    });

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    setSaveError(null);
    setLogoError(null);
    try {
      const result = await portalAPI.getBranding(entityCode);
      setData(result);
      setForm(formFrom(result.own));
      if (result.own?.has_logo) {
        portalAPI.getLogoBlob(entityCode).then(replaceUrl(setOwnLogo)).catch(() => replaceUrl(setOwnLogo)(null));
      } else replaceUrl(setOwnLogo)(null);
      if (entityCode && result.effective?.logo_from === 'tenant') {
        portalAPI.getLogoBlob(null).then(replaceUrl(setTenantLogo)).catch(() => replaceUrl(setTenantLogo)(null));
      } else replaceUrl(setTenantLogo)(null);
    } catch (err) {
      setError(describeError(err).summary);
    }
  }, [entityCode]);

  useEffect(() => {
    load();
  }, [load]);

  // Object URLs are released when the page goes.
  useEffect(() => () => {
    setOwnLogo((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setTenantLogo((u) => { if (u) URL.revokeObjectURL(u); return null; });
  }, []);

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaveError(null);
  };

  const errors = useMemo(() => {
    const e = {};
    if (form.name_en.length > MAX_NAME) e.name_en = t('branding.nameTooLong', { max: MAX_NAME });
    if (form.name_ar.length > MAX_NAME) e.name_ar = t('branding.nameTooLong', { max: MAX_NAME });
    for (const key of ['primary_color', 'accent_color']) {
      if (form[key] && !HEX.test(normHex(form[key]))) e[key] = t('branding.colorInvalid');
    }
    return e;
  }, [form, t]);

  const changes = data ? changesFrom(form, data.own) : {};
  const dirty = Object.keys(changes).length > 0;

  const save = async () => {
    if (Object.keys(errors).length || !dirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      await portalAPI.updateBranding(changes, entityCode);
      toast.success(t('branding.saved'));
      load();
    } catch (err) {
      setSaveError(describeError(err).summary);
    } finally {
      setSaving(false);
    }
  };

  const logoMessage = (err) => {
    const status = err?.response?.status;
    const code = err?.response?.data?.detail?.code;
    if (status === 413 || code === 'logo_too_large') return t('branding.logo.tooLarge');
    if (status === 415 || code === 'logo_type') return t('branding.logo.wrongType');
    if (code === 'logo_empty') return t('branding.logo.empty');
    return describeError(err).summary;
  };

  const onPickLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLogoError(null);
    if (!LOGO_TYPES.includes(file.type)) return setLogoError(t('branding.logo.wrongType'));
    if (file.size === 0) return setLogoError(t('branding.logo.empty'));
    if (file.size > MAX_LOGO) return setLogoError(t('branding.logo.tooLarge'));
    setLogoBusy(true);
    try {
      await portalAPI.uploadLogo(file, entityCode);
      toast.success(t('branding.logo.uploaded'));
      load();
    } catch (err) {
      setLogoError(logoMessage(err));
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      await portalAPI.deleteLogo(entityCode);
      toast.success(t('branding.logo.removed'));
      setConfirmLogoRemove(false);
      load();
    } catch (err) {
      setLogoError(logoMessage(err));
    } finally {
      setLogoBusy(false);
    }
  };

  const isEntity = Boolean(entityCode);
  const own = data?.own;
  const effective = data?.effective;
  // Whose logo the portal shows: this level's own, or (for an entity) the tenant's.
  const previewLogo =
    effective?.logo_from === 'entity' ? ownLogo
      : effective?.logo_from === 'tenant' ? (isEntity ? tenantLogo : ownLogo)
        : null;
  // Preview reflects unsaved edits on top of what the portal shows now.
  const previewEffective = effective && {
    ...effective,
    display_name: {
      en: form.name_en.trim() || effective.display_name?.en,
      ar: form.name_ar.trim() || (own?.display_name?.ar ? null : effective.display_name?.ar),
    },
    primary_color: HEX.test(normHex(form.primary_color)) ? normHex(form.primary_color) : (form.primary_color ? effective.primary_color : (isEntity ? effective.primary_color : null)),
    accent_color: HEX.test(normHex(form.accent_color)) ? normHex(form.accent_color) : (form.accent_color ? effective.accent_color : (isEntity ? effective.accent_color : null)),
  };
  const entityName = (e) => (i18n.resolvedLanguage === 'ar' && e.name?.ar) || e.name?.en || e.code;

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-ink-muted">{t('branding.intro')}</p>

      {canChooseScope && (
        <div className="max-w-sm space-y-1.5">
          <label htmlFor={scopeId} className="block text-sm font-medium text-ink-secondary">{t('branding.scopeLabel')}</label>
          <select
            id={scopeId}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className={inputClass}
          >
            <option value="">{t('branding.scopeTenant')}</option>
            {entities.map((e) => (
              <option key={e.code} value={e.code}>{t('branding.scopeEntity', { name: entityName(e) })}</option>
            ))}
          </select>
        </div>
      )}

      {error ? (
        <Alert variant="error">
          {error}{' '}
          <Button variant="link" onClick={load}>{t('common:actions.retry')}</Button>
        </Alert>
      ) : !data ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Card>
            <div className="space-y-6">
              {isEntity && <Alert variant="info">{t('branding.entityNote')}</Alert>}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id={nameEnId}
                  label={t('branding.nameEn')}
                  hint={isEntity ? t('branding.nameEnHintEntity') : t('branding.nameEnHint')}
                  error={errors.name_en}
                  inherited={isEntity && !own?.display_name?.en && !form.name_en}
                  onClear={isEntity && own?.display_name?.en ? () => set('name_en')('') : null}
                  clearLabel={t('branding.clearField', { field: t('branding.nameEn') })}
                >
                  <input
                    id={nameEnId}
                    value={form.name_en}
                    onChange={(e) => set('name_en')(e.target.value)}
                    maxLength={MAX_NAME}
                    dir="ltr"
                    lang="en"
                    autoComplete="off"
                    placeholder={isEntity ? effective?.display_name?.en || '' : ''}
                    aria-describedby={`${nameEnId}-hint`}
                    aria-invalid={errors.name_en ? 'true' : undefined}
                    className={inputClass}
                  />
                </Field>
                <Field
                  id={nameArId}
                  label={t('branding.nameAr')}
                  hint={t('branding.nameArHint')}
                  error={errors.name_ar}
                  inherited={isEntity && !own?.display_name?.ar && !form.name_ar}
                  onClear={isEntity && own?.display_name?.ar ? () => set('name_ar')('') : null}
                  clearLabel={t('branding.clearField', { field: t('branding.nameAr') })}
                >
                  <input
                    id={nameArId}
                    value={form.name_ar}
                    onChange={(e) => set('name_ar')(e.target.value)}
                    maxLength={MAX_NAME}
                    dir="rtl"
                    lang="ar"
                    autoComplete="off"
                    placeholder={isEntity ? effective?.display_name?.ar || '' : ''}
                    aria-describedby={`${nameArId}-hint`}
                    aria-invalid={errors.name_ar ? 'true' : undefined}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  id={primaryId}
                  label={t('branding.primary')}
                  value={form.primary_color}
                  onChange={set('primary_color')}
                  error={errors.primary_color}
                  inherited={isEntity && !own?.primary_color && !form.primary_color}
                  onClear={(own?.primary_color || form.primary_color) ? () => set('primary_color')('') : null}
                  clearLabel={t('branding.clearField', { field: t('branding.primary') })}
                  placeholder={isEntity ? effective?.primary_color : null}
                />
                <ColorField
                  id={accentId}
                  label={t('branding.accent')}
                  value={form.accent_color}
                  onChange={set('accent_color')}
                  error={errors.accent_color}
                  inherited={isEntity && !own?.accent_color && !form.accent_color}
                  onClear={(own?.accent_color || form.accent_color) ? () => set('accent_color')('') : null}
                  clearLabel={t('branding.clearField', { field: t('branding.accent') })}
                  placeholder={isEntity ? effective?.accent_color : null}
                />
              </div>

              {saveError && <Alert variant="error">{saveError}</Alert>}
              <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={() => setForm(formFrom(own))} disabled={!dirty || saving}>
                  {t('branding.discard')}
                </Button>
                <Button onClick={save} isLoading={saving} disabled={!dirty || Object.keys(errors).length > 0}>
                  {t('common:actions.save')}
                </Button>
              </div>

              <div className="space-y-3 border-t border-line pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{t('branding.logo.title')}</h3>
                  {isEntity && !own?.has_logo && <InheritedTag />}
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  {ownLogo ? (
                    <img src={ownLogo} alt={t('branding.logo.currentAlt')} className="h-20 w-20 shrink-0 rounded-lg border border-line bg-white object-contain p-1" />
                  ) : (
                    <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong px-2 text-center text-xs text-ink-subtle">
                      {t('branding.logo.none')}
                    </span>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs text-ink-muted">{t('branding.logo.hint')}</p>
                    <div className="flex flex-wrap gap-2">
                      <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPickLogo} />
                      <Button variant="secondary" size="small" startIcon={Upload} onClick={() => fileRef.current?.click()} isLoading={logoBusy}>
                        {own?.has_logo ? t('branding.logo.replace') : t('branding.logo.upload')}
                      </Button>
                      {own?.has_logo && (
                        <Button variant="ghost" size="small" startIcon={Trash2} onClick={() => setConfirmLogoRemove(true)} disabled={logoBusy}>
                          {t('branding.logo.remove')}
                        </Button>
                      )}
                    </div>
                    {logoError && <p role="alert" className="text-xs text-danger-fg">{logoError}</p>}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-2 lg:sticky lg:top-20">
            <h3 className="text-sm font-semibold text-ink">{t('branding.preview')}</h3>
            <BrandingPreview effective={previewEffective} logoSrc={previewLogo} />
            <p className="text-xs text-ink-muted">{t('branding.previewHint')}</p>
            {data.updated_at && <p className="text-xs text-ink-subtle">{t('branding.updatedAt', { date: new Date(data.updated_at).toLocaleString() })}</p>}
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmLogoRemove}
        onClose={() => setConfirmLogoRemove(false)}
        onConfirm={removeLogo}
        isLoading={logoBusy}
        destructive
        title={t('branding.logo.removeTitle')}
        message={isEntity ? t('branding.logo.removeBodyEntity') : t('branding.logo.removeBody')}
        confirmText={t('branding.logo.remove')}
      />
    </div>
  );
};

export default BrandingSection;
