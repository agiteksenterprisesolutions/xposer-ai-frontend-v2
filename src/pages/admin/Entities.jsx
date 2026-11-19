// src/pages/admin/Entities.jsx
//
// Legal entities (XPAI-222/223, ENTITIES.md §2): the companies in a tenant's
// group, each with its own legal settings. A tenant may have none.
//
// Five settings are inheritable (language, currency, jurisdiction pack,
// business calendar, retention). An entity either inherits the tenant's value
// (`effective[field].source === 'tenant'`, shown greyed with Override) or sets
// its own (Reset to tenant default sends null). Tenant values are read live.
//
// Who can do what:
//   tenant admin (entity:manage)  create, edit, (de)activate; full form
//   entity admin (own entity)     the five settings only, via /settings
//   others with entity:read       view
//
// Entities are never deleted (filed cases point at them), and a case's entity
// comes only from the portal address the reporter used (§3).
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building, Pencil, Plus, Power, RotateCcw, SlidersHorizontal, Unlock } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import TagInput from '../../components/ui/TagInput';
import { entitiesAPI, tenantSettingsAPI, INHERITABLE_FIELDS } from '../../api/entities';
import { localized } from '../../api/jurisdiction';
import { useOrgJurisdiction } from '../../hooks/useOrgJurisdiction';
import { useRegionPacks } from '../../hooks/useRegionPacks';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { PERM } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError, errorSummary } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';
import { CURRENCIES, CURRENCY_PATTERN, Field, RetentionText, inheritedText, inputClass } from '../../components/entities/formParts';

const IDENTIFIER = /^[a-z0-9_-]+$/;

// Tenant setting that each inheritable entity field falls back to.
const TENANT_FIELD = {
  default_language: 'default_language',
  currency: 'default_currency',
  jurisdiction_pack_code: 'default_jurisdiction_pack_code',
  calendar_pack_code: 'default_calendar_pack_code',
  retention_years: 'default_retention_years',
};

/** What the tenant would give this field, for a new entity (no `effective` yet). */
const tenantValue = (field, tenant) => {
  if (!tenant) return undefined;
  if (field === 'jurisdiction_pack_code') return tenant.default_jurisdiction_pack_code || tenant.platform?.default_jurisdiction_pack_code || null;
  return tenant[TENANT_FIELD[field]] ?? null;
};

const initialInherit = (entity, tenant) =>
  Object.fromEntries(
    INHERITABLE_FIELDS.map((field) => {
      const eff = entity?.effective?.[field];
      const own = entity ? entity[field] : null;
      const overridden = entity ? (eff ? eff.source === 'entity' : own !== null && own !== undefined) : false;
      return [field, {
        overridden,
        value: overridden ? (own ?? eff?.value ?? '') : '',
        inherited: eff && eff.source === 'tenant' ? eff.value : tenantValue(field, tenant),
      }];
    }),
  );

// ─── One inheritable setting: inherited (greyed + Override) or own (+ Reset) ──
const InheritableField = ({ field, state, onChange, error, packs }) => {
  const { t } = useTranslation('entities');
  const id = useId();
  const { overridden, value, inherited } = state;
  const label = t(`fields.${field}`);

  const badge = overridden ? (
    <Button variant="ghost" size="small" startIcon={RotateCcw} onClick={() => onChange({ ...state, overridden: false })}>
      {t('inherit.reset')}
    </Button>
  ) : (
    <Button
      variant="ghost"
      size="small"
      startIcon={Unlock}
      onClick={() => onChange({ ...state, overridden: true, value: inherited ?? (field === 'retention_years' ? '' : '') })}
      aria-label={t('inherit.overrideAria', { field: label })}
    >
      {t('inherit.override')}
    </Button>
  );

  const hint = field === 'retention_years' ? t('hints.retention') : field === 'calendar_pack_code' ? t('hints.calendar') : undefined;

  if (!overridden) {
    return (
      <Field label={label} htmlFor={id} badge={badge} hint={hint}>
        <div id={id} className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-ink-muted">
          <span dir="auto">{inheritedText(field, inherited, t, packs)}</span>
          <Badge size="small" variant="default">{t('inherit.badge')}</Badge>
        </div>
      </Field>
    );
  }

  const set = (v) => onChange({ ...state, value: v });
  let control;
  if (field === 'default_language') {
    control = (
      <select id={id} className={inputClass} value={value || ''} onChange={(e) => set(e.target.value)}>
        <option value="en">{t('values.language.en')}</option>
        <option value="ar">{t('values.language.ar')}</option>
      </select>
    );
  } else if (field === 'currency') {
    control = (
      <>
        <input id={id} list={`${id}-list`} maxLength={3} dir="ltr" className={`${inputClass} uppercase`} value={value || ''} onChange={(e) => set(e.target.value.toUpperCase())} />
        <datalist id={`${id}-list`}>{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
      </>
    );
  } else if (field === 'retention_years') {
    control = <input id={id} type="number" min="0" step="1" inputMode="numeric" className={inputClass} value={value ?? ''} onChange={(e) => set(e.target.value)} />;
  } else {
    // jurisdiction_pack_code / calendar_pack_code: active packs in the region.
    control = (
      // Options start with the pack code, which reads left to right.
      <select id={id} dir="ltr" className={inputClass} value={value || ''} onChange={(e) => set(e.target.value)}>
        {field === 'calendar_pack_code' ? <option value="">{t('values.followsPack')}</option> : <option value="" disabled>{t('values.choosePack')}</option>}
        {packs.map((p) => <option key={p.code} value={p.code}>{p.code} · {localized(p.name)}</option>)}
        {value && !packs.some((p) => p.code === value) && <option value={value}>{value}</option>}
      </select>
    );
  }
  return (
    <Field label={label} htmlFor={id} badge={badge} error={error} hint={hint}>
      {control}
    </Field>
  );
};

// ─── Regulators: a checklist of the region's regulators ─────────────────────
const RegulatorPicker = ({ value, onChange, options, error }) => {
  const { t } = useTranslation('entities');
  const labelId = useId();
  // Codes already on the entity that the region no longer lists still show, so
  // they can be removed.
  const all = useMemo(() => {
    const known = new Map(options.map((r) => [r.code, r]));
    value.forEach((code) => !known.has(code) && known.set(code, { code, name: null }));
    return [...known.values()];
  }, [options, value]);

  if (!all.length) {
    return (
      <Field label={t('fields.regulators')} hint={t('hints.regulatorsNone')} error={error}>
        <TagInput value={value} onChange={onChange} ariaLabel={t('fields.regulators')} emptyText={t('values.none')} />
      </Field>
    );
  }
  const toggle = (code) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  return (
    <div className="space-y-1.5">
      <p id={labelId} className="text-sm font-medium text-ink-secondary">{t('fields.regulators')}</p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {all.map((r) => (
          <label key={r.code} className="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border border-line px-2.5 py-1 text-sm text-ink has-[:checked]:border-line-accent has-[:checked]:bg-accent-soft">
            <input type="checkbox" className="h-4 w-4" checked={value.includes(r.code)} onChange={() => toggle(r.code)} />
            <span className="font-mono text-xs" dir="ltr">{r.code}</span>
            {r.name && <span className="text-ink-muted" dir="auto">{localized(r.name)}</span>}
          </label>
        ))}
      </div>
      {error ? <p className="text-xs text-danger-fg">{error}</p> : <p className="text-xs text-ink-muted">{t('hints.regulators')}</p>}
    </div>
  );
};

// ─── The entity form: full (tenant admin) or settings only (entity admin) ───
const EntityForm = ({ isOpen, onClose, entity, settingsOnly, tenant, packs, regulators, onSaved }) => {
  const { t } = useTranslation('entities');
  const editing = Boolean(entity);
  const [identity, setIdentity] = useState(null);
  const [inherit, setInherit] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIdentity({
      code: entity?.code || '',
      nameEn: entity?.name?.en || '',
      nameAr: entity?.name?.ar || '',
      regulators: entity?.regulators || [],
      aliases: entity?.aliases || [],
      description: entity?.description || '',
    });
    setInherit(initialInherit(entity, tenant));
    setErrors({});
    setServerError(null);
  }, [isOpen, entity, tenant]);

  if (!isOpen || !identity || !inherit) return null;

  const setId = (key, value) => {
    setIdentity((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setServerError(null);
  };
  const setInh = (field, value) => {
    setInherit((s) => ({ ...s, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
    setServerError(null);
  };

  // The value each inheritable field would save: own value, or null (inherit).
  const inheritValue = (field) => {
    const { overridden, value } = inherit[field];
    if (!overridden) return null;
    if (field === 'retention_years') return value === '' || value === null ? null : Number.parseInt(value, 10);
    if (field === 'currency') return value ? String(value).toUpperCase() : null;
    return value || null;
  };

  const validate = () => {
    const next = {};
    if (!settingsOnly) {
      if (!editing && !IDENTIFIER.test(identity.code.trim())) next.code = t('errors.identifier');
      if (!identity.nameEn.trim()) next.nameEn = t('errors.nameEn');
      if (!identity.nameAr.trim()) next.nameAr = t('errors.nameAr');
    }
    INHERITABLE_FIELDS.forEach((field) => {
      if (!inherit[field].overridden) return;
      const v = inherit[field].value;
      if (field === 'retention_years' && !/^\d+$/.test(String(v ?? '').trim())) next[field] = t('errors.retention');
      if (field === 'currency' && !CURRENCY_PATTERN.test(String(v || ''))) next[field] = t('errors.currency');
      if (field === 'jurisdiction_pack_code' && !v) next[field] = t('errors.pack');
    });
    setErrors(next);
    return !Object.keys(next).length;
  };

  const save = async () => {
    if (!validate()) return;
    const body = {};
    // The five settings: send what differs from what's stored (null = inherit).
    INHERITABLE_FIELDS.forEach((field) => {
      const next = inheritValue(field);
      const stored = entity ? entity[field] ?? null : null;
      if (!editing ? next !== null : String(next) !== String(stored)) body[field] = next;
    });
    if (!settingsOnly) {
      const name = { en: identity.nameEn.trim(), ar: identity.nameAr.trim() };
      if (!editing || name.en !== (entity.name?.en || '') || name.ar !== (entity.name?.ar || '')) body.name = name;
      const same = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);
      if (!editing || !same(identity.regulators, entity.regulators)) body.regulators = identity.regulators;
      if (!editing || !same(identity.aliases, entity.aliases)) body.aliases = identity.aliases;
      const desc = identity.description.trim() || null;
      if (!editing ? desc !== null : desc !== (entity.description || null)) body.description = desc;
      if (!editing) body.code = identity.code.trim();
    }
    if (editing && !Object.keys(body).length) return onClose();

    setSaving(true);
    try {
      const saved = !editing
        ? await entitiesAPI.create(body)
        : settingsOnly
          ? await entitiesAPI.updateSettings(entity.id, body)
          : await entitiesAPI.update(entity.id, body);
      toast.success(editing ? t('toast.saved') : t('toast.added'));
      onSaved(saved);
      onClose();
    } catch (err) {
      const { summary, problems } = describeError(err);
      const detail = err?.response?.data?.detail || {};
      const code = detail.code || problems?.[0]?.code;
      const field = problems?.[0]?.field?.split('.');
      if (code === 'identifier_taken' || err?.response?.status === 409) setErrors((e) => ({ ...e, code: t('errors.identifierTaken') }));
      else if (code === 'name_ar_required' || (field?.[0] === 'name' && field?.[1] === 'ar')) setErrors((e) => ({ ...e, nameAr: t('errors.nameAr') }));
      else if (code === 'unknown_regulator') {
        const allowed = detail.allowed || problems?.[0]?.allowed;
        setErrors((e) => ({ ...e, regulators: allowed?.length ? t('errors.regulatorAllowed', { codes: allowed.join(', ') }) : summary }));
      } else if (code === 'unknown_pack' || code === 'pack_wrong_region') {
        const target = detail.field || problems?.[0]?.field || (body.calendar_pack_code !== undefined && body.jurisdiction_pack_code === undefined ? 'calendar_pack_code' : 'jurisdiction_pack_code');
        setErrors((e) => ({ ...e, [target]: code === 'pack_wrong_region' ? t('errors.packRegion') : t('errors.packUnknown') }));
      } else if (field?.[0] && INHERITABLE_FIELDS.includes(field[0])) setErrors((e) => ({ ...e, [field[0]]: problems[0].message || summary }));
      else setServerError(summary);
    } finally {
      setSaving(false);
    }
  };

  const title = !editing
    ? t('form.addTitle')
    : settingsOnly
      ? t('form.settingsTitle', { name: localized(entity.name) || entity.code })
      : t('form.editTitle', { name: localized(entity.name) || entity.code });
  const arabicMissing = editing && !settingsOnly && !entity.name?.ar;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={title}
      size="large"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} isLoading={saving}>{editing ? t('common:actions.save') : t('form.add')}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        {arabicMissing && <Alert variant="warning">{t('form.arabicMissing')}</Alert>}

        {!settingsOnly && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('fields.code')}
                htmlFor="ent-code"
                required={!editing}
                error={errors.code}
                hint={editing ? t('hints.codeFixed') : t('hints.code')}
              >
                <input id="ent-code" dir="ltr" className={`${inputClass} font-mono`} value={identity.code} readOnly={editing} onChange={(e) => setId('code', e.target.value.toLowerCase())} />
              </Field>
              <div className="hidden sm:block" />
              <Field label={t('fields.nameEn')} htmlFor="ent-en" required error={errors.nameEn}>
                <input id="ent-en" dir="ltr" lang="en" maxLength={200} className={inputClass} value={identity.nameEn} onChange={(e) => setId('nameEn', e.target.value)} />
              </Field>
              <Field label={t('fields.nameAr')} htmlFor="ent-ar" required error={errors.nameAr}>
                <input id="ent-ar" dir="rtl" lang="ar" maxLength={200} className={inputClass} value={identity.nameAr} onChange={(e) => setId('nameAr', e.target.value)} />
              </Field>
            </div>
            <RegulatorPicker value={identity.regulators} onChange={(v) => setId('regulators', v)} options={regulators} error={errors.regulators} />
          </>
        )}

        <section className="space-y-4 rounded-xl border border-line p-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">{t('form.settingsHeading')}</h3>
            <p className="mt-0.5 text-xs text-ink-muted">{t('form.settingsIntro')}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {INHERITABLE_FIELDS.map((field) => (
              <InheritableField key={field} field={field} state={inherit[field]} onChange={(v) => setInh(field, v)} error={errors[field]} packs={packs} />
            ))}
          </div>
        </section>

        {!settingsOnly && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('fields.aliases')} hint={t('hints.aliases')}>
              <TagInput value={identity.aliases} onChange={(v) => setId('aliases', v)} ariaLabel={t('fields.aliases')} emptyText={t('values.none')} />
            </Field>
            <Field label={t('fields.description')} htmlFor="ent-desc">
              <textarea id="ent-desc" rows={2} dir="auto" className={`${inputClass} h-auto min-h-20 py-2`} value={identity.description} onChange={(e) => setId('description', e.target.value)} />
            </Field>
          </div>
        )}
        {serverError && <Alert variant="error">{serverError}</Alert>}
      </div>
    </Modal>
  );
};

// ─── An effective value in the table, marked when inherited ─────────────────
const EffectiveCell = ({ entity, field, packs, mono = false }) => {
  const { t } = useTranslation('entities');
  const eff = entity.effective?.[field];
  const value = eff ? eff.value : entity[field];
  const text = field === 'retention_years' ? <RetentionText years={value} /> : inheritedText(field, value, t, field.endsWith('pack_code') ? [] : packs);
  return (
    <span className="text-sm text-ink-secondary">
      <span className={mono ? 'font-mono' : undefined} dir={mono ? 'ltr' : undefined}>{text}</span>
      {eff?.source === 'tenant' && <span className="block text-xs text-ink-subtle">{t('inherit.short')}</span>}
    </span>
  );
};

const Entities = () => {
  const { t } = useTranslation('entities');
  useSEO({ title: t('page.title'), description: t('page.intro'), noIndex: true });
  const can = useCan();
  const canManage = can(PERM.entityManage);
  const canTenant = can(PERM.tenantManage);
  const { user } = useAuthStore();
  const { orgSlug } = useParams();
  const { organization } = useOrgJurisdiction();
  const [tenant, setTenant] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [entities, setEntities] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // { entity, settingsOnly } or { entity: null }
  const [toggling, setToggling] = useState(null);

  // Tenant defaults: for the inherited values a new entity shows, and the
  // "missing settings" prompt. Only a tenant admin can read them.
  useEffect(() => {
    if (!canTenant) return;
    tenantSettingsAPI.get().then(setTenant).catch(() => setTenant(null));
  }, [canTenant]);

  const region = tenant?.platform?.region || organization?.region || null;
  const { packs, regulators } = useRegionPacks(region, { enabled: canManage || canTenant || Boolean(user?.entity_code) });

  const load = useCallback(() => {
    setError(null);
    entitiesAPI
      .list({ includeInactive: showInactive })
      .then(setEntities)
      .catch((err) => setError(errorSummary(err)));
  }, [showInactive]);
  useEffect(load, [load]);

  const toggle = async (entity) => {
    setToggling(entity.id);
    try {
      await (entity.is_active === false ? entitiesAPI.activate(entity.id) : entitiesAPI.deactivate(entity.id));
      toast.success(entity.is_active === false ? t('toast.reactivated') : t('toast.deactivated'));
      load();
    } catch {
      // The interceptor has shown why.
    } finally {
      setToggling(null);
    }
  };

  // An entity admin edits their own entity's settings (ENTITY_ADMIN.md).
  const canEditSettings = (entity) => canManage || (user?.entity_code && user.entity_code === entity.code);
  const rows = entities || [];
  const missing = tenant?.missing || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{t('page.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t('page.intro')}</p>
        </div>
        {canManage && (
          <Button startIcon={Plus} onClick={() => setEditing({ entity: null })}>{t('form.add')}</Button>
        )}
      </div>

      {canTenant && missing.length > 0 && (
        <Alert variant="warning" title={t('tenant.missingTitle')}>
          {t('page.missingBody')}{' '}
          <Link to={staffPath(orgSlug || user?.organization_slug, 'tenant-settings')} className="font-medium text-link hover:underline">
            {t('page.missingLink')}
          </Link>
        </Alert>
      )}

      {canManage && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-secondary">
          <input type="checkbox" className="h-4 w-4 rounded border-line-strong" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {t('page.showInactive')}
        </label>
      )}

      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : entities?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <Building className="h-7 w-7 text-ink-subtle" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">{t('page.emptyTitle')}</p>
          <p className="max-w-md text-sm text-ink-muted">{t('page.emptyBody')}</p>
          {canManage && (
            <Button className="mt-2" startIcon={Plus} onClick={() => setEditing({ entity: null })}>{t('form.add')}</Button>
          )}
        </div>
      ) : (
        <Card padding="none">
          <Table>
            <Table.Header>
              <Table.Row hover={false}>
                <Table.Head>{t('columns.entity')}</Table.Head>
                <Table.Head>{t('fields.jurisdiction_pack_code')}</Table.Head>
                <Table.Head>{t('fields.regulators')}</Table.Head>
                <Table.Head>{t('fields.currency')}</Table.Head>
                <Table.Head>{t('columns.retention')}</Table.Head>
                <Table.Head>{t('columns.status')}</Table.Head>
                <Table.Head className="text-end"><span className="sr-only">{t('columns.actions')}</span></Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {!entities ? (
                <TableLoading
                  rows={3}
                  cells={[
                    <Skeleton.Text key="e" className="w-44" />,
                    <Skeleton.Text key="j" className="w-24" />,
                    <Skeleton.Text key="r" className="w-16" />,
                    <Skeleton.Text key="c" className="w-10" />,
                    <Skeleton.Text key="k" className="w-14" />,
                    <Skeleton.Badge key="s" />,
                    <Skeleton.Text key="a" className="ms-auto w-16" />,
                  ]}
                />
              ) : (
                rows.map((entity) => {
                  const inactive = entity.is_active === false;
                  const name = localized(entity.name);
                  const actions = (
                    <div className="flex justify-end gap-1">
                      {canManage ? (
                        <>
                          <Button variant="ghost" size="small" aria-label={t('actions.editAria', { name })} onClick={() => setEditing({ entity })}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button variant="ghost" size="small" startIcon={Power} isLoading={toggling === entity.id} onClick={() => toggle(entity)}>
                            {inactive ? t('actions.reactivate') : t('actions.deactivate')}
                          </Button>
                        </>
                      ) : canEditSettings(entity) ? (
                        <Button variant="ghost" size="small" startIcon={SlidersHorizontal} onClick={() => setEditing({ entity, settingsOnly: true })}>
                          {t('actions.settings')}
                        </Button>
                      ) : null}
                    </div>
                  );
                  const status = (
                    <Badge size="small" variant={inactive ? 'default' : 'success'} dot>
                      {inactive ? t('status.inactive') : t('status.active')}
                    </Badge>
                  );
                  return (
                    <Table.Row
                      key={entity.id || entity.code}
                      className={inactive ? 'opacity-60' : ''}
                      mobile={
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate font-medium text-ink" dir="auto">{name}</span>
                            {status}
                          </div>
                          <p className="text-xs text-ink-muted">
                            <span className="font-mono" dir="ltr">{entity.code}</span> · <RetentionText years={entity.effective?.retention_years?.value ?? entity.retention_years} />
                          </p>
                          {actions}
                        </div>
                      }
                    >
                      <Table.Cell>
                        <p className="font-medium text-ink" dir="auto">{name}</p>
                        {entity.name?.ar && entity.name.ar !== name && <p className="text-sm text-ink-muted" lang="ar" dir="rtl">{entity.name.ar}</p>}
                        <p className="font-mono text-xs text-ink-muted" dir="ltr">{entity.code}</p>
                        {!entity.name?.ar && <p className="text-xs text-warning-fg">{t('page.arabicMissing')}</p>}
                      </Table.Cell>
                      <Table.Cell><EffectiveCell entity={entity} field="jurisdiction_pack_code" packs={packs} mono /></Table.Cell>
                      <Table.Cell className="text-sm text-ink-secondary"><span dir="ltr">{entity.regulators?.join(', ') || '—'}</span></Table.Cell>
                      <Table.Cell><EffectiveCell entity={entity} field="currency" packs={packs} mono /></Table.Cell>
                      <Table.Cell><EffectiveCell entity={entity} field="retention_years" packs={packs} /></Table.Cell>
                      <Table.Cell>{status}</Table.Cell>
                      <Table.Cell className="text-end">{actions}</Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table>
        </Card>
      )}

      <EntityForm
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        entity={editing?.entity || null}
        settingsOnly={Boolean(editing?.settingsOnly)}
        tenant={tenant}
        packs={packs}
        regulators={regulators}
        onSaved={load}
      />
    </div>
  );
};

export default Entities;
