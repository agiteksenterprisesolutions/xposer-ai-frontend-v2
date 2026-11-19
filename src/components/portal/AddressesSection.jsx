// src/components/portal/AddressesSection.jsx
//
// Portal addresses (PORTAL.md §2, tenant admin only). The first row is the
// tenant's own address, set by the platform and read-only. Each entity can
// have its own address under it (/acme/insurance); the address decides the
// entity of every report started there, so each entity's people need their
// own address or poster.
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Globe, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Alert from '../ui/Alert';
import Modal, { ConfirmationModal } from '../ui/Modal';
import Skeleton from '../ui/Skeleton';
import { portalAPI } from '../../api/portal';
import { describeError } from '../../utils/errors';
import { copyToClipboard } from '../../utils/clipboard';
import { normalizePortalSlug, portalSlugProblem } from '../../utils/portalSlugs';

const labelText = (label, lang) => {
  if (!label) return { text: '', isAr: false };
  if (typeof label === 'string') return { text: label, isAr: false };
  if (lang === 'ar' && label.ar) return { text: label.ar, isAr: true };
  return { text: label.en || label.ar || '', isAr: !label.en && Boolean(label.ar) };
};

const CopyButton = ({ url }) => {
  const { t } = useTranslation('portal');
  const [copied, setCopied] = useState(false);
  if (!url) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyToClipboard(url)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } else toast.error(t('addresses.copyFailed'));
      }}
      aria-label={t('addresses.copy', { url })}
      title={t('addresses.copy', { url })}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-hover hover:text-ink"
    >
      {copied ? <Check className="h-4 w-4 text-success-fg" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
};

const AddressModal = ({ row, onClose, onSaved }) => {
  const { t, i18n } = useTranslation('portal');
  const slugId = useId();
  const activeId = useId();
  const errId = useId();
  const [slug, setSlug] = useState(row?.slug || '');
  const [isActive, setIsActive] = useState(row?.slug ? row.is_active !== false : true);
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  const problem = portalSlugProblem(slug);
  const shownError = serverError || (touched && problem ? t(`addresses.slug.${problem}`) : null);
  const name = labelText(row?.label, i18n.resolvedLanguage);

  const save = async () => {
    setTouched(true);
    if (problem) return;
    setSaving(true);
    setServerError(null);
    try {
      const result = await portalAPI.setAddress(row.entity_code, { slug: normalizePortalSlug(slug), is_active: isActive });
      onSaved(result);
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (status === 409 || detail?.code === 'slug_taken') setServerError(t('addresses.slug.taken'));
      else setServerError(describeError(error).summary);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={row?.slug ? t('addresses.editTitle') : t('addresses.setTitle')}
      size="medium"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common:actions.cancel')}</Button>
          <Button onClick={save} isLoading={saving}>{t('common:actions.save')}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-ink-secondary">
          {t('addresses.forEntity')}{' '}
          <span className="font-semibold text-ink" lang={name.isAr ? 'ar' : undefined} dir={name.isAr ? 'rtl' : 'auto'}>{name.text}</span>
        </p>
        <div className="space-y-1.5">
          <label htmlFor={slugId} className="block text-sm font-medium text-ink-secondary">
            {t('addresses.slugLabel')}<span className="ms-0.5 text-danger-fg">*</span>
          </label>
          <div className="flex items-stretch overflow-hidden rounded-lg border border-line-strong bg-surface focus-within:border-line-accent focus-within:ring-2 focus-within:ring-accent-ring" dir="ltr">
            <span className="flex items-center border-e border-line bg-sunken px-3 text-sm text-ink-muted">/{row?.tenantSlug}/</span>
            <input
              id={slugId}
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                setServerError(null);
              }}
              onBlur={() => setTouched(true)}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={shownError ? 'true' : undefined}
              aria-describedby={errId}
              className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-ink outline-none"
            />
          </div>
          <p id={errId} className={`text-xs ${shownError ? 'text-danger-fg' : 'text-ink-muted'}`}>
            {shownError || t('addresses.slugHint')}
          </p>
        </div>
        <label htmlFor={activeId} className="flex cursor-pointer items-start gap-3 text-sm text-ink-secondary">
          <input
            id={activeId}
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--xp-accent)]"
          />
          <span>
            <span className="block font-medium text-ink">{t('addresses.activeLabel')}</span>
            <span className="block text-xs text-ink-muted">{t('addresses.activeHint')}</span>
          </span>
        </label>
        {row?.slug && slug !== row.slug && (
          <Alert variant="warning">{t('addresses.changeWarning')}</Alert>
        )}
      </div>
    </Modal>
  );
};

const AddressesSection = () => {
  const { t, i18n } = useTranslation('portal');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [changeWarnings, setChangeWarnings] = useState([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await portalAPI.getAddresses());
    } catch (err) {
      setError(describeError(err).summary);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tenantSlug = data?.organization_slug || data?.items?.find((r) => r.kind === 'tenant')?.slug;

  const onSaved = (result) => {
    const warnings = (result?.warnings || []).filter((w) => w.code === 'address_changed');
    if (warnings.length) setChangeWarnings((prev) => [...warnings, ...prev]);
    toast.success(t('addresses.saved'));
    setEditing(null);
    load();
  };

  const remove = async () => {
    setRemoveBusy(true);
    try {
      await portalAPI.removeAddress(removing.entity_code);
      toast.success(t('addresses.removed'));
      setRemoving(null);
      load();
    } catch {
      // The global toast already explains the failure.
    } finally {
      setRemoveBusy(false);
    }
  };

  const reachState = (row) => {
    if (row.reachable) return <Badge variant="success" size="small" dot>{t('addresses.reachable')}</Badge>;
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="warning" size="small" dot>{t('addresses.notReachable')}</Badge>
        {row.not_reachable_reason && (
          <span className="text-xs text-ink-muted">
            {t(`addresses.reason.${row.not_reachable_reason}`, { defaultValue: row.not_reachable_reason })}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-ink-muted">{t('addresses.intro')}</p>

      {changeWarnings.map((w, i) => (
        <Alert
          key={`${w.old_url}-${i}`}
          variant="warning"
          title={t('addresses.changedTitle')}
          dismissible
          onDismiss={() => setChangeWarnings((prev) => prev.filter((_, j) => j !== i))}
        >
          <p dir="auto">{w.message}</p>
          {w.old_url && (
            <p className="mt-1">
              {t('addresses.oldUrl')} <span dir="ltr" className="font-mono text-xs">{w.old_url}</span>
            </p>
          )}
          {w.affected_posters?.length > 0 && (
            <div className="mt-2">
              <p className="font-medium">{t('addresses.affectedPosters', { count: w.affected_posters.length })}</p>
              <ul className="mt-1 list-disc ps-5">
                {w.affected_posters.map((p) => <li key={p} dir="auto">{p}</li>)}
              </ul>
            </div>
          )}
        </Alert>
      ))}

      {error ? (
        <Alert variant="error">
          {error}{' '}
          <Button variant="link" onClick={load}>{t('common:actions.retry')}</Button>
        </Alert>
      ) : !data ? (
        <Card padding="none">
          <div className="space-y-3 p-5">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Card>
      ) : (
        <Card padding="none">
          {!data.portal_base_url && (
            <div className="border-b border-line p-4">
              <Alert variant="warning">{t('addresses.noBaseUrl')}</Alert>
            </div>
          )}
          <ul className="divide-y divide-line">
            {data.items.map((row) => {
              const name = labelText(row.label, i18n.resolvedLanguage);
              const isTenant = row.kind === 'tenant';
              return (
                <li key={row.entity_code || 'tenant'} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink-muted">
                      <Globe className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink" lang={name.isAr ? 'ar' : undefined} dir={name.isAr ? 'rtl' : 'auto'}>
                          {name.text}
                        </span>
                        <Badge variant={isTenant ? 'primary' : 'default'} size="small">
                          {isTenant ? t('addresses.kindTenant') : t('addresses.kindEntity')}
                        </Badge>
                      </div>
                      {row.url ? (
                        <div className="mt-1 flex min-w-0 items-center gap-1">
                          <a href={row.url} target="_blank" rel="noreferrer" dir="ltr" className="truncate font-mono text-xs text-link hover:underline">
                            {row.url}
                          </a>
                          <CopyButton url={row.url} />
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-ink-muted">{t('addresses.noAddressYet')}</p>
                      )}
                      {isTenant && <p className="mt-1 text-xs text-ink-muted">{t('addresses.tenantReadOnly')}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    {reachState(row)}
                    {row.editable && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="secondary"
                          size="small"
                          startIcon={Pencil}
                          onClick={() => setEditing({ ...row, tenantSlug })}
                        >
                          {row.slug ? t('addresses.edit') : t('addresses.set')}
                        </Button>
                        {row.slug && (
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => setRemoving(row)}
                            aria-label={t('addresses.removeLabel', { name: name.text })}
                            title={t('addresses.remove')}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {editing && <AddressModal row={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
      <ConfirmationModal
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        isLoading={removeBusy}
        destructive
        title={t('addresses.removeTitle')}
        message={t('addresses.removeBody', { url: removing?.url || '' })}
        confirmText={t('addresses.remove')}
      />
    </div>
  );
};

export default AddressesSection;
