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
import { Trans, useTranslation } from 'react-i18next';
import Modal from '../layout/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import UndeliveredCredentials from './UndeliveredCredentials';
import { usersAPI } from '../../api/users';
import { useOrgRoles, REPORTER_ROLE } from '../../hooks/useOrgRoles';
import { useMemberNames } from '../../hooks/useMemberNames';
import MemberPicker from '../hierarchy/MemberPicker';
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

/** Sent as Firebase's own sign_in_provider values. Label and hint are translation keys under addPerson.method. */
const SIGN_IN_METHODS = [
  { value: 'password', key: 'password' },
  { value: 'google.com', key: 'google' },
  { value: 'microsoft.com', key: 'microsoft' },
];

const inputClass =
  'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent';

const Field = ({ id, label, hint, error, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-ink-secondary">
      {label}
      {hint && <span className="ms-1 font-normal text-ink-muted">{hint}</span>}
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
 *   member   – an existing directory entry to create a login for (optional)
 *   onAdded  – after a person is added, to refresh the lists
 */
const AddPersonModal = ({ isOpen, onClose, member = null, onAdded }) => {
  const { t } = useTranslation('people');
  const forMember = Boolean(member);
  const { allRoles: unsortedRoles, nameFor, byCode } = useOrgRoles();
  // A role tied to one legal entity (the entity admin) can't be given here:
  // the server refuses it (400 entity_admin_needs_entity). It is assigned
  // with Change role, which asks for the entity (ENTITY_ADMIN.md §1).
  const entityRoles = unsortedRoles.filter((r) => r.requires_entity);
  const allRoles = useMemo(
    () => sortRolesByLevel(unsortedRoles.filter((r) => r.is_active !== false && !r.requires_entity)),
    [unsortedRoles],
  );
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

  // Names for the managers this form shows: the entry's own, and the one the server chose.
  const { nameOf } = useMemberNames([member?.manager_external_id, result?.manager_external_id], { enabled: isOpen });
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
    if (!form.full_name.trim()) next.full_name = t('addPerson.errors.name');
    if (!form.email.trim()) next.email = t('addPerson.errors.email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = t('addPerson.errors.emailInvalid');
    if (!form.role) next.role = t('addPerson.errors.role');
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
      if (detail?.code === 'entity_admin_needs_entity') {
        setServerError({ summary: t('addPerson.entityRoleRefused'), problems: [] });
        return;
      }
      // They already have a login: the list we opened this from was stale.
      if (described.status === 400 && /already registered/i.test(described.summary)) {
        setServerError({ summary: form.full_name.trim() ? t('addPerson.alreadyHasLogin', { name: form.full_name.trim() }) : t('addPerson.alreadyHasLoginAnon'), problems: [] });
        onAdded?.();
      } else {
        setServerError(described);
      }
    } finally {
      setSaving(false);
    }
  };

  const roleField = (
    <Field id="ap-role" label={t('addPerson.role')} error={errors.role}>
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
        {!allRoles.some((r) => r.code === REPORTER_ROLE) && <option value={REPORTER_ROLE}>{t('addPerson.reporter')}</option>}
      </select>
      <p className={`text-xs ${chosenRole && !chosenRole.level_code ? 'text-warning-fg' : 'text-ink-muted'}`}>
        {chosenRole && !chosenRole.level_code
          ? t('addPerson.roleHelp.noLevel')
          : forMember
            ? t('addPerson.roleHelp.member')
            : form.create_login
            ? t('addPerson.roleHelp.login')
            : t('addPerson.roleHelp.directory')}
      </p>
      {entityRoles.length > 0 && (
        <p className="text-xs text-ink-muted">
          {t('addPerson.roleHelp.entityRole', { role: entityRoles.map((r) => r.name).join(', ') })}
        </p>
      )}
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
    const managerName = (id) => nameOf(id) || id;
    return (
      <Modal
        isOpen={isOpen}
        onClose={close}
        title={forMember ? t('addPerson.result.loginCreated') : t('addPerson.result.personAdded')}
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
                {t('addPerson.result.addAnother')}
              </Button>
            )}
            <Button onClick={close}>{t('addPerson.result.done')}</Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-fg" aria-hidden="true" />
            <p className="text-ink-secondary">{result.message}</p>
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-xl border border-line bg-subtle p-4">
            <dt className="text-ink-muted">{t('addPerson.employeeId')}</dt>
            <dd className="font-mono text-ink" dir="ltr">{result.external_id}</dd>
            {(result.role || user?.role) && (
              <>
                <dt className="text-ink-muted">{t('addPerson.result.addedAs')}</dt>
                <dd className="text-ink">
                  {nameFor(result.role || user.role)}
                  {placedLevel ? ` (${placedLevel})` : t('addPerson.result.notPlaced')}
                </dd>
              </>
            )}
            {result.manager_external_id && (
              <>
                <dt className="text-ink-muted">{t('addPerson.reportsTo')}</dt>
                <dd className="text-ink">
                  {managerName(result.manager_external_id)}
                  {(result.manager_inferred || result.manager_external_id !== result.sentManager) && (
                    <span className="text-ink-muted">{t('addPerson.result.managerInferred')}</span>
                  )}
                </dd>
              </>
            )}
            {result.account_created && user && (
              <>
                <dt className="text-ink-muted">{t('addPerson.result.signsInAs')}</dt>
                <dd className="font-mono text-ink" dir="ltr">{user.username}</dd>
                <dt className="text-ink-muted">{t('addPerson.result.signIn')}</dt>
                <dd className="text-ink">
                  {result.sentProvider === 'google.com' || result.sentProvider === 'microsoft.com'
                    ? t('addPerson.result.withProvider', { provider: result.sentProvider === 'google.com' ? 'Google' : 'Microsoft' })
                    : `${result.emails_sent ? `${t('addPerson.result.passwordEmailed')} ` : ''}${t('addPerson.result.temporary')}`}
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
      title={forMember ? t('addPerson.titleMember', { name: member.name }) : t('addPerson.title')}
      size="large"
      closeOnOverlayClick={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={close} disabled={saving}>
            {t('common:actions.cancel')}
          </Button>
          <Button startIcon={UserPlus} onClick={submit} isLoading={saving}>
            {forMember ? t('addPerson.submit.member') : form.create_login ? t('addPerson.submit.withLogin') : t('addPerson.submit.directory')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-ink-muted">
          {forMember
            ? t('addPerson.introMember')
            : t('addPerson.intro')}
        </p>

        {serverError && (
          <Alert variant="error" title={serverError.summary}>
            {serverError.problems?.length > 0 && (
              <ul className="list-disc space-y-1 ps-4">
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
                {t('addPerson.giveRoleLevel')}
              </Link>
            )}
          </Alert>
        )}

        {forMember && (
          <>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl border border-line bg-subtle p-4 text-sm">
              <dt className="text-ink-muted">{t('addPerson.employeeId')}</dt>
              <dd className="font-mono text-ink" dir="ltr">{member.external_id}</dd>
              {member.email && (
                <>
                  <dt className="text-ink-muted">{t('addPerson.email')}</dt>
                  <dd className="text-ink" dir="ltr">{member.email}</dd>
                </>
              )}
              {(member.designation || member.department) && (
                <>
                  <dt className="text-ink-muted">{t('addPerson.job')}</dt>
                  <dd className="text-ink">{[member.designation, member.department].filter(Boolean).join(' · ')}</dd>
                </>
              )}
              {member.manager_external_id && (
                <>
                  <dt className="text-ink-muted">{t('addPerson.reportsTo')}</dt>
                  <dd className="text-ink">
                    {nameOf(member.manager_external_id) || member.manager_external_id}
                  </dd>
                </>
              )}
            </dl>
            <div className="grid gap-4 sm:grid-cols-2">
              {!member.email && (
                <Field id="ap-email" label={t('addPerson.email')} error={errors.email}>
                  <input id="ap-email" type="email" dir="ltr" value={form.email} onChange={set('email')} className={`${inputClass} ${errors.email ? 'border-danger-line' : 'border-line-strong'}`} />
                  <p className="text-xs text-ink-muted">{t('addPerson.memberNoEmail')}</p>
                </Field>
              )}
              {roleField}
            </div>
          </>
        )}

        {!forMember && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ap-name" label={t('addPerson.fullName')} error={errors.full_name}>
            <input id="ap-name" value={form.full_name} onChange={set('full_name')} className={`${inputClass} ${errors.full_name ? 'border-danger-line' : 'border-line-strong'}`} />
          </Field>
          <Field id="ap-email" label={t('addPerson.email')} error={errors.email}>
            <input id="ap-email" type="email" dir="ltr" value={form.email} onChange={set('email')} className={`${inputClass} ${errors.email ? 'border-danger-line' : 'border-line-strong'}`} />
          </Field>
          <Field id="ap-title" label={t('addPerson.jobTitle')} hint={t('addPerson.optional')}>
            <input id="ap-title" value={form.designation} onChange={set('designation')} className={`${inputClass} border-line-strong`} />
          </Field>
          <Field id="ap-dept" label={t('addPerson.department')} hint={t('addPerson.optional')}>
            <input id="ap-dept" value={form.department} onChange={set('department')} className={`${inputClass} border-line-strong`} />
          </Field>
          {roleField}
          <Field id="ap-manager" label={t('addPerson.manager')} hint={t('addPerson.optional')}>
            <MemberPicker
              id="ap-manager"
              value={form.manager_external_id}
              onChange={(id) => setForm((prev) => ({ ...prev, manager_external_id: id }))}
              emptyLabel={t('addPerson.managerAuto')}
              className={`${inputClass} border-line-strong`}
            />
            <p className="text-xs text-ink-muted">
              {t('addPerson.managerHelp')}
            </p>
          </Field>
          <Field id="ap-empid" label={t('addPerson.employeeId')} hint={t('addPerson.employeeIdHint')}>
            <input id="ap-empid" value={form.employee_id} onChange={set('employee_id')} className={`${inputClass} border-line-strong font-mono`} />
          </Field>
        </div>
        )}

        <div className="space-y-4 rounded-xl border border-line bg-subtle p-4">
          {!forMember && (
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-semibold text-ink">{t('addPerson.createLogin')}</span>
              <span className="block text-xs text-ink-muted">
                {t('addPerson.createLoginHelp')}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.create_login}
              aria-label={t('addPerson.createLogin')}
              onClick={() => set('create_login')(!form.create_login)}
              className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${form.create_login ? 'bg-accent' : 'bg-active'}`}
            >
              <span className={`absolute top-1 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${form.create_login ? 'start-6' : 'start-1'}`} />
            </button>
          </label>
          )}

          {form.create_login && (
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset className="sm:col-span-2">
                <legend className="mb-1.5 text-sm font-medium text-ink-secondary">{t('addPerson.signInMethod')}</legend>
                <div role="radiogroup" aria-label={t('addPerson.signInMethod')} className="grid grid-cols-3 gap-1 rounded-lg bg-active p-1">
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
                        {t(`addPerson.method.${option.key}.label`)}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">{t(`addPerson.method.${method.key}.hint`)}</p>
              </fieldset>
              <Field id="ap-username" label={t('addPerson.username')} hint={t('addPerson.optional')}>
                <input
                  id="ap-username"
                  value={form.username}
                  onChange={set('username')}
                  placeholder={String(form.email).split('@')[0] || t('addPerson.usernamePlaceholder')}
                  dir="ltr"
                  className={`${inputClass} border-line-strong font-mono`}
                />
              </Field>
              {username && (
                <p className={`sm:col-span-2 text-xs ${usernameNeedsAttention(username, orgName) ? 'text-warning-fg' : 'text-ink-muted'}`}>
                  <Trans t={t} i18nKey="addPerson.signsInAs" values={{ username }} components={{ u: <span className="font-mono font-semibold" dir="ltr" /> }} />
                  {usernameNeedsAttention(username, orgName) && t('addPerson.usernameWarning')}
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
