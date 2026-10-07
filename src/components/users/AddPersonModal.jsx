// src/components/users/AddPersonModal.jsx
//
// Add one person (POST /users/person) — the single-person form of the import,
// through the same code path, so a person added here is the same shape as one
// imported or admitted from a sync: a directory entry first, then a login when
// asked for, linked to it.
//
// A directory-only person is a success, not a half-failure: most of an
// organization never signs in, but must be placeable for escalation to route a
// report above the person it names. A login starts on the default password,
// which the person must replace at first sign-in; it reaches them only in the
// welcome email, so a failed delivery is shown with a way to resend.
import { useMemo, useState } from 'react';
import { CheckCircle2, UserPlus } from 'lucide-react';
import Modal from '../layout/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import UndeliveredCredentials from './UndeliveredCredentials';
import { usersAPI } from '../../api/users';
import { useOrgRoles, REPORTER_ROLE } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { deriveUsername, usernameNeedsAttention } from '../../utils/usernames';
import { describeError } from '../../utils/errors';

const EMPTY = {
  full_name: '',
  email: '',
  employee_id: '',
  designation: '',
  department: '',
  level_code: '',
  manager_external_id: '',
  create_login: true,
  role: REPORTER_ROLE,
  username: '',
};

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

/**
 * Props:
 *   isOpen, onClose
 *   levels   – hierarchy levels (may be empty without org_hierarchy:read)
 *   members  – directory entries, for the manager picker
 *   onAdded  – after a person is added, to refresh the lists
 */
const AddPersonModal = ({ isOpen, onClose, levels = [], members = [], onAdded }) => {
  const { allRoles, nameFor } = useOrgRoles();
  const orgName = useAuthStore((s) => s.user?.organization_name);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [result, setResult] = useState(null);

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
    onClose();
  };

  const submit = async () => {
    const next = {};
    if (!form.full_name.trim()) next.full_name = 'Enter their full name — escalation matches report text against it.';
    if (!form.email.trim()) next.email = 'Enter their email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (form.create_login && !form.role) next.role = 'Pick a role for their login.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setServerError(null);
    try {
      const body = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        employee_id: blankToNull(form.employee_id),
        designation: blankToNull(form.designation),
        department: blankToNull(form.department),
        level_code: blankToNull(form.level_code),
        manager_external_id: blankToNull(form.manager_external_id),
        create_login: form.create_login,
        role: form.create_login ? form.role : null,
        username: form.create_login ? blankToNull(form.username) : null,
      };
      const res = await usersAPI.createPerson(body);
      setResult(res);
      onAdded?.(res);
    } catch (err) {
      setServerError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const user = result.user;
    return (
      <Modal
        isOpen={isOpen}
        onClose={close}
        title="Person added"
        size="large"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setForm(EMPTY);
                setResult(null);
              }}
            >
              Add another
            </Button>
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
            {result.account_created && user && (
              <>
                <dt className="text-ink-muted">Signs in as</dt>
                <dd className="font-mono text-ink">{user.username}</dd>
                <dt className="text-ink-muted">Role</dt>
                <dd className="text-ink">{nameFor(user.role)}</dd>
                <dt className="text-ink-muted">Password</dt>
                <dd className="text-ink">
                  {result.emails_sent ? 'Emailed to them. ' : ''}A temporary one they must replace when they first sign in.
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
      title="Add person"
      size="large"
      closeOnOverlayClick={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button startIcon={UserPlus} onClick={submit} isLoading={saving}>
            {form.create_login ? 'Add person and create login' : 'Add to directory'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-ink-muted">
          Everyone goes in the directory, so escalation can route a report above the person it names. Only people who
          need to sign in get a login.
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
          </Alert>
        )}

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
          <Field id="ap-level" label="Level" hint="optional">
            <select id="ap-level" value={form.level_code} onChange={set('level_code')} className={`${inputClass} border-line-strong`}>
              <option value="">{levels.length ? 'Not placed yet' : 'No levels to choose from'}</option>
              {levels.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.title}
                </option>
              ))}
            </select>
          </Field>
          <Field id="ap-manager" label="Manager" hint="optional">
            <select id="ap-manager" value={form.manager_external_id} onChange={set('manager_external_id')} className={`${inputClass} border-line-strong`}>
              <option value="">No manager on file</option>
              {managers.map((m) => (
                <option key={m.external_id} value={m.external_id}>
                  {m.name}
                  {m.designation ? ` — ${m.designation}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field id="ap-empid" label="Employee ID" hint="optional — made from the name if blank">
            <input id="ap-empid" value={form.employee_id} onChange={set('employee_id')} className={`${inputClass} border-line-strong font-mono`} />
          </Field>
        </div>

        <div className="space-y-4 rounded-xl border border-line bg-subtle p-4">
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

          {form.create_login && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="ap-role" label="Role" error={errors.role}>
                <select id="ap-role" value={form.role} onChange={set('role')} className={`${inputClass} border-line-strong`}>
                  {allRoles.map((r) => (
                    <option key={r.code} value={r.code}>
                      {nameFor(r.code)}
                    </option>
                  ))}
                  {!allRoles.some((r) => r.code === REPORTER_ROLE) && <option value={REPORTER_ROLE}>Reporter</option>}
                </select>
              </Field>
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
              <p className="sm:col-span-2 text-xs text-ink-muted">
                They get a temporary password by email and must replace it when they first sign in.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddPersonModal;
