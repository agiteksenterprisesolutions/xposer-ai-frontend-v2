// src/pages/admin/Entities.jsx
//
// Legal entities (XPAI-83/84): the companies an organization is made of, such
// as an insurer, a bank or a DIFC branch. Reporters never pick one; the AI
// agents work out which entity a report is about from what was written, so
// each entity's aliases and description matter more than anything else here.
//
// An entity can follow its own jurisdiction pack when it differs from the
// organization's (XPAI-84). Entities are never deleted, only deactivated,
// because filed cases point at them.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building, Info, Pencil, Plus, Power } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import TagInput from '../../components/ui/TagInput';
import { entitiesAPI } from '../../api/entities';
import { jurisdictionAPI, localized } from '../../api/jurisdiction';
import { useOrgJurisdiction } from '../../hooks/useOrgJurisdiction';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { describeError, errorSummary } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';

const CODE = /^[a-z0-9][a-z0-9_-]*$/;
const CURRENCY = /^[A-Za-z]{3}$/;
const CURRENCIES = ['AED', 'SAR', 'USD', 'EUR', 'GBP', 'BHD', 'KWD', 'OMR', 'QAR'];

const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent focus:ring-2 focus:ring-accent-ring read-only:bg-sunken';

const Field = ({ label, htmlFor, hint, error, required, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-secondary">
      {label}
      {required && <span className="ml-0.5 text-danger-fg">*</span>}
    </label>
    {children}
    {error ? <p className="text-xs text-danger-fg">{error}</p> : hint && <p className="text-xs text-ink-muted">{hint}</p>}
  </div>
);

const blank = {
  code: '',
  name: { en: '', ar: '' },
  jurisdiction_pack_code: '',
  regulators: [],
  currency: '',
  default_language: '',
  retention_years: '',
  aliases: [],
  description: '',
};

const EntityForm = ({ isOpen, onClose, entity, region, defaultPack, onSaved }) => {
  const editing = Boolean(entity);
  const [form, setForm] = useState(blank);
  const [packs, setPacks] = useState(null);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(
      entity
        ? {
            code: entity.code,
            name: { en: entity.name?.en || '', ar: entity.name?.ar || '' },
            jurisdiction_pack_code: entity.jurisdiction_pack_code || '',
            regulators: entity.regulators || [],
            currency: entity.currency || '',
            default_language: entity.default_language || '',
            retention_years: entity.retention_years ?? '',
            aliases: entity.aliases || [],
            description: entity.description || '',
          }
        : blank,
    );
    setErrors({});
    setServerError(null);
    jurisdictionAPI
      .list()
      .then((list) => setPacks(list.filter((p) => !region || p.region === region)))
      .catch(() => setPacks([]));
  }, [isOpen, entity, region]);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setServerError(null);
  };

  const save = async () => {
    const next = {};
    if (!editing && !CODE.test(form.code.trim())) next.code = 'Lower-case letters, digits, _ and - only, such as acme_difc.';
    if (!form.name.en.trim()) next.name = 'Enter the English name.';
    if (form.currency && !CURRENCY.test(form.currency.trim())) next.currency = 'A three-letter ISO code, such as AED or SAR.';
    if (form.retention_years !== '' && !(Number(form.retention_years) >= 1)) next.retention_years = 'A whole number of years, 1 or more.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = {
      name: { en: form.name.en.trim(), ar: form.name.ar.trim() || null },
      jurisdiction_pack_code: form.jurisdiction_pack_code || null,
      regulators: form.regulators,
      currency: form.currency.trim().toUpperCase() || null,
      default_language: form.default_language || null,
      retention_years: form.retention_years === '' ? null : Number.parseInt(form.retention_years, 10),
      aliases: form.aliases,
      description: form.description.trim() || null,
    };
    if (!editing) body.code = form.code.trim();
    setSaving(true);
    try {
      const saved = editing ? await entitiesAPI.update(entity.id, body) : await entitiesAPI.create(body);
      toast.success(editing ? 'Entity saved.' : 'Entity added.');
      onSaved(saved);
      onClose();
    } catch (err) {
      const { status, summary, problems } = describeError(err);
      // A 422 names the field (name.en → name); its message is the reason.
      const field = problems?.[0]?.field?.split('.')[0];
      const message = problems?.[0]?.message || summary;
      if (status === 409) setErrors((e) => ({ ...e, code: summary }));
      else if (/pinned|pack/i.test(summary)) setErrors((e) => ({ ...e, jurisdiction_pack_code: summary }));
      else if (field && field in form) setErrors((e) => ({ ...e, [field]: message }));
      else setServerError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={editing ? `Edit ${localized(entity.name) || entity.code}` : 'Add a legal entity'}
      size="large"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} isLoading={saving}>
            {editing ? 'Save changes' : 'Add entity'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code"
            htmlFor="ent-code"
            required={!editing}
            error={errors.code}
            hint={editing ? 'Codes can’t be changed.' : 'Permanent once added. Lower-case, such as acme_difc.'}
          >
            <input
              id="ent-code"
              className={`${inputClass} font-mono`}
              value={form.code}
              readOnly={editing}
              onChange={(e) => set('code', e.target.value.toLowerCase())}
            />
          </Field>
          <Field label="Default language" htmlFor="ent-lang">
            <select id="ent-lang" className={inputClass} value={form.default_language} onChange={(e) => set('default_language', e.target.value)}>
              <option value="">Not set</option>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </Field>
          <Field label="Name (English)" htmlFor="ent-en" required error={errors.name}>
            <input id="ent-en" className={inputClass} value={form.name.en} onChange={(e) => set('name', { ...form.name, en: e.target.value })} />
          </Field>
          <Field label="Name (Arabic)" htmlFor="ent-ar">
            <input
              id="ent-ar"
              dir="rtl"
              lang="ar"
              className={inputClass}
              value={form.name.ar}
              onChange={(e) => set('name', { ...form.name, ar: e.target.value })}
            />
          </Field>
        </div>

        <div className="space-y-3 rounded-xl border border-line-accent bg-accent-soft/40 p-4">
          <p className="flex items-start gap-2 text-sm text-ink-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" />
            <span>
              Reporters are never asked which entity a report is about. The AI matches what they write against these
              names, so add trading names, abbreviations and locations.
            </span>
          </p>
          <Field label="Also known as" hint="Press Enter after each one, such as “Acme DIFC” or “Gate Village office”.">
            <TagInput value={form.aliases} onChange={(v) => set('aliases', v)} placeholder="Add a name and press Enter" />
          </Field>
          <Field label="Description" htmlFor="ent-desc" hint="What this entity does and where, in a sentence or two.">
            <textarea
              id="ent-desc"
              rows={2}
              className={`${inputClass} h-auto min-h-20 py-2`}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Insurance branch in DIFC selling commercial lines."
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Jurisdiction pack"
            htmlFor="ent-pack"
            error={errors.jurisdiction_pack_code}
            hint={`Only if this entity follows a different pack from your organization’s${defaultPack ? ` (${defaultPack})` : ''}.`}
          >
            <select
              id="ent-pack"
              className={inputClass}
              value={form.jurisdiction_pack_code}
              onChange={(e) => set('jurisdiction_pack_code', e.target.value)}
              disabled={packs === null}
            >
              <option value="">Organization default</option>
              {(packs || []).map((pack) => (
                <option key={pack.code} value={pack.code}>
                  {pack.code} · {localized(pack.name)}
                  {pack.active_version ? '' : ' (not active yet)'}
                </option>
              ))}
              {form.jurisdiction_pack_code && packs && !packs.some((p) => p.code === form.jurisdiction_pack_code) && (
                <option value={form.jurisdiction_pack_code}>{form.jurisdiction_pack_code}</option>
              )}
            </select>
          </Field>
          <Field label="Currency" htmlFor="ent-cur" error={errors.currency} hint="Used for money answers on this entity’s cases.">
            <input
              id="ent-cur"
              list="ent-currencies"
              maxLength={3}
              className={`${inputClass} uppercase`}
              value={form.currency}
              onChange={(e) => set('currency', e.target.value.toUpperCase())}
              placeholder="Organization default"
            />
            <datalist id="ent-currencies">
              {CURRENCIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Regulators" hint="Codes, such as DFSA. Press Enter after each.">
            <TagInput value={form.regulators} onChange={(v) => set('regulators', v)} placeholder="Add a regulator" />
          </Field>
          <Field label="Keep cases for (years)" htmlFor="ent-ret" error={errors.retention_years} hint="Optional. The pack’s minimum still applies.">
            <input
              id="ent-ret"
              type="number"
              min="1"
              className={inputClass}
              value={form.retention_years}
              onChange={(e) => set('retention_years', e.target.value)}
            />
          </Field>
        </div>
        {serverError && <Alert variant="error">{serverError}</Alert>}
      </div>
    </Modal>
  );
};

const Entities = () => {
  useSEO({ title: 'Legal Entities', description: 'The companies your organization is made of.', noIndex: true });
  const canManage = useCan()(PERM.entityManage);
  const { organization } = useOrgJurisdiction();
  const [showInactive, setShowInactive] = useState(false);
  const [entities, setEntities] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // an entity, or 'new'
  const [toggling, setToggling] = useState(null);

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
      toast.success(entity.is_active === false ? 'Entity reactivated.' : 'Entity deactivated. Cases already filed keep it.');
      load();
    } catch {
      // The interceptor has shown why.
    } finally {
      setToggling(null);
    }
  };

  const rows = useMemo(() => entities || [], [entities]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Legal Entities</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            The companies your organization is made of. The AI works out which one each report is about, and staff can
            correct it on the case.
          </p>
        </div>
        {canManage && (
          <Button startIcon={Plus} onClick={() => setEditing('new')}>
            Add entity
          </Button>
        )}
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-secondary">
        <input type="checkbox" className="h-4 w-4 rounded border-line-strong" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        Show deactivated entities
      </label>

      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : entities?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <Building className="h-7 w-7 text-ink-subtle" />
          <p className="text-sm font-semibold text-ink">No legal entities yet</p>
          <p className="max-w-md text-sm text-ink-muted">
            Add one for each company or branch, such as an insurer, a bank or a DIFC branch, so the AI can tell reports
            apart.
          </p>
          {canManage && (
            <Button className="mt-2" startIcon={Plus} onClick={() => setEditing('new')}>
              Add entity
            </Button>
          )}
        </div>
      ) : (
        <Card padding="none">
          <Table>
            <Table.Header>
              <Table.Row hover={false}>
                <Table.Head>Entity</Table.Head>
                <Table.Head>Jurisdiction</Table.Head>
                <Table.Head>Regulators</Table.Head>
                <Table.Head>Currency</Table.Head>
                <Table.Head>Status</Table.Head>
                {canManage && <Table.Head className="text-right">Actions</Table.Head>}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {!entities ? (
                <TableLoading
                  rows={4}
                  cells={[
                    <Skeleton.Text key="e" className="w-44" />,
                    <Skeleton.Text key="j" className="w-24" />,
                    <Skeleton.Text key="r" className="w-16" />,
                    <Skeleton.Text key="c" className="w-10" />,
                    <Skeleton.Badge key="s" />,
                    ...(canManage ? [<Skeleton.Text key="a" className="ml-auto w-16" />] : []),
                  ]}
                />
              ) : (
                rows.map((entity) => {
                  const inactive = entity.is_active === false;
                  const actions = canManage && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="small" aria-label={`Edit ${entity.code}`} onClick={() => setEditing(entity)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        startIcon={Power}
                        isLoading={toggling === entity.id}
                        onClick={() => toggle(entity)}
                      >
                        {inactive ? 'Reactivate' : 'Deactivate'}
                      </Button>
                    </div>
                  );
                  return (
                    <Table.Row
                      key={entity.id || entity.code}
                      className={inactive ? 'opacity-60' : ''}
                      mobile={
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate font-medium text-ink">{localized(entity.name)}</span>
                            <Badge size="small" variant={inactive ? 'default' : 'success'} dot>
                              {inactive ? 'Deactivated' : 'Active'}
                            </Badge>
                          </div>
                          <p className="text-xs text-ink-muted">
                            <span className="font-mono">{entity.code}</span> · {entity.jurisdiction_pack_code || 'Organization pack'}
                          </p>
                          {actions}
                        </div>
                      }
                    >
                      <Table.Cell>
                        <p className="font-medium text-ink">{localized(entity.name)}</p>
                        <p className="font-mono text-xs text-ink-muted">{entity.code}</p>
                        {entity.aliases?.length > 0 && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-ink-subtle" title={entity.aliases.join(', ')}>
                            Also: {entity.aliases.join(', ')}
                          </p>
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-sm">
                        {entity.jurisdiction_pack_code ? (
                          <span className="font-mono">{entity.jurisdiction_pack_code}</span>
                        ) : (
                          <span className="text-ink-muted">Organization pack</span>
                        )}
                      </Table.Cell>
                      <Table.Cell className="text-sm text-ink-secondary">{entity.regulators?.join(', ') || '—'}</Table.Cell>
                      <Table.Cell className="text-sm text-ink-secondary">{entity.currency || '—'}</Table.Cell>
                      <Table.Cell>
                        <Badge size="small" variant={inactive ? 'default' : 'success'} dot>
                          {inactive ? 'Deactivated' : 'Active'}
                        </Badge>
                      </Table.Cell>
                      {canManage && <Table.Cell className="text-right">{actions}</Table.Cell>}
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
        entity={editing && editing !== 'new' ? editing : null}
        region={organization?.region || null}
        defaultPack={organization?.default_jurisdiction_pack_code || null}
        onSaved={load}
      />
    </div>
  );
};

export default Entities;
