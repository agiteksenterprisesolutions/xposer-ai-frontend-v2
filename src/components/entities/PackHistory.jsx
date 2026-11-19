// src/components/entities/PackHistory.jsx
//
// The dated pack history (XPAI-224, PACK_HISTORY.md) of one entity or of the
// tenant, as two timelines: jurisdiction (whose rules) and calendar (whose
// weekend and holidays). A case follows the pack in force on the day it was
// filed and keeps it, so packs are never edited in place: a change starts on
// a date, and the entry before it ends there.
//
//   <PackHistory scope={{ entityId }} canChange packs={packs} />   an entity
//   <PackHistory scope={null} canChange packs={packs} />           the tenant
//
// `canChange` (tenant admin) adds "Change pack from date…" and Cancel on a
// scheduled newest entry. Everyone else, including an entity admin, sees the
// timelines read-only.
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, X } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Alert from '../ui/Alert';
import Skeleton from '../ui/Skeleton';
import { ConfirmationModal } from '../ui/Modal';
import { packHistoryAPI } from '../../api/entities';
import { localized } from '../../api/jurisdiction';
import { intlLocale } from '../../utils/locale';
import { describeError } from '../../utils/errors';
import { Field, inputClass } from './formParts';

export const PACK_KINDS = ['jurisdiction', 'calendar'];

/** 'YYYY-MM-DD' for a local Date. */
const isoDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** The day after 'YYYY-MM-DD'. */
const nextDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDay(new Date(y, m - 1, d + 1));
};

/** "01 Jul 2026" (Arabic: "01 يوليو 2026") for a 'YYYY-MM-DD' or ISO time. */
export const formatDay = (value) => {
  if (!value) return '';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(value);
  return new Date(y, m - 1, d).toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
};

const STATE_VARIANT = { current: 'success', scheduled: 'info', past: 'default' };

/** The error code and its details from a failed request. */
const errorInfo = (err) => {
  const detail = err?.response?.data?.detail;
  const { summary, problems } = describeError(err);
  const info = detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : {};
  return { code: info.code || problems?.[0]?.code, info, summary, status: err?.response?.status };
};

// ─── "Change pack from date…" ──────────────────────────────────────────────
const ChangeForm = ({ scope, kind, entries, packs, onDone, onCancel }) => {
  const { t } = useTranslation('entities');
  const id = useId();
  const tenantLevel = !scope?.entityId;
  const latest = entries[0];
  const tomorrow = nextDay(isoDay(new Date()));
  const minDate = latest?.valid_from ? nextDay(String(latest.valid_from).slice(0, 10)) : isoDay(new Date());
  // Tomorrow or later by default: today is refused once a case was filed.
  const [date, setDate] = useState(minDate > tomorrow ? minDate : tomorrow);
  const [pack, setPack] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  // null = an entity follows the tenant again; the tenant's calendar goes
  // back to each case's own pack. The tenant's jurisdiction pack is required.
  const nullLabel = tenantLevel ? (kind === 'calendar' ? t('values.followsPack') : null) : t('history.followTenant');
  const NULL = '__none__';

  const save = async () => {
    const next = {};
    if (!pack) next.pack = t('errors.pack');
    if (!date) next.date = t('history.errors.date', { date: formatDay(minDate) });
    else if (date < minDate) next.date = t('history.errors.overlap', { date: formatDay(latest.valid_from) });
    setErrors(next);
    setServerError(null);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const saved = await packHistoryAPI.add(scope, { kind, pack_code: pack === NULL ? null : pack, valid_from: date });
      const scheduled = (saved?.state || (date > isoDay(new Date()) ? 'scheduled' : 'current')) === 'scheduled';
      toast.success(scheduled ? t('history.toast.scheduled', { date: formatDay(date) }) : t('history.toast.saved'));
      onDone();
    } catch (err) {
      const { code, info, summary, status } = errorInfo(err);
      if (code === 'pack_assignment_overlap') setErrors({ date: t('history.errors.overlap', { date: formatDay(info.last_valid_from || latest?.valid_from) }) });
      else if (code === 'before_latest_case') setErrors({ date: t('history.errors.beforeCase', { date: formatDay(info.latest_case_filed_at) }) });
      else if (code === 'no_change') setErrors({ pack: t('history.errors.noChange') });
      else if (code === 'unknown_pack') setErrors({ pack: t('errors.packUnknown') });
      else if (code === 'pack_wrong_region') setErrors({ pack: t('errors.packRegion') });
      else if (code === 'pack_required') setErrors({ pack: t('errors.pack') });
      else if (code === 'concurrent_change') {
        setServerError(t('history.errors.concurrent'));
        onDone({ keepOpen: true });
      } else if (status === 403) setServerError(t('history.errors.notAllowed'));
      else setServerError(summary);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-line bg-subtle p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('history.form.pack')} htmlFor={`${id}-pack`} required error={errors.pack}>
          {(describedBy) => (
            <select
              id={`${id}-pack`}
              dir="ltr"
              className={inputClass}
              value={pack}
              aria-invalid={errors.pack ? 'true' : undefined}
              aria-describedby={describedBy}
              onChange={(e) => {
                setPack(e.target.value);
                setErrors((x) => ({ ...x, pack: undefined }));
              }}
            >
              <option value="" disabled>{t('values.choosePack')}</option>
              {nullLabel && <option value={NULL}>{nullLabel}</option>}
              {packs.map((p) => <option key={p.code} value={p.code}>{p.code} · {localized(p.name)}</option>)}
            </select>
          )}
        </Field>
        <Field
          label={t('history.form.from')}
          htmlFor={`${id}-date`}
          required
          error={errors.date}
          hint={t('history.form.fromHint', { date: formatDay(minDate) })}
        >
          {(describedBy) => (
            <input
              id={`${id}-date`}
              type="date"
              dir="ltr"
              min={minDate}
              className={inputClass}
              value={date}
              aria-invalid={errors.date ? 'true' : undefined}
              aria-describedby={describedBy}
              onChange={(e) => {
                setDate(e.target.value);
                setErrors((x) => ({ ...x, date: undefined }));
              }}
            />
          )}
        </Field>
      </div>
      {serverError && <Alert variant="error">{serverError}</Alert>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="small" onClick={onCancel} disabled={saving}>{t('common:actions.cancel')}</Button>
        <Button size="small" onClick={save} isLoading={saving}>{t('history.form.save')}</Button>
      </div>
    </div>
  );
};

// ─── One timeline ──────────────────────────────────────────────────────────
const Timeline = ({ scope, kind, entries, packs, canChange, onChanged, onCancelEntry }) => {
  const { t } = useTranslation('entities');
  const headingId = useId();
  const [adding, setAdding] = useState(false);
  const tenantLevel = !scope?.entityId;
  const kindLabel = t(`history.kinds.${kind}`);

  const packText = (entry) => {
    if (!entry.pack_code) return tenantLevel ? t('values.followsPack') : t('history.followTenant');
    const name = localized(entry.pack_name) || localized(packs.find((p) => p.code === entry.pack_code)?.name);
    return name ? `${entry.pack_code} · ${name}` : entry.pack_code;
  };
  const range = (entry) =>
    entry.valid_to
      ? t('history.range', { from: formatDay(entry.valid_from), to: formatDay(entry.valid_to) })
      : t('history.rangeOpen', { from: formatDay(entry.valid_from) });

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={headingId} className="text-sm font-semibold text-ink">{kindLabel}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{t(`history.kinds.${kind}Hint`)}</p>
        </div>
        {canChange && !adding && (
          <Button variant="secondary" size="small" startIcon={CalendarClock} onClick={() => setAdding(true)} aria-label={t('history.changeAria', { kind: kindLabel })}>
            {t('history.change')}
          </Button>
        )}
      </div>

      {adding && (
        <ChangeForm
          scope={scope}
          kind={kind}
          entries={entries}
          packs={packs}
          onCancel={() => setAdding(false)}
          onDone={({ keepOpen } = {}) => {
            if (!keepOpen) setAdding(false);
            onChanged();
          }}
        />
      )}

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-sm text-ink-muted">
          {tenantLevel ? t('history.emptyTenant') : t('history.emptyEntity')}
        </p>
      ) : (
        <ol className="space-y-0">
          {entries.map((entry, i) => {
            const state = entry.state || 'past';
            const cancellable = canChange && i === 0 && state === 'scheduled';
            return (
              <li key={entry.id || `${entry.valid_from}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                {/* The rail: a dot per entry, joined by a line. */}
                <div className="relative flex w-3 shrink-0 justify-center" aria-hidden="true">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${state === 'current' ? 'bg-success-solid' : state === 'scheduled' ? 'bg-info-solid' : 'bg-line-strong'}`} />
                  {i < entries.length - 1 && <span className="absolute top-5 bottom-[-0.25rem] w-px bg-line" />}
                </div>
                <div className={`min-w-0 flex-1 ${state === 'past' ? 'text-ink-muted' : ''}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`text-sm font-medium ${state === 'past' ? 'text-ink-secondary' : 'text-ink'}`} dir="auto">{packText(entry)}</span>
                    <Badge size="small" variant={STATE_VARIANT[state] || 'default'}>{t(`history.state.${state}`, { defaultValue: state })}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-secondary">{range(entry)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {entry.created_by
                      ? t('history.by', { name: entry.created_by.full_name || entry.created_by.username || '—', date: formatDay(entry.created_at) })
                      : t('history.bySystem')}
                  </p>
                </div>
                {cancellable && (
                  <Button
                    variant="ghost"
                    size="small"
                    startIcon={X}
                    className="shrink-0 self-start"
                    aria-label={t('history.cancelAria', { pack: packText(entry), date: formatDay(entry.valid_from) })}
                    onClick={() => onCancelEntry(entry, packText(entry))}
                  >
                    {t('history.cancelEntry')}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};

// ─── Both timelines ────────────────────────────────────────────────────────
const PackHistory = ({ scope, canChange = false, packs = [], onChanged }) => {
  const { t } = useTranslation('entities');
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(null); // { entry, pack }
  const [cancelBusy, setCancelBusy] = useState(false);
  const entityId = scope?.entityId || null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await packHistoryAPI.list(entityId ? { entityId } : null);
      setEntries(list);
    } catch (err) {
      setError(err?.response?.status === 403 ? t('history.errors.notAllowedRead') : t('history.errors.loadFailed'));
      setEntries([]);
    }
  }, [entityId, t]);
  useEffect(() => {
    setEntries(null);
    load();
  }, [load]);

  const changed = () => {
    load();
    onChanged?.();
  };

  const confirmCancel = async () => {
    setCancelBusy(true);
    try {
      await packHistoryAPI.cancel(entityId ? { entityId } : null, cancelling.entry.id);
      toast.success(t('history.toast.cancelled'));
      setCancelling(null);
      changed();
    } catch (err) {
      const { code, summary } = errorInfo(err);
      toast.error(code === 'already_started' ? t('history.errors.alreadyStarted') : code === 'not_latest' ? t('history.errors.notLatest') : summary);
      setCancelling(null);
      load();
    } finally {
      setCancelBusy(false);
    }
  };

  if (error && !entries?.length) return <Alert variant="error">{error}</Alert>;
  if (!entries) {
    return (
      <div className="space-y-6">
        {PACK_KINDS.map((k) => (
          <div key={k} className="space-y-2">
            <Skeleton.Text className="w-40" />
            <Skeleton className="h-14 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const byKind = (kind) =>
    entries
      .filter((e) => e.kind === kind)
      .sort((a, b) => String(b.valid_from).localeCompare(String(a.valid_from)));

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">{canChange ? t('history.intro') : t('history.introReadOnly')}</p>
      {PACK_KINDS.map((kind, i) => (
        <div key={kind} className={i > 0 ? 'border-t border-line pt-5' : undefined}>
          <Timeline
            scope={scope}
            kind={kind}
            entries={byKind(kind)}
            packs={packs}
            canChange={canChange}
            onChanged={changed}
            onCancelEntry={(entry, pack) => setCancelling({ entry, pack })}
          />
        </div>
      ))}
      <ConfirmationModal
        isOpen={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
        title={t('history.confirmTitle')}
        message={t('history.confirmBody', { pack: cancelling?.pack || '', date: formatDay(cancelling?.entry?.valid_from) })}
        confirmText={t('history.cancelEntry')}
        cancelText={t('history.keep')}
        isLoading={cancelBusy}
        destructive
      />
    </div>
  );
};

export default PackHistory;
