// src/components/posters/PosterForm.jsx
//
// Create or edit a QR poster (PORTAL.md §4). There is no default text: the
// admin writes the heading, up to six instruction lines and the footer, each
// in English and/or Arabic. Editing sends only the fields that changed.
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { portalAPI } from '../../api/portal';
import { describeError } from '../../utils/errors';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

export const LIMITS = { name: 120, heading: 120, instruction: 200, footer: 200, lines: 6 };
export const SIZES = ['A4', 'A3'];

const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent focus:ring-2 focus:ring-accent-ring aria-[invalid=true]:border-danger-line';

const emptyPair = () => ({ en: '', ar: '' });

const fromPoster = (poster) => ({
  name: poster?.name || '',
  entity_code: poster?.entity_code || '',
  sizes: poster?.sizes?.length ? [...poster.sizes] : ['A4'],
  heading: { en: poster?.heading?.en || '', ar: poster?.heading?.ar || '' },
  instructions: (poster?.instructions || []).map((l) => ({ en: l?.en || '', ar: l?.ar || '' })),
  footer: { en: poster?.footer?.en || '', ar: poster?.footer?.ar || '' },
  is_active: poster ? poster.is_active !== false : true,
});

const pair = (p) => ({ en: p.en.trim() || null, ar: p.ar.trim() || null });

/** The body the API takes, from the form. */
const toBody = (form) => ({
  name: form.name.trim(),
  entity_code: form.entity_code || null,
  sizes: SIZES.filter((s) => form.sizes.includes(s)),
  heading: pair(form.heading),
  instructions: form.instructions.map(pair).filter((l) => l.en || l.ar),
  footer: pair(form.footer),
  is_active: form.is_active,
});

/** Localized label of an address row. */
const addressLabel = (item, lang) => {
  const label = item.label;
  if (label && typeof label === 'object') return (lang === 'ar' && label.ar) || label.en || label.ar || item.entity_code;
  return label || item.entity_code || item.slug;
};

const Field = ({ label, htmlFor, hint, error, required, count, max, children }) => {
  const { t } = useTranslation('posters');
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-secondary">
          {label}
          {required && <span className="ms-0.5 text-danger-fg" aria-hidden="true">*</span>}
        </label>
        {max != null && (
          <span className={`text-xs ${count > max ? 'text-danger-fg' : 'text-ink-subtle'}`} aria-hidden="true">
            {t('form.count', { count, max })}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs text-danger-fg">{error}</p>
      ) : (
        hint && <p id={`${htmlFor}-hint`} className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
};

/** An English and an Arabic input side by side. */
const PairInputs = ({ idBase, label, value, onChange, max, error, required, multiline = false }) => {
  const { t } = useTranslation('posters');
  const Tag = multiline ? 'textarea' : 'input';
  const extra = multiline ? { rows: 2, className: `${inputClass} h-auto min-h-16 py-2` } : { className: inputClass };
  const describedBy = (lang) => (error ? `${idBase}-${lang}-error` : undefined);
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold text-ink">
        {label}
        {required && <span className="ms-0.5 text-danger-fg" aria-hidden="true">*</span>}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('form.english')} htmlFor={`${idBase}-en`} count={value.en.length} max={max} error={error}>
          <Tag
            id={`${idBase}-en`}
            lang="en"
            dir="ltr"
            value={value.en}
            maxLength={max}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy('en')}
            onChange={(e) => onChange({ ...value, en: e.target.value })}
            {...extra}
          />
        </Field>
        <Field label={t('form.arabic')} htmlFor={`${idBase}-ar`} count={value.ar.length} max={max}>
          <Tag
            id={`${idBase}-ar`}
            lang="ar"
            dir="rtl"
            value={value.ar}
            maxLength={max}
            aria-invalid={error ? 'true' : undefined}
            onChange={(e) => onChange({ ...value, ar: e.target.value })}
            {...extra}
          />
        </Field>
      </div>
    </fieldset>
  );
};

const PosterForm = ({ poster, onSaved, onCancel }) => {
  const { t, i18n } = useTranslation('posters');
  const editing = Boolean(poster?.id);
  const [form, setForm] = useState(() => fromPoster(poster));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addresses, setAddresses] = useState(null);
  const sizesLabelId = useId();
  const activeLabelId = useId();
  const original = useMemo(() => toBody(fromPoster(poster)), [poster]);

  useEffect(() => {
    setForm(fromPoster(poster));
    setErrors({});
    setServerError(null);
  }, [poster]);

  // Addresses a poster can open: the tenant's, or an entity's that has one.
  // Only tenant admins can list them; anyone else keeps the poster's own.
  useEffect(() => {
    let cancelled = false;
    portalAPI
      .getAddresses()
      .then((data) => {
        if (!cancelled) setAddresses((data?.items || []).filter((item) => item.url));
      })
      .catch(() => {
        if (!cancelled) setAddresses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    const list = (addresses || []).map((item) => ({
      value: item.entity_code || '',
      label: item.kind === 'tenant' || !item.entity_code ? t('form.addressTenant', { name: addressLabel(item, i18n.resolvedLanguage) }) : addressLabel(item, i18n.resolvedLanguage),
      url: item.url,
    }));
    // Keep the poster's current address selectable even when it isn't listed.
    if (poster && !list.some((o) => o.value === (poster.entity_code || ''))) {
      list.push({ value: poster.entity_code || '', label: poster.entity_code || t('form.addressTenantShort'), url: poster.url });
    }
    return list;
  }, [addresses, poster, t, i18n.resolvedLanguage]);

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    setServerError(null);
  };

  const setLine = (index, value) => set('instructions', form.instructions.map((l, i) => (i === index ? value : l)));
  const moveLine = (index, delta) => {
    const next = [...form.instructions];
    const [line] = next.splice(index, 1);
    next.splice(index + delta, 0, line);
    set('instructions', next);
  };

  const validate = () => {
    const next = {};
    const name = form.name.trim();
    if (!name) next.name = t('errors.nameRequired');
    else if (name.length > LIMITS.name) next.name = t('errors.tooLong', { max: LIMITS.name });
    if (!form.sizes.length) next.sizes = t('errors.sizeRequired');
    if (!form.heading.en.trim() && !form.heading.ar.trim()) next.heading = t('errors.headingRequired');
    else if (form.heading.en.length > LIMITS.heading || form.heading.ar.length > LIMITS.heading) next.heading = t('errors.tooLong', { max: LIMITS.heading });
    form.instructions.forEach((l, i) => {
      if (l.en.length > LIMITS.instruction || l.ar.length > LIMITS.instruction) next[`line${i}`] = t('errors.tooLong', { max: LIMITS.instruction });
    });
    if (form.footer.en.length > LIMITS.footer || form.footer.ar.length > LIMITS.footer) next.footer = t('errors.tooLong', { max: LIMITS.footer });
    if (addresses && options.length === 0) next.entity_code = t('errors.noAddresses');
    return next;
  };

  const save = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      const id = first.startsWith('line') ? `poster-line-${first.slice(4)}-en` : { heading: 'poster-heading-en', footer: 'poster-footer-en', sizes: 'poster-size-A4' }[first] || `poster-${first}`;
      document.getElementById(id)?.focus();
      return;
    }
    const body = toBody(form);
    const payload = editing
      ? Object.fromEntries(Object.entries(body).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(original[k])))
      : body;
    if (editing && Object.keys(payload).length === 0) {
      toast.info(t('toast.nothingChanged'));
      return;
    }
    setSaving(true);
    try {
      const saved = editing ? await portalAPI.updatePoster(poster.id, payload) : await portalAPI.createPoster(payload);
      toast.success(editing ? t('toast.saved') : t('toast.created'));
      onSaved(saved && typeof saved === 'object' ? { ...poster, ...body, ...saved } : { ...poster, ...body });
    } catch (err) {
      const { summary, problems } = describeError(err);
      const code = err?.response?.data?.detail?.code;
      if (code === 'unknown_entity') {
        setErrors((e) => ({ ...e, entity_code: summary || t('errors.unknownEntity') }));
        return;
      }
      const fieldErrors = {};
      (problems || []).forEach((p) => {
        const [field, index] = String(p.field || '').split('.');
        if (field === 'instructions' && /^\d+$/.test(index || '')) fieldErrors[`line${index}`] = p.message;
        else if (field in form) fieldErrors[field] = p.message;
      });
      if (Object.keys(fieldErrors).length) setErrors((e) => ({ ...e, ...fieldErrors }));
      else setServerError(summary);
    } finally {
      setSaving(false);
    }
  };

  const selected = options.find((o) => o.value === form.entity_code);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-6"
    >
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('form.name')} htmlFor="poster-name" required error={errors.name} hint={t('form.nameHint')} count={form.name.length} max={LIMITS.name}>
          <input
            id="poster-name"
            dir="auto"
            className={inputClass}
            value={form.name}
            maxLength={LIMITS.name}
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? 'poster-name-error' : 'poster-name-hint'}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label={t('form.address')} htmlFor="poster-entity_code" required error={errors.entity_code} hint={selected?.url}>
          <select
            id="poster-entity_code"
            className={inputClass}
            value={form.entity_code}
            disabled={addresses === null}
            aria-invalid={errors.entity_code ? 'true' : undefined}
            aria-describedby={errors.entity_code ? 'poster-entity_code-error' : 'poster-entity_code-hint'}
            onChange={(e) => set('entity_code', e.target.value)}
          >
            {addresses === null && <option value={form.entity_code}>{t('form.loadingAddresses')}</option>}
            {options.map((o) => (
              <option key={o.value || 'tenant'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div role="group" aria-labelledby={sizesLabelId} aria-describedby={errors.sizes ? 'poster-sizes-error' : undefined} className="space-y-1.5">
          <p id={sizesLabelId} className="text-sm font-medium text-ink-secondary">
            {t('form.sizes')}
            <span className="ms-0.5 text-danger-fg" aria-hidden="true">*</span>
          </p>
          <div className="flex gap-4">
            {SIZES.map((size) => (
              <label key={size} className="flex min-h-6 cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  id={`poster-size-${size}`}
                  type="checkbox"
                  className="h-4 w-4 rounded border-line-strong"
                  checked={form.sizes.includes(size)}
                  onChange={(e) => set('sizes', e.target.checked ? [...form.sizes, size] : form.sizes.filter((s) => s !== size))}
                />
                {size}
              </label>
            ))}
          </div>
          {errors.sizes && <p id="poster-sizes-error" className="text-xs text-danger-fg">{errors.sizes}</p>}
        </div>
        <div className="flex items-start justify-between gap-3 sm:justify-start">
          <span>
            <span id={activeLabelId} className="block text-sm font-medium text-ink-secondary">{t('form.active')}</span>
            <span className="mt-0.5 block text-xs text-ink-muted">{t('form.activeHint')}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_active}
            aria-labelledby={activeLabelId}
            onClick={() => set('is_active', !form.is_active)}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${form.is_active ? 'bg-success-solid' : 'bg-active'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-[inset-inline-start] ${form.is_active ? 'start-[22px]' : 'start-0.5'}`} />
          </button>
        </div>
      </div>

      <PairInputs
        idBase="poster-heading"
        label={t('form.heading')}
        value={form.heading}
        onChange={(v) => set('heading', v)}
        max={LIMITS.heading}
        error={errors.heading}
        required
      />

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold text-ink">
          {t('form.instructions')} <span className="font-normal text-ink-muted">{t('form.instructionsCount', { count: form.instructions.length, max: LIMITS.lines })}</span>
        </legend>
        {form.instructions.length === 0 && <p className="text-sm text-ink-muted">{t('form.noInstructions')}</p>}
        {form.instructions.map((line, i) => (
          <div key={i} className="rounded-xl border border-line bg-subtle p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">{t('form.line', { number: i + 1 })}</span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="small" aria-label={t('form.moveUp', { number: i + 1 })} disabled={i === 0} onClick={() => moveLine(i, -1)}>
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="small" aria-label={t('form.moveDown', { number: i + 1 })} disabled={i === form.instructions.length - 1} onClick={() => moveLine(i, 1)}>
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button type="button" variant="ghost" size="small" aria-label={t('form.removeLine', { number: i + 1 })} onClick={() => set('instructions', form.instructions.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('form.lineEnglish', { number: i + 1 })} htmlFor={`poster-line-${i}-en`} count={line.en.length} max={LIMITS.instruction} error={errors[`line${i}`]}>
                <input
                  id={`poster-line-${i}-en`}
                  lang="en"
                  dir="ltr"
                  className={inputClass}
                  value={line.en}
                  maxLength={LIMITS.instruction}
                  aria-invalid={errors[`line${i}`] ? 'true' : undefined}
                  aria-describedby={errors[`line${i}`] ? `poster-line-${i}-en-error` : undefined}
                  onChange={(e) => setLine(i, { ...line, en: e.target.value })}
                />
              </Field>
              <Field label={t('form.lineArabic', { number: i + 1 })} htmlFor={`poster-line-${i}-ar`} count={line.ar.length} max={LIMITS.instruction}>
                <input
                  id={`poster-line-${i}-ar`}
                  lang="ar"
                  dir="rtl"
                  className={inputClass}
                  value={line.ar}
                  maxLength={LIMITS.instruction}
                  onChange={(e) => setLine(i, { ...line, ar: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}
        {form.instructions.length < LIMITS.lines && (
          <Button type="button" variant="secondary" size="small" startIcon={Plus} onClick={() => set('instructions', [...form.instructions, emptyPair()])}>
            {t('form.addLine')}
          </Button>
        )}
      </fieldset>

      <PairInputs
        idBase="poster-footer"
        label={t('form.footer')}
        value={form.footer}
        onChange={(v) => set('footer', v)}
        max={LIMITS.footer}
        error={errors.footer}
        multiline
      />

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          {t('form.back')}
        </Button>
        <Button type="submit" isLoading={saving}>
          {editing ? t('form.save') : t('form.create')}
        </Button>
      </div>
    </form>
  );
};

export default PosterForm;
