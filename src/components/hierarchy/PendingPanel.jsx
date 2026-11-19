// src/components/hierarchy/PendingPanel.jsx
//
// The sync approval queue: people an HR sync found for the first time, waiting
// for the answers a sync can't give — which role they hold (which also places
// them: each role sits at one level), whether they get a login, and if so how
// they sign in (password, Google or Microsoft).
//
// A matched job title gives `suggested_level_code`; `suggested_role_code` is
// set only when exactly one role sits there, and `candidate_role_codes` lists
// them when several do — choosing between those decides what the person may
// do, so it is the admin's call, offered first in the picker.
//
// Driven by the API's own verdicts: `missing` lists what each person still
// needs and `ready_to_approve` enables Approve, so the rule is never redone
// here. Answers save as they're picked (PUT is partial and survives the next
// sync); setting answers and admitting people are separate steps, so a batch
// can be checked before anyone is let in. Approval is per person — a 200 can
// carry both `approved` and `problems`, and both are shown.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { intlLocale } from '../../utils/locale';
import { CheckCircle2, Inbox, RotateCcw, Search, UserCheck, UserX } from 'lucide-react';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import { ConfirmationModal } from '../layout/Modal';
import { Checkbox } from '../roles/PermissionPicker';
import UndeliveredCredentials from '../users/UndeliveredCredentials';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { deriveUsername, usernameNeedsAttention } from '../../utils/usernames';
import { errorSummary } from '../../utils/errors';
import { roleWithLevel, sortRolesByLevel } from '../../utils/roleLevels';

// Labels: pending.views.<value>.
const VIEWS = [{ value: 'attention' }, { value: 'ready' }, { value: 'dismissed' }];

// What a person still needs, by the API's `missing` codes: pending.missing.<code>.
const MISSING_KEYS = ['full_name', 'create_login', 'role', 'auth_provider', 'email'];
const missingLabel = (code) => (MISSING_KEYS.includes(code) ? i18n.t(`hierarchy:pending.missing.${code}`) : code);

const selectClass =
  'h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink outline-none focus:border-line-accent disabled:opacity-60';

/** Firebase's own sign_in_provider values. */
export const SIGN_IN_METHODS = [
  {
    value: 'password',
    get label() {
      return i18n.t('hierarchy:pending.password');
    },
  },
  { value: 'google.com', label: 'Google' },
  { value: 'microsoft.com', label: 'Microsoft' },
];

const LoginChoice = ({ value, onChange, disabled, name }) => {
  const { t } = useTranslation('hierarchy');
  return (
  <div role="radiogroup" aria-label={t('pending.loginFor', { name })} className="grid grid-cols-2 gap-1 rounded-lg bg-active p-1">
    {[
      [true, t('pending.login')],
      [false, t('pending.directoryOnly')],
    ].map(([v, label]) => {
      const on = value === v;
      return (
        <button
          key={label}
          type="button"
          role="radio"
          aria-checked={on}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`rounded-md px-2 py-1 text-xs transition-colors disabled:cursor-default ${
            on ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink-muted hover:text-ink'
          }`}
        >
          {label}
        </button>
      );
    })}
  </div>
  );
};

const PendingRow = ({ person, levels, roles, nameFor, canManage, canApprove, dismissed, selected, onSelect, onSave, onApprove, onDismiss, onRestage, busy, orgName }) => {
  const { t } = useTranslation('hierarchy');
  const levelTitle = (code) => levels.find((l) => l.code === code)?.title || code;
  const editable = canManage && !dismissed;
  const suggested = person.suggested_role_code ? [person.suggested_role_code] : person.candidate_role_codes || [];
  const suggestedRoles = roles.filter((role) => suggested.includes(role.code));
  const otherRoles = roles.filter((role) => !suggested.includes(role.code));
  const username = person.create_login ? deriveUsername(person, orgName) : '';
  const missing = person.missing || [];

  return (
    <li className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        {editable && (
          <span className="pt-0.5">
            <Checkbox checked={selected} onChange={onSelect} labelledBy={`pending-${person.id}`} />
          </span>
        )}
        <div className="min-w-0">
          <p id={`pending-${person.id}`} className="text-sm font-semibold text-ink" dir="auto">
            {person.full_name || <span className="italic text-ink-muted">{t('pending.noName')}</span>}
          </p>
          <p className="text-xs text-ink-muted">
            {[person.email, person.designation, person.department].filter(Boolean).join(' · ') || t('pending.noDetails')}
          </p>
          {person.manager_external_id && (
            <p className="text-xs text-ink-subtle">{t('pending.reportsTo', { id: person.manager_external_id })}</p>
          )}
          {person.suggested_level_code && (
            <p className="text-xs text-ink-subtle">{t('pending.titleMatched', { level: levelTitle(person.suggested_level_code) })}</p>
          )}
          {!dismissed && missing.length > 0 && (
            <p className="mt-1.5 text-xs font-medium text-warning-fg">
              {t('pending.needs', { list: new Intl.ListFormat(intlLocale(), { type: 'unit' }).format(missing.map(missingLabel)) })}
            </p>
          )}
          {!dismissed && person.ready_to_approve && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success-fg">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {t('pending.readyToApprove')}
            </p>
          )}
        </div>
      </div>

      {!dismissed && (
        <div className="grid w-full gap-2.5 sm:grid-cols-3 lg:w-[34rem] lg:shrink-0">
          <div className="space-y-1">
            <label htmlFor={`pl-role-${person.id}`} className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
              {t('member.role')}
            </label>
            <select
              id={`pl-role-${person.id}`}
              value={person.role || ''}
              disabled={!editable || busy}
              onChange={(e) => onSave(person, { role: e.target.value || null })}
              className={selectClass}
            >
              <option value="">
                {person.suggested_role_code ? t('pending.suggestedRole', { role: nameFor(person.suggested_role_code) }) : t('pending.chooseRole')}
              </option>
              {suggestedRoles.length > 0 && (
                <optgroup label={suggestedRoles.length === 1 ? t('pending.suggested') : t('pending.suggestedAtLevel')}>
                  {suggestedRoles.map((role) => (
                    <option key={role.code} value={role.code}>
                      {roleWithLevel(role)}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={suggestedRoles.length ? t('pending.allRoles') : t('pending.roles')}>
                {otherRoles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {roleWithLevel(role)}
                  </option>
                ))}
              </optgroup>
            </select>
            {!person.role && person.suggested_role_code && editable && (
              <button
                type="button"
                onClick={() => onSave(person, { role: person.suggested_role_code })}
                className="text-xs font-medium text-link hover:underline"
              >
                {t('pending.useSuggestion')}
              </button>
            )}
            {!person.role && !person.suggested_role_code && suggestedRoles.length > 1 && (
              <p className="text-[11px] text-ink-muted">{t('pending.severalRoles', { count: suggestedRoles.length })}</p>
            )}
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">{t('pending.signIn')}</span>
            <LoginChoice
              value={person.create_login}
              disabled={!editable || busy}
              name={person.full_name}
              onChange={(v) => onSave(person, { create_login: v })}
            />
            {username && (
              <p className={`truncate text-[11px] ${usernameNeedsAttention(username, orgName) ? 'text-warning-fg' : 'text-ink-muted'}`} title={username}>
                <Trans t={t} i18nKey="pending.asUsername" values={{ username }} components={{ code: <span className="font-mono" dir="ltr" /> }} />
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor={`pl-method-${person.id}`} className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
              {t('pending.signsInWith')}
            </label>
            {person.create_login ? (
              <select
                id={`pl-method-${person.id}`}
                value={person.auth_provider || 'password'}
                disabled={!editable || busy}
                onChange={(e) => onSave(person, { auth_provider: e.target.value })}
                className={selectClass}
                title={
                  (person.auth_provider || 'password') === 'password'
                    ? t('pending.passwordHint')
                    : t('pending.ssoHint')
                }
              >
                {SIGN_IN_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="flex h-9 items-center text-xs text-ink-muted">
                {person.create_login === false ? t('directory.noLogin') : t('pending.decideFirst')}
              </p>
            )}
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex shrink-0 gap-2 lg:pt-5">
          {dismissed ? (
            <Button variant="secondary" size="small" startIcon={RotateCcw} onClick={() => onRestage(person)} disabled={busy}>
              {t('pending.restage')}
            </Button>
          ) : (
            <>
              {canApprove && (
                <Button size="small" startIcon={UserCheck} onClick={() => onApprove([person.id])} disabled={busy || !person.ready_to_approve}>
                  {t('pending.approve')}
                </Button>
              )}
              <Button variant="ghost" size="small" onClick={() => onDismiss(person)} disabled={busy} aria-label={t('pending.dismissLabel', { name: person.full_name })} title={t('pending.dismiss')}>
                <UserX className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
};

const ApprovalResult = ({ result, onClose, nameFor, levelTitle }) => {
  const { t } = useTranslation('hierarchy');
  return (
  <section className="space-y-3 rounded-xl border border-line bg-surface p-4" aria-live="polite">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-ink">{result.message || t('pending.result.approved', { count: result.approved_count ?? 0 })}</p>
        <p className="text-xs text-ink-muted">
          {t('pending.result.admitted', { count: result.approved_count ?? 0 })}
          {result.accounts_created != null && ` · ${t('pending.result.withLogin', { count: result.accounts_created })}`}
          {result.still_pending != null && ` · ${t('pending.result.stillWaiting', { count: result.still_pending })}`}
        </p>
      </div>
      <Button variant="ghost" size="small" onClick={onClose}>
        {t('common:actions.dismiss')}
      </Button>
    </div>
    {result.approved?.length > 0 && (
      <ul className="max-h-48 space-y-1 overflow-auto rounded-lg bg-subtle px-3 py-2.5 text-sm">
        {result.approved.map((a, i) => (
          <li key={a.external_id || i} className="text-ink-secondary">
            <span className="font-medium text-ink">{a.full_name || a.name || a.external_id}</span>
            {a.role && ` — ${nameFor(a.role)}`}
            {a.level_code && ` (${levelTitle(a.level_code)})`}
          </li>
        ))}
      </ul>
    )}
    {result.problems?.length > 0 && (
      <ul className="space-y-1.5 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger-fg">
        {result.problems.map((p, i) => (
          <li key={i}>
            <span className="font-medium">{p.name || p.external_id}</span> — {p.message}
          </li>
        ))}
      </ul>
    )}
    <UndeliveredCredentials items={result.undelivered_credentials} />
  </section>
  );
};

const QueueSkeleton = () => (
  <ul className="divide-y divide-line-subtle" aria-busy="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row">
        <div className="flex-1">
          <Skeleton.Text className="w-40" />
          <Skeleton.Text size="xs" className="w-64" />
        </div>
        <div className="grid w-full gap-2.5 sm:grid-cols-3 lg:w-[34rem]">
          {[0, 1, 2].map((j) => (
            <div key={j}>
              <Skeleton.Text size="xs" className="w-12" />
              <Skeleton className="mt-1 h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </li>
    ))}
  </ul>
);

const intro = () => i18n.t('hierarchy:pending.intro');

/** The queue while the hierarchy loads: same intro, search, tabs and rows. */
export const PendingSkeleton = () => (
  <div className="space-y-4" aria-busy="true">
    <p className="text-sm text-ink-secondary">{intro()}</p>
    <div className="rounded-xl border border-line bg-surface">
      <div className="space-y-3 border-b border-line-subtle p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <div className="h-10 w-full rounded-lg border border-line bg-subtle" />
        </div>
        <div className="inline-flex rounded-lg bg-active p-1">
          {VIEWS.map((v, i) => (
            <span
              key={v.value}
              className={`rounded-md px-3 py-1.5 text-sm ${i === 0 ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink-muted'}`}
            >
              {i18n.t(`hierarchy:pending.views.${v.value}`)}
            </span>
          ))}
        </div>
      </div>
      <QueueSkeleton />
    </div>
  </div>
);

/**
 * Props:
 *   levels     – active levels, most senior first
 *   canManage  – org_hierarchy:manage; reading needs only org_hierarchy:read.
 *                Approving admits people (it can create logins), so it also
 *                needs user:create — admins only.
 *   onChanged  – reload the rest of the hierarchy after people are admitted
 *   onCount    – (pendingTotal) for the tab badge
 */
const PendingPanel = ({ levels, canManage, onChanged, onCount }) => {
  const { t } = useTranslation('hierarchy');
  const canApprove = useCan()(PERM.userCreate);
  const { allRoles: unsortedRoles, nameFor } = useOrgRoles();
  const roles = useMemo(() => sortRolesByLevel(unsortedRoles.filter((r) => r.is_active !== false)), [unsortedRoles]);
  const orgName = useAuthStore((s) => s.user?.organization_name);
  const [view, setView] = useState('attention');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const debounce = useRef(null);

  const load = useCallback(async () => {
    try {
      // One pending call gives both tabs and both counts; `ready` splits it.
      const [p, d] = await Promise.all([
        orgHierarchyAPI.listPending({ status: 'pending', search: query }),
        orgHierarchyAPI.listPending({ status: 'dismissed', search: query }),
      ]);
      setPending(Array.isArray(p) ? p : []);
      setDismissed(Array.isArray(d) ? d : []);
      setError(null);
      if (!query) onCount?.(Array.isArray(p) ? p.length : 0);
    } catch (err) {
      setError(errorSummary(err));
    }
  }, [query, onCount]);

  useEffect(() => {
    load();
  }, [load]);

  const ready = useMemo(() => (pending || []).filter((p) => p.ready_to_approve), [pending]);
  const attention = useMemo(() => (pending || []).filter((p) => !p.ready_to_approve), [pending]);
  const rows = view === 'ready' ? ready : view === 'dismissed' ? dismissed || [] : attention;
  const loaded = pending !== null;

  const onSearch = (value) => {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQuery(value.trim()), 300);
  };

  // Answers save as they're picked; the server recomputes `missing`.
  const save = async (person, patch) => {
    setPending((prev) => prev.map((p) => (p.id === person.id ? { ...p, ...patch } : p)));
    try {
      const updated = await orgHierarchyAPI.updatePending(person.id, patch);
      if (updated && typeof updated === 'object' && 'missing' in updated) {
        setPending((prev) => prev.map((p) => (p.id === person.id ? { ...p, ...updated } : p)));
      } else {
        load();
      }
    } catch (err) {
      toast.error(errorSummary(err));
      load();
    }
  };

  const bulk = async (body, label) => {
    setBusy(true);
    try {
      const res = await orgHierarchyAPI.bulkPending(body);
      toast.success(res?.message || label);
      setSelected(new Set());
      await load();
    } catch (err) {
      toast.error(errorSummary(err));
    } finally {
      setBusy(false);
    }
  };

  const approve = async (ids) => {
    setBusy(true);
    try {
      const res = await orgHierarchyAPI.approvePending({ ids });
      setResult(res);
      setSelected(new Set());
      await load();
      if (res?.approved_count) onChanged?.();
    } catch (err) {
      toast.error(errorSummary(err));
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (person) => {
    setBusy(true);
    try {
      await orgHierarchyAPI.dismissPending(person.id);
      toast.success(t('pending.toast.dismissed', { name: person.full_name || t('pending.person') }));
      await load();
    } catch (err) {
      toast.error(errorSummary(err));
    } finally {
      setBusy(false);
    }
  };

  const restage = async (person) => {
    setBusy(true);
    try {
      await orgHierarchyAPI.restagePending(person.id);
      toast.success(t('pending.toast.restaged', { name: person.full_name || t('pending.person') }));
      await load();
    } catch (err) {
      toast.error(errorSummary(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedReady = selectedRows.filter((r) => r.ready_to_approve);
  const counts = { attention: attention.length, ready: ready.length, dismissed: dismissed?.length ?? 0 };
  // People with no role yet whose title matched a level holding exactly one role.
  const suggestable = (pending || []).filter((p) => !p.role && p.suggested_role_code);
  const applySuggestedRoles = async () => {
    setBusy(true);
    const results = await Promise.allSettled(
      suggestable.map((p) => orgHierarchyAPI.updatePending(p.id, { role: p.suggested_role_code })),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) toast.error(t('pending.toast.someFailed', { failed, total: suggestable.length }));
    else toast.success(t('pending.toast.suggestedSet', { count: suggestable.length }));
    await load();
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">{t('pending.intro')}</p>

      {result && (
        <ApprovalResult
          result={result}
          onClose={() => setResult(null)}
          nameFor={nameFor}
          levelTitle={(code) => levels.find((l) => l.code === code)?.title || code}
        />
      )}

      <div className="rounded-xl border border-line bg-surface">
        <div className="space-y-3 border-b border-line-subtle p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={t('pending.searchPlaceholder')}
              aria-label={t('pending.searchLabel')}
              className="h-10 w-full rounded-lg border border-line bg-subtle ps-9 pe-3 text-sm text-ink outline-none hover:border-line-strong focus:border-line-accent"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label={t('pending.queue')} className="inline-flex rounded-lg bg-active p-1">
              {VIEWS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  role="tab"
                  aria-selected={view === v.value}
                  onClick={() => {
                    setView(v.value);
                    setSelected(new Set());
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    view === v.value ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink-muted hover:text-ink'
                  }`}
                >
                  {t(`pending.views.${v.value}`)}
                  {loaded && (
                    <span
                      className={`rounded-full px-1.5 text-[11px] font-semibold ${
                        v.value === 'attention' && counts.attention > 0 ? 'bg-warning-soft text-warning-fg' : 'bg-subtle text-ink-muted'
                      }`}
                    >
                      {counts[v.value]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {canManage && view !== 'dismissed' && loaded && (pending?.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {selectedRows.length > 0 ? (
                  <>
                    <span className="text-sm text-ink-muted">{t('pending.selected', { count: selectedRows.length })}</span>
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => bulk({ ids: selectedRows.map((r) => r.id), decision: { create_login: true } }, t('pending.toast.loginSet'))}>
                      {t('pending.login')}
                    </Button>
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => bulk({ ids: selectedRows.map((r) => r.id), decision: { create_login: false } }, t('pending.toast.directorySet'))}>
                      {t('pending.directoryOnly')}
                    </Button>
                    <select
                      aria-label={t('pending.bulk.roleLabel')}
                      disabled={busy}
                      value=""
                      onChange={(e) => e.target.value && bulk({ ids: selectedRows.map((r) => r.id), decision: { role: e.target.value } }, t('pending.toast.roleSet'))}
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                    >
                      <option value="">{t('pending.bulk.setRole')}</option>
                      {roles.map((r) => (
                        <option key={r.code} value={r.code}>
                          {roleWithLevel(r)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={t('pending.bulk.methodLabel')}
                      disabled={busy}
                      value=""
                      onChange={(e) =>
                        e.target.value &&
                        bulk(
                          { ids: selectedRows.map((r) => r.id), decision: { create_login: true, auth_provider: e.target.value } },
                          t('pending.toast.methodSet'),
                        )
                      }
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                    >
                      <option value="">{t('pending.bulk.signInWith')}</option>
                      {SIGN_IN_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    {canApprove && (
                      <Button size="small" startIcon={UserCheck} disabled={busy || selectedReady.length === 0} onClick={() => approve(selectedReady.map((r) => r.id))}>
                        {selectedReady.length ? t('pending.approveCount', { count: selectedReady.length }) : t('pending.approve')}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => setConfirm('login')}>
                      {t('pending.bulk.loginsForAll')}
                    </Button>
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => setConfirm('directory')}>
                      {t('pending.bulk.directoryForAll')}
                    </Button>
                    {suggestable.length > 0 && (
                      <Button variant="secondary" size="small" disabled={busy} onClick={applySuggestedRoles}>
                        {t('pending.bulk.useSuggested', { count: suggestable.length })}
                      </Button>
                    )}
                    <select
                      aria-label={t('pending.bulk.roleForAllLabel')}
                      disabled={busy}
                      value=""
                      onChange={(e) => e.target.value && setConfirm({ role: e.target.value })}
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                    >
                      <option value="">{t('pending.bulk.roleForAll')}</option>
                      {roles.map((r) => (
                        <option key={r.code} value={r.code}>
                          {roleWithLevel(r)}
                        </option>
                      ))}
                    </select>
                    {canApprove && view === 'ready' && ready.length > 0 && (
                      <Button size="small" startIcon={UserCheck} disabled={busy} onClick={() => approve(ready.map((r) => r.id))}>
                        {t('pending.approveAll', { count: ready.length })}
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {error ? (
          <p className="p-5 text-sm text-ink-secondary">
            {t('pending.loadError')} {error}{' '}
            <button type="button" onClick={load} className="font-medium text-link hover:underline">
              {t('common:actions.retry')}
            </button>
          </p>
        ) : !loaded ? (
          <QueueSkeleton />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Inbox className="h-6 w-6 text-ink-subtle" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">
              {query
                ? t('pending.empty.search')
                : view === 'attention'
                  ? t('pending.empty.attention')
                  : view === 'ready'
                    ? t('pending.empty.ready')
                    : t('pending.empty.dismissed')}
            </p>
            <p className="max-w-sm text-sm text-ink-muted">
              {view === 'dismissed' ? t('pending.empty.dismissedBody') : t('pending.empty.body')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line-subtle">
            {rows.map((person) => (
              <PendingRow
                key={person.id}
                person={person}
                levels={levels}
                roles={roles}
                nameFor={nameFor}
                canManage={canManage}
                canApprove={canApprove}
                dismissed={view === 'dismissed'}
                selected={selected.has(person.id)}
                onSelect={() => toggle(person.id)}
                onSave={save}
                onApprove={approve}
                onDismiss={dismiss}
                onRestage={restage}
                busy={busy}
                orgName={orgName}
              />
            ))}
          </ul>
        )}
      </div>

      {canManage && (
        <p className="text-xs text-ink-muted">
          {t('pending.footnote')}
        </p>
      )}

      <ConfirmationModal
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const choice = confirm;
          setConfirm(null);
          if (choice?.role) {
            bulk({ all_pending: true, decision: { role: choice.role } }, t('pending.toast.allRole', { role: nameFor(choice.role) }));
            return;
          }
          const login = choice === 'login';
          bulk({ all_pending: true, decision: { create_login: login } }, login ? t('pending.toast.allLogin') : t('pending.toast.allDirectory'));
        }}
        title={
          confirm?.role
            ? t('pending.confirm.roleTitle', { role: nameFor(confirm.role) })
            : confirm === 'login'
              ? t('pending.confirm.loginTitle')
              : t('pending.confirm.directoryTitle')
        }
        message={
          confirm?.role
            ? roles.find((r) => r.code === confirm.role)?.level_title
              ? t('pending.confirm.roleMessageLevel', {
                  count: pending?.length ?? 0,
                  role: nameFor(confirm.role),
                  level: roles.find((r) => r.code === confirm.role).level_title,
                })
              : t('pending.confirm.roleMessage', { count: pending?.length ?? 0, role: nameFor(confirm.role) })
            : confirm === 'login'
              ? t('pending.confirm.loginMessage', { count: pending?.length ?? 0 })
              : t('pending.confirm.directoryMessage', { count: pending?.length ?? 0 })
        }
        confirmText={t('pending.confirm.setIt')}
        variant="primary"
      />
    </div>
  );
};

export default PendingPanel;
