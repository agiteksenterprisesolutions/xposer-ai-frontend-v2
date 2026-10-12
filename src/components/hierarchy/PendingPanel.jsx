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
import { CheckCircle2, Inbox, RotateCcw, Search, UserCheck, UserX } from 'lucide-react';
import Button from '../ui/Button';
import Skeleton from '../ui/Skeleton';
import { ConfirmationModal } from '../layout/Modal';
import { Checkbox } from '../roles/PermissionPicker';
import UndeliveredCredentials from '../users/UndeliveredCredentials';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { deriveUsername, usernameNeedsAttention } from '../../utils/usernames';
import { errorSummary } from '../../utils/errors';
import { roleWithLevel, sortRolesByLevel } from '../../utils/roleLevels';

const VIEWS = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'ready', label: 'Ready' },
  { value: 'dismissed', label: 'Dismissed' },
];

const MISSING_LABEL = {
  full_name: 'name',
  create_login: 'login decision',
  role: 'role',
  auth_provider: 'sign-in method',
  email: 'email',
};

const selectClass =
  'h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink outline-none focus:border-line-accent disabled:opacity-60';

/** Firebase's own sign_in_provider values. */
export const SIGN_IN_METHODS = [
  { value: 'password', label: 'Password' },
  { value: 'google.com', label: 'Google' },
  { value: 'microsoft.com', label: 'Microsoft' },
];

const LoginChoice = ({ value, onChange, disabled, name }) => (
  <div role="radiogroup" aria-label={`Login for ${name}`} className="grid grid-cols-2 gap-1 rounded-lg bg-active p-1">
    {[
      [true, 'Login'],
      [false, 'Directory only'],
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

const PendingRow = ({ person, levels, roles, nameFor, canManage, dismissed, selected, onSelect, onSave, onApprove, onDismiss, onRestage, busy, orgName }) => {
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
          <p id={`pending-${person.id}`} className="text-sm font-semibold text-ink">
            {person.full_name || <span className="italic text-ink-muted">No name from HR</span>}
          </p>
          <p className="text-xs text-ink-muted">
            {[person.email, person.designation, person.department].filter(Boolean).join(' · ') || 'No details from HR'}
          </p>
          {person.manager_external_id && (
            <p className="text-xs text-ink-subtle">Reports to {person.manager_external_id}</p>
          )}
          {person.suggested_level_code && (
            <p className="text-xs text-ink-subtle">Their title matched {levelTitle(person.suggested_level_code)}</p>
          )}
          {!dismissed && missing.length > 0 && (
            <p className="mt-1.5 text-xs font-medium text-warning-fg">
              Needs: {missing.map((m) => MISSING_LABEL[m] || m).join(', ')}
            </p>
          )}
          {!dismissed && person.ready_to_approve && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success-fg">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Ready to approve
            </p>
          )}
        </div>
      </div>

      {!dismissed && (
        <div className="grid w-full gap-2.5 sm:grid-cols-3 lg:w-[34rem] lg:shrink-0">
          <div className="space-y-1">
            <label htmlFor={`pl-role-${person.id}`} className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
              Role
            </label>
            <select
              id={`pl-role-${person.id}`}
              value={person.role || ''}
              disabled={!editable || busy}
              onChange={(e) => onSave(person, { role: e.target.value || null })}
              className={selectClass}
            >
              <option value="">
                {person.suggested_role_code ? `Suggested: ${nameFor(person.suggested_role_code)}` : 'Choose a role'}
              </option>
              {suggestedRoles.length > 0 && (
                <optgroup label={suggestedRoles.length === 1 ? 'Suggested' : 'Suggested — at the level their title matched'}>
                  {suggestedRoles.map((role) => (
                    <option key={role.code} value={role.code}>
                      {roleWithLevel(role)}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={suggestedRoles.length ? 'All roles' : 'Roles'}>
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
                Use suggestion
              </button>
            )}
            {!person.role && !person.suggested_role_code && suggestedRoles.length > 1 && (
              <p className="text-[11px] text-ink-muted">{suggestedRoles.length} roles sit at that level — pick one.</p>
            )}
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">Sign-in</span>
            <LoginChoice
              value={person.create_login}
              disabled={!editable || busy}
              name={person.full_name}
              onChange={(v) => onSave(person, { create_login: v })}
            />
            {username && (
              <p className={`truncate text-[11px] ${usernameNeedsAttention(username, orgName) ? 'text-warning-fg' : 'text-ink-muted'}`} title={username}>
                as <span className="font-mono">{username}</span>
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label htmlFor={`pl-method-${person.id}`} className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
              Signs in with
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
                    ? 'A one-time password, emailed, to change at first sign-in'
                    : 'No password is created; they sign in with that account'
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
                {person.create_login === false ? 'No login' : 'Decide sign-in first'}
              </p>
            )}
          </div>
        </div>
      )}

      {canManage && (
        <div className="flex shrink-0 gap-2 lg:pt-5">
          {dismissed ? (
            <Button variant="secondary" size="small" startIcon={RotateCcw} onClick={() => onRestage(person)} disabled={busy}>
              Restage
            </Button>
          ) : (
            <>
              <Button size="small" startIcon={UserCheck} onClick={() => onApprove([person.id])} disabled={busy || !person.ready_to_approve}>
                Approve
              </Button>
              <Button variant="ghost" size="small" onClick={() => onDismiss(person)} disabled={busy} aria-label={`Dismiss ${person.full_name}`} title="Dismiss">
                <UserX className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
};

const ApprovalResult = ({ result, onClose, nameFor, levelTitle }) => (
  <section className="space-y-3 rounded-xl border border-line bg-surface p-4" aria-live="polite">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-ink">{result.message || `Approved ${result.approved_count ?? 0}.`}</p>
        <p className="text-xs text-ink-muted">
          {result.approved_count ?? 0} admitted
          {result.accounts_created != null && ` · ${result.accounts_created} with a login`}
          {result.still_pending != null && ` · ${result.still_pending} still waiting`}
        </p>
      </div>
      <Button variant="ghost" size="small" onClick={onClose}>
        Dismiss
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

const INTRO =
  'People your HR sync found for the first time. Give each a role — it also places them in the org chart — and decide whether they sign in, and how. Then approve. Answers save as you go and survive the next sync.';

/** The queue while the hierarchy loads: same intro, search, tabs and rows. */
export const PendingSkeleton = () => (
  <div className="space-y-4" aria-busy="true">
    <p className="text-sm text-ink-secondary">{INTRO}</p>
    <div className="rounded-xl border border-line bg-surface">
      <div className="space-y-3 border-b border-line-subtle p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
          <div className="h-10 w-full rounded-lg border border-line bg-subtle" />
        </div>
        <div className="inline-flex rounded-lg bg-active p-1">
          {VIEWS.map((v, i) => (
            <span
              key={v.value}
              className={`rounded-md px-3 py-1.5 text-sm ${i === 0 ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink-muted'}`}
            >
              {v.label}
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
 *   canManage  – org_hierarchy:manage; reading needs only org_hierarchy:read
 *   onChanged  – reload the rest of the hierarchy after people are admitted
 *   onCount    – (pendingTotal) for the tab badge
 */
const PendingPanel = ({ levels, canManage, onChanged, onCount }) => {
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
      toast.success(`${person.full_name || 'Person'} dismissed. Later syncs will skip them.`);
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
      toast.success(`${person.full_name || 'Person'} is back in the queue.`);
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
    if (failed) toast.error(`${failed} of ${suggestable.length} couldn't be set.`);
    else toast.success(`Suggested roles set for ${suggestable.length} ${suggestable.length === 1 ? 'person' : 'people'}.`);
    await load();
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">{INTRO}</p>

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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search by name, email, employee ID, job title or department"
              aria-label="Search the queue"
              className="h-10 w-full rounded-lg border border-line bg-subtle pl-9 pr-3 text-sm text-ink outline-none hover:border-line-strong focus:border-line-accent"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Queue" className="inline-flex rounded-lg bg-active p-1">
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
                  {v.label}
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
                    <span className="text-sm text-ink-muted">{selectedRows.length} selected</span>
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => bulk({ ids: selectedRows.map((r) => r.id), decision: { create_login: true } }, 'Login set.')}>
                      Login
                    </Button>
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => bulk({ ids: selectedRows.map((r) => r.id), decision: { create_login: false } }, 'Set to directory only.')}>
                      Directory only
                    </Button>
                    <select
                      aria-label="Set a role for the selected people"
                      disabled={busy}
                      value=""
                      onChange={(e) => e.target.value && bulk({ ids: selectedRows.map((r) => r.id), decision: { role: e.target.value } }, 'Role set.')}
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                    >
                      <option value="">Set role…</option>
                      {roles.map((r) => (
                        <option key={r.code} value={r.code}>
                          {roleWithLevel(r)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Set a sign-in method for the selected people"
                      disabled={busy}
                      value=""
                      onChange={(e) =>
                        e.target.value &&
                        bulk(
                          { ids: selectedRows.map((r) => r.id), decision: { create_login: true, auth_provider: e.target.value } },
                          'Sign-in method set.',
                        )
                      }
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                    >
                      <option value="">Sign in with…</option>
                      {SIGN_IN_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <Button size="small" startIcon={UserCheck} disabled={busy || selectedReady.length === 0} onClick={() => approve(selectedReady.map((r) => r.id))}>
                      Approve {selectedReady.length || ''}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => setConfirm('login')}>
                      Create logins for all
                    </Button>
                    <Button variant="secondary" size="small" disabled={busy} onClick={() => setConfirm('directory')}>
                      Directory only for all
                    </Button>
                    {suggestable.length > 0 && (
                      <Button variant="secondary" size="small" disabled={busy} onClick={applySuggestedRoles}>
                        Use {suggestable.length} suggested role{suggestable.length === 1 ? '' : 's'}
                      </Button>
                    )}
                    <select
                      aria-label="Give everyone waiting one role"
                      disabled={busy}
                      value=""
                      onChange={(e) => e.target.value && setConfirm({ role: e.target.value })}
                      className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink"
                    >
                      <option value="">Role for all…</option>
                      {roles.map((r) => (
                        <option key={r.code} value={r.code}>
                          {roleWithLevel(r)}
                        </option>
                      ))}
                    </select>
                    {view === 'ready' && ready.length > 0 && (
                      <Button size="small" startIcon={UserCheck} disabled={busy} onClick={() => approve(ready.map((r) => r.id))}>
                        Approve all {ready.length}
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
            Couldn't load the queue. {error}{' '}
            <button type="button" onClick={load} className="font-medium text-link hover:underline">
              Try again
            </button>
          </p>
        ) : !loaded ? (
          <QueueSkeleton />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Inbox className="h-6 w-6 text-ink-subtle" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink">
              {query
                ? 'No one matches that search'
                : view === 'attention'
                  ? 'Nobody needs an answer'
                  : view === 'ready'
                    ? 'Nobody is ready to approve yet'
                    : 'Nobody has been dismissed'}
            </p>
            <p className="max-w-sm text-sm text-ink-muted">
              {view === 'dismissed'
                ? 'Dismissed people are skipped by every sync until you restage them.'
                : 'New people appear here after an HR sync finds them.'}
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
          Password accounts approved here start on the default password and must change it at first sign-in; Google and
          Microsoft accounts get no password. Bulk answers only touch people still waiting, never anyone already approved.
        </p>
      )}

      <ConfirmationModal
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const choice = confirm;
          setConfirm(null);
          if (choice?.role) {
            bulk({ all_pending: true, decision: { role: choice.role } }, `Everyone waiting is now ${nameFor(choice.role)}.`);
            return;
          }
          const login = choice === 'login';
          bulk({ all_pending: true, decision: { create_login: login } }, login ? 'Logins set for everyone waiting.' : 'Everyone waiting set to directory only.');
        }}
        title={
          confirm?.role
            ? `Make everyone waiting ${nameFor(confirm.role)}?`
            : confirm === 'login'
              ? 'Create logins for everyone waiting?'
              : 'Directory only for everyone waiting?'
        }
        message={
          confirm?.role
            ? `All ${pending?.length ?? 0} people waiting will get the ${nameFor(confirm.role)} role, which also places them in the org chart${
                roles.find((r) => r.code === confirm.role)?.level_title ? ` at ${roles.find((r) => r.code === confirm.role).level_title}` : ''
              }. Nobody is admitted yet.`
            : confirm === 'login'
              ? `All ${pending?.length ?? 0} people waiting will be set to get a login, signing in with a password unless you choose otherwise. Nobody is admitted yet.`
              : `All ${pending?.length ?? 0} people waiting will be added without a login. Nobody is admitted yet.`
        }
        confirmText="Set it"
        variant="primary"
      />
    </div>
  );
};

export default PendingPanel;
