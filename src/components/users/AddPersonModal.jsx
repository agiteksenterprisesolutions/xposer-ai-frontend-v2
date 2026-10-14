// src/components/users/AddPersonModal.jsx
//
// Add one person (POST /users/person) — the single-person form of the import,
// through the same code path, so a person added here is the same shape as one
// imported or admitted from a sync: a directory entry first, then a login when
// asked for, linked to it.
//
// A directory-only person is a success, not a half-failure: most of an
// organization never signs in, but must be placeable for escalation to route a
// report above the person it names. So a role is required for everyone — the
// role is what places them (each role sits at one level) — defaulting to
// reporter, the right answer for most of an organization.
//
// A login signs in one of three ways. Password: an account on the default
// password, emailed, to be replaced at first sign-in — it reaches them only
// in that email, so a failed delivery is shown with a way to resend. Google
// or Microsoft: no password is created at all; they sign in with that account.
//
// The manager is optional: left blank, the server fills it in when exactly
// one person sits one level above in the same department, and says so.
//
// With `member`, the same form creates a login for someone already in the
// directory: everything is prefilled from their entry and only the role and
// the sign-in method are decisions. The entry's stored external_id is sent as
// employee_id and can't be edited — the directory write is an upsert on it, so
// a blank or different id would create a second entry for the same person,
// and a report naming them could match either one.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, UserPlus } from 'lucide-react';
import Modal from '../layout/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import UndeliveredCredentials from './UndeliveredCredentials';
import { usersAPI } from '../../api/users';
import { useOrgRoles, REPORTER_ROLE } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { deriveUsername, usernameNeedsAttention } from '../../utils/usernames';
import { roleWithLevel, sortRolesByLevel } from '../../utils/roleLevels';
import { staffPath } from '../../utils/navigation';
import { describeError } from '../../utils/errors';

const EMPTY = {
  full_name: '',
  email: '',
  employee_id: '',
  designation: '',
  department: '',
  manager_external_id: '',
  role: REPORTER_ROLE,
  create_login: true,
  auth_provider: 'password',
  username: '',
};

/** Sent as Firebase's own sign_in_provider values. */
const SIGN_IN_METHODS = [
  { value: 'password', label: 'Password', hint: "We'll email them a one-time password they must change at first sign-in." },
  { value: 'google.com', label: 'Google', hint: 'No password is created. They sign in with their Google account.' },
  { value: 'microsoft.com', label: 'Microsoft', hint: 'No password is created. They sign in with their Microsoft account.' },
];

const inputClass =
  'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent';

const Field = ({ id, label, hint, error, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-ink-secondary">
      {label}
      {hint && <span className="ml-1 font-normal text-ink-muted">{hint}</span>}
    </label>
    {children}
    {error && <p className="text-xs text-danger-fg">{error}</p>}
  </div>
);

const blankToNull = (v) => (typeof v === 'string' && !v.trim() ? null : typeof v === 'string' ? v.trim() : v);

/** The form, prefilled from an existing directory entry. */
const fromMember = (member) => ({
  ...EMPTY,
  full_name: member.name || '',
  email: member.email || '',
  employee_id: member.external_id || '',
  designation: member.designation || '',
  department: member.department || '',
  manager_external_id: member.manager_external_id || '',
  role: member.role_code || REPORTER_ROLE,
  create_login: true,
});

/**
 * Props:
 *   isOpen, onClose
 *   members  – directory entries, for the manager picker
 *   member   – an existing directory entry to create a login for (optional)
 *   onAdded  – after a person is added, to refresh the lists
 */
const AddPersonModal = ({ isOpen, onClose, members = [], member = null, onAdded }) => {
  const forMember = Boolean(member);
  const { allRoles: unsortedRoles, nameFor, byCode } = useOrgRoles();
  const allRoles = useMemo(() => sortRolesByLevel(unsortedRoles.filter((r) => r.is_active !== false)), [unsortedRoles]);
  const orgName = useAuthStore((s) => s.user?.organization_name);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [result, setResult] = useState(null);
  // 400 role_has_no_level names the role: a one-field fix on the Roles screen.
  const [roleWithoutLevel, setRoleWithoutLevel] = useState(null);
  const orgSlug = useAuthStore((s) => s.user?.organization_slug);
  const chosenRole = byCode.get(form.role);

  // Opening for a directory entry starts from that entry, every time.
  useEffect(() => {
    if (isOpen && member) setForm(fromMember(member));
  }, [isOpen, member]);
  const method = SIGN_IN_METHODS.find((m) => m.value === form.auth_provider) || SIGN_IN_METHODS[0];

  const managers = useMemo(
    () => members.filter((m) => m.is_active !== false && m.external_id).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [members],
  );
  const username = form.create_login ? deriveUsername(form, orgName) : '';

  const set = (field) => (e) => {
    const value = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const close = () => {
    if (saving) return;
    setForm(EMPTY);
    setErrors({});
    setServerError(null);
    setResult(null);
    setRoleWithoutLevel(null);
    onClose();
  };

  const submit = async () => {
    const next = {};
    if (!form.full_name.trim()) next.full_name = 'Enter their full name — escalation matches report text against it.';
    if (!form.email.trim()) next.email = 'Enter their email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.role) next.role = 'Pick a role — it places them in the org chart.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setServerError(null);
    setRoleWithoutLevel(null);
    try {
      const body = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        // For an existing entry, always its stored id — never anything typed.
        employee_id: forMember ? member.external_id : blankToNull(form.employee_id),
        designation: blankToNull(form.designation),
        department: blankToNull(form.department),
        manager_external_id: blankToNull(form.manager_external_id),
        // Required on every request, account or not: the role places them.
        role: form.role,
        create_login: form.create_login,
        auth_provider: form.create_login ? form.auth_provider : null,
        username: form.create_login ? blankToNull(form.username) : null,
      };
      const res = await usersAPI.createPerson(body);
      setResult({ ...res, sentManager: body.manager_external_id, sentProvider: body.auth_provider });
      onAdded?.(res);
    } catch (err) {
      const described = describeError(err);
      const detail = err?.response?.data?.detail;
      if (detail?.code === 'role_has_no_level') setRoleWithoutLevel(detail.role_code || form.role);
      // They already have a login: the list we opened this from was stale.
      if (described.status === 400 && /already registered/i.test(described.summary)) {
        setServerError({ summary: `${form.full_name.trim() || 'This person'} already has a login.`, problems: [] });
        onAdded?.();
      } else {
        setServerError(described);
      }
    } finally {
      setSaving(false);
    }
  };

  const roleField = (
    <Field id="ap-role" label="Role" error={errors.role}>
      <select
        id="ap-role"
        value={form.role}
        onChange={set('role')}
        className={`${inputClass} ${errors.role ? 'border-danger-line' : 'border-line-strong'}`}
      >
        {allRoles.map((r) => (
          <option key={r.code} value={r.code}>
            {roleWithLevel(r)}
          </option>
        ))}
        {!allRoles.some((r) => r.code === REPORTER_ROLE) && <option value={REPORTER_ROLE}>Reporter</option>}
      </select>
      <p className={`text-xs ${chosenRole && !chosenRole.level_code ? 'text-warning-fg' : 'text-ink-muted'}`}>
        {chosenRole && !chosenRole.level_code
          ? 'This role has no level yet, so they can’t be placed in the org chart until it gets one.'
          : forMember
            ? 'Prefilled from their entry. Changing it also moves them in the org chart, because their level is their role’s level.'
            : form.create_login
            ? 'What they can do once signed in, and where they sit in the org chart.'
            : 'Places them in the org chart. Reporter fits most people who never sign in.'}
      </p>
    </Field>
  );

  if (result) {
    const user = result.user;
    const resultRole = byCode.get(result.role || user?.role);
    const placedLevel = result.level_code
      ? resultRole?.level_code === result.level_code
        ? resultRole.level_title
        : result.level_code
      : null;
    const managerName = (id) => members.find((m) => m.external_id === id)?.name || id;
    return (
      <Modal
        isOpen={isOpen}
        onClose={close}
        title={forMember ? 'Login created' : 'Person added'}
        size="large"
        footer={
          <div className="flex justify-end gap-2">
            {!forMember && (
              <Button
                variant="secondary"
                onClick={() => {
                  setForm(EMPTY);
                  setResult(null);
                }}
              >
                Add another
              </Button>
            )}
            <Button onClick={close}>Done</Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-fg" aria-hidden="true" />
            <p className="text-ink-secondary">{result.message}</p>
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl border border-line bg-subtle p-4">
            <dt className="text-ink-muted">Employee ID</dt>
            <dd className="font-mono text-ink">{result.external_id}</dd>
            {(result.role || user?.role) && (
              <>
                <dt className="text-ink-muted">Added as</dt>
                <dd className="text-ink">
                  {nameFor(result.role || user.role)}
                  {placedLevel ? ` (${placedLevel})` : ' — not placed yet: the role has no level'}
                </dd>
              </>
            )}
            {result.manager_external_id && (
              <>
                <dt className="text-ink-muted">Reports to</dt>
                <dd className="text-ink">
                  {managerName(result.manager_external_id)}
                  {(result.manager_inferred || result.manager_external_id !== result.sentManager) && (
                    <span className="text-ink-muted"> — from the hierarchy, as the only person one level above</span>
                  )}
                </dd>
              </>
            )}
            {result.account_created && user && (
              <>
                <dt className="text-ink-muted">Signs in as</dt>
                <dd className="font-mono text-ink">{user.username}</dd>
                <dt className="text-ink-muted">Sign-in</dt>
                <dd className="text-ink">
                  {result.sentProvider === 'google.com' || result.sentProvider === 'microsoft.com'
                    ? `With their ${result.sentProvider === 'google.com' ? 'Google' : 'Microsoft'} account. No password was created.`
                    : `${result.emails_sent ? 'Password emailed to them. ' : ''}A temporary one they must replace when they first sign in.`}
                </dd>
              </>
            )}
          </dl>
          <UndeliveredCredentials items={result.undelivered_credentials} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={forMember ? `Create a login for ${member.name}` : 'Add person'}
      size="large"
      closeOnOverlayClick={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button startIcon={UserPlus} onClick={submit} isLoading={saving}>
            {forMember ? 'Create login' : form.create_login ? 'Add person and create login' : 'Add to directory'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-ink-muted">
          {forMember
            ? 'They stay the same person in the directory; the login is linked to their entry.'
            : 'Everyone goes in the directory, so escalation can route a report above the person it names. Only people who need to sign in get a login.'}
        </p>

        {serverError && (
          <Alert variant="error" title={serverError.summary}>
            {serverError.problems?.length > 0 && (
              <ul className="list-disc space-y-1 pl-4">
                {serverError.problems.map((p, i) => (
                  <li key={i}>{p.message}</li>
                ))}
              </ul>
            )}
            {roleWithoutLevel && (
              <Link
                to={`${staffPath(orgSlug, 'roles')}?role=${encodeURIComponent(roleWithoutLevel)}`}
                className="mt-2 inline-block font-semibold underline underline-offset-2"
              >
                Give that role a level
              </Link>
            )}
          </Alert>
        )}

        {forMember && (
          <>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl border border-line bg-subtle p-4 text-sm">
              <dt className="text-ink-muted">Employee ID</dt>
              <dd className="font-mono text-ink">{member.external_id}</dd>
              {member.email && (
                <>
                  <dt className="text-ink-muted">Email</dt>
                  <dd className="text-ink">{member.email}</dd>
                </>
              )}
              {(member.designation || member.department) && (
                <>
                  <dt className="text-ink-muted">Job</dt>
                  <dd className="text-ink">{[member.designation, member.department].filter(Boolean).join(' · ')}</dd>
                </>
              )}
              {member.manager_external_id && (
                <>
                  <dt className="text-ink-muted">Reports to</dt>
                  <dd className="text-ink">
                    {members.find((m) => m.external_id === member.manager_external_id)?.name || member.manager_external_id}
                  </dd>
                </>
              )}
            </dl>
            <div className="grid gap-4 sm:grid-cols-2">
              {!member.email && (
                <Field id="ap-email" label="Email" error={errors.email}>
                  <input id="ap-email" type="email" value={form.email} onChange={set('email')} className={`${inputClass} ${errors.email ? 'border-danger-line' : 'border-line-strong'}`} />
                  <p className="text-xs text-ink-muted">Their directory entry has no email, and a login needs one.</p>
                </Field>
              )}
              {roleField}
            </div>
          </>
        )}

        {!forMember && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ap-name" label="Full name" error={errors.full_name}>
            <input id="ap-name" value={form.full_name} onChange={set('full_name')} className={`${inputClass} ${errors.full_name ? 'border-danger-line' : 'border-line-strong'}`} />
          </Field>
          <Field id="ap-email" label="Email" error={errors.email}>
            <input id="ap-email" type="email" value={form.email} onChange={set('email')} className={`${inputClass} ${errors.email ? 'border-danger-line' : 'border-line-strong'}`} />
          </Field>
          <Field id="ap-title" label="Job title" hint="optional">
            <input id="ap-title" value={form.designation} onChange={set('designation')} className={`${inputClass} border-line-strong`} />
          </Field>
          <Field id="ap-dept" label="Department" hint="optional">
            <input id="ap-dept" value={form.department} onChange={set('department')} className={`${inputClass} border-line-strong`} />
          </Field>
          {roleField}
          <Field id="ap-manager" label="Manager" hint="optional">
            <select id="ap-manager" value={form.manager_external_id} onChange={set('manager_external_id')} className={`${inputClass} border-line-strong`}>
              <option value="">Work it out from the hierarchy</option>
              {managers.map((m) => (
                <option key={m.external_id} value={m.external_id}>
                  {m.name}
                  {m.designation ? ` — ${m.designation}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-ink-muted">
              Leave blank and we'll work it out from the hierarchy where there's only one possible answer.
            </p>
          </Field>
          <Field id="ap-empid" label="Employee ID" hint="optional — made from the name if blank">
            <input id="ap-empid" value={form.employee_id} onChange={set('employee_id')} className={`${inputClass} border-line-strong font-mono`} />
          </Field>
        </div>
        )}

        <div className="space-y-4 rounded-xl border border-line bg-subtle p-4">
          {!forMember && (
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold text-ink">Create a login</span>
              <span className="block text-xs text-ink-muted">
                Leave off for people who only need to be in the directory.
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.create_login}
              aria-label="Create a login"
              onClick={() => set('create_login')(!form.create_login)}
              className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${form.create_login ? 'bg-accent' : 'bg-active'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${form.create_login ? 'left-6' : 'left-1'}`} />
            </button>
          </label>
          )}

          {form.create_login && (
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="sm:col-span-2">
                <legend className="mb-1.5 text-sm font-medium text-ink-secondary">Sign-in method</legend>
                <div role="radiogroup" aria-label="Sign-in method" className="grid grid-cols-3 gap-1 rounded-lg bg-active p-1">
                  {SIGN_IN_METHODS.map((option) => {
                    const on = form.auth_provider === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => set('auth_provider')(option.value)}
                        className={`rounded-md py-1.5 text-sm transition-colors ${
                          on ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink-muted hover:text-ink'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">{method.hint}</p>
              </fieldset>
              <Field id="ap-username" label="Username" hint="optional">
                <input
                  id="ap-username"
                  value={form.username}
                  onChange={set('username')}
                  placeholder={String(form.email).split('@')[0] || 'from their email'}
                  className={`${inputClass} border-line-strong font-mono`}
                />
              </Field>
              {username && (
                <p className={`sm:col-span-2 text-xs ${usernameNeedsAttention(username, orgName) ? 'text-warning-fg' : 'text-ink-muted'}`}>
                  They’ll sign in as <span className="font-mono font-semibold">{username}</span>
                  {usernameNeedsAttention(username, orgName) &&
                    ' — capitals and symbols are kept exactly and must be typed the same at sign-in. Set a plain lowercase username to avoid that.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddPersonModal;
