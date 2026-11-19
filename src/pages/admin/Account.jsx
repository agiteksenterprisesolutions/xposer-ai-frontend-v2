// src/pages/admin/Account.jsx
//
// My account, for staff: your own name and email, and your password.
//
// Everyone may change their own password, and only through POST
// /users/change-password — admins included; the reset-password endpoint never
// works on yourself. Only an admin may change their own name or email (PUT
// /users/{me} with just those two); for anyone else they're read-only here,
// since the server refuses any self-edit with cannot_change_own. An admin
// may also move their own account onto Google or Microsoft sign-in; never
// back onto a password, which only another admin can set (a password can't be
// set on yourself). Role is shown, not edited.
import { useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, LogIn, Lock, UserRound } from 'lucide-react';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import { ConfirmationModal } from '../../components/ui/Modal';
import { usersAPI } from '../../api/users';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { AUTH_PROVIDERS, authProviderLabel as englishProviderLabel, isPasswordAccount } from '../../utils/authProviders';
import i18n from '../../i18n';
import { PASSWORD_RULES, changePasswordSchema } from '../../utils/passwordPolicy';
import { describeError } from '../../utils/errors';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import useSEO from '../../hooks/useSEO';

// Google and Microsoft are names; "Password" is a word to translate.
const authProviderLabel = (provider) =>
  !provider || provider === AUTH_PROVIDERS.PASSWORD
    ? i18n.t('provider.password', { ns: 'people' })
    : englishProviderLabel(provider);

const inputClass =
  'h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-line-accent';

const Field = ({ id, label, error, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium text-ink-secondary">
      {label}
    </label>
    {children}
    {error && <p className="text-xs text-danger-fg">{error}</p>}
  </div>
);

const ReadOnlyProfile = ({ user }) => {
  const { t } = useTranslation('people');
  return (
  <Card>
    <Card.Header>
      <Card.Title className="flex items-center gap-2">
        <UserRound className="h-4 w-4 text-ink-muted" aria-hidden="true" /> {t('account.details')}
      </Card.Title>
    </Card.Header>
    <Card.Content className="space-y-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
        <dt className="text-ink-muted">{t('account.fullName')}</dt>
        <dd className="text-ink" dir="auto">{user.full_name || '—'}</dd>
        <dt className="text-ink-muted">{t('account.email')}</dt>
        <dd className="break-all text-ink" dir="ltr">{user.email || '—'}</dd>
      </dl>
      <p className="text-xs text-ink-muted">{t('account.askAdmin')}</p>
    </Card.Content>
  </Card>
  );
};

const Profile = ({ user }) => {
  const { t } = useTranslation('people');
  const [fullName, setFullName] = useState(user.full_name || '');
  const [email, setEmail] = useState(user.email || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const dirty = fullName.trim() !== (user.full_name || '') || email.trim() !== (user.email || '');

  const save = async (event) => {
    event.preventDefault();
    if (!dirty || !fullName.trim() || !email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await usersAPI.updateMe(user.id, { full_name: fullName.trim(), email: email.trim() });
      await useAuthStore.getState().refreshUser();
      toast.success(t('account.saved'));
    } catch (err) {
      setError(describeError(err).summary);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-ink-muted" aria-hidden="true" /> {t('account.details')}
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="acc-name" label={t('account.fullName')} error={!fullName.trim() ? t('account.enterName') : null}>
              <input id="acc-name" autoComplete="name" dir="auto" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
            </Field>
            <Field id="acc-email" label={t('account.email')} error={!email.trim() ? t('account.enterEmail') : null}>
              <input
 autoComplete="email" dir="ltr" id="acc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex justify-end">
            <Button type="submit" isLoading={saving} disabled={!dirty || !fullName.trim() || !email.trim()} startIcon={Check}>
              {t('common:actions.save')}
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card>
  );
};

const PasswordField = ({ id, label, value, onChange, error, autoComplete }) => {
  const { t } = useTranslation('people');
  const [show, setShow] = useState(false);
  return (
    <Field id={id} label={label} error={error}>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`${inputClass} pe-10`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? t('setPassword.hide', { field: label }) : t('setPassword.show', { field: label })}
          className="absolute end-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-ink-subtle hover:text-ink"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </Field>
  );
};

const Password = ({ user }) => {
  const { t } = useTranslation('people');
  const blank = { current_password: '', new_password: '', confirm_password: '' };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  if (!isPasswordAccount(user)) {
    return (
      <Card>
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-ink-muted" aria-hidden="true" /> {t('account.password')}
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="text-sm text-ink-secondary">
            {t('account.ssoNoPassword', { provider: authProviderLabel(user.auth_provider) })}
          </p>
        </Card.Content>
      </Card>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    const parsed = changePasswordSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await authAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
      setForm(blank);
    } catch (err) {
      setError(describeError(err).summary);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-ink-muted" aria-hidden="true" /> {t('account.changePassword')}
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <form onSubmit={submit} className="space-y-4">
          <PasswordField
            id="acc-current"
            label={t('account.currentPassword')}
            value={form.current_password}
            onChange={set('current_password')}
            error={errors.current_password}
            autoComplete="current-password"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              id="acc-new"
              label={t('setPassword.new')}
              value={form.new_password}
              onChange={set('new_password')}
              error={errors.new_password}
              autoComplete="new-password"
            />
            <PasswordField
              id="acc-confirm"
              label={t('setPassword.confirm')}
              value={form.confirm_password}
              onChange={set('confirm_password')}
              error={errors.confirm_password}
              autoComplete="new-password"
            />
          </div>
          <ul className="grid gap-1 text-xs sm:grid-cols-2">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(form.new_password);
              return (
                <li key={rule.id} className={`flex items-center gap-1.5 ${met ? 'text-success-fg' : 'text-ink-muted'}`}>
                  <Check className={`h-3.5 w-3.5 ${met ? '' : 'opacity-30'}`} aria-hidden="true" />
                  {rule.label}
                  <span className="sr-only">{met ? t('setPassword.met') : t('setPassword.notMet')}</span>
                </li>
              );
            })}
          </ul>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex justify-end">
            <Button type="submit" isLoading={saving}>
              {t('account.changePassword')}
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card>
  );
};

const SSO_PROVIDERS = [AUTH_PROVIDERS.GOOGLE, AUTH_PROVIDERS.MICROSOFT];

/** Admins only: move your own account onto single sign-on. */
const SignInMethod = ({ user }) => {
  const { t } = useTranslation('people');
  const current = user.auth_provider || AUTH_PROVIDERS.PASSWORD;
  const choices = SSO_PROVIDERS.filter((provider) => provider !== current);
  const [next, setNext] = useState(choices[0]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await usersAPI.updateMe(user.id, { auth_provider: next });
      await useAuthStore.getState().refreshUser();
      toast.success(t('account.switched', { provider: authProviderLabel(next) }));
    } catch (err) {
      setError(describeError(err).summary);
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <LogIn className="h-4 w-4 text-ink-muted" aria-hidden="true" /> {t('account.signInMethod')}
        </Card.Title>
      </Card.Header>
      <Card.Content className="space-y-3">
        <p className="text-sm text-ink-secondary">
          <Trans t={t} i18nKey="account.signsInWith" values={{ provider: authProviderLabel(current) }} components={{ b: <span className="font-medium text-ink" /> }} />
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field id="acc-provider" label={t('account.switchTo')}>
            <select id="acc-provider" value={next} onChange={(e) => setNext(e.target.value)} className={`${inputClass} sm:w-56`}>
              {choices.map((provider) => (
                <option key={provider} value={provider}>
                  {authProviderLabel(provider)}
                </option>
              ))}
            </select>
          </Field>
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={saving}>
            {t('account.switch')}
          </Button>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-xs text-ink-muted">
          {isPasswordAccount(user) ? `${t('account.passwordRemoved')} ` : ''}
          {t('account.goBack')}
        </p>
      </Card.Content>
      <ConfirmationModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={save}
        title={t('account.confirmTitle', { provider: authProviderLabel(next) })}
        message={`${t('account.confirmBody', { provider: authProviderLabel(next), email: user.email })}${
          isPasswordAccount(user) ? ` ${t('account.passwordStops')}` : ''
        } ${t('account.onlyAdminBack')}`}
        confirmText={t('account.switch')}
        cancelText={t('common:actions.cancel')}
      />
    </Card>
  );
};

const Account = () => {
  const { t } = useTranslation('people');
  useSEO({ title: t('account.title'), description: t('account.subtitleAdmin'), noIndex: true });
  const user = useAuthStore((state) => state.user);
  const { nameFor } = useOrgRoles();
  // Only admins (user:update) may edit their own name and email.
  const canEditProfile = useCan()(PERM.userUpdate);
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-12">
      <div>
        <h1 className="text-xl font-bold text-ink">{t('account.title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {canEditProfile ? t('account.subtitleAdmin') : t('account.subtitle')}
        </p>
      </div>

      {canEditProfile ? (
        <Profile key={`${user.id}-${user.full_name}-${user.email}`} user={user} />
      ) : (
        <ReadOnlyProfile user={user} />
      )}
      <Password user={user} />
      {canEditProfile && <SignInMethod key={user.auth_provider || 'password'} user={user} />}

      <Card>
        <Card.Content className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Lock className="h-4 w-4 text-ink-muted" aria-hidden="true" /> {t('account.setByAdmin')}
          </p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-ink-muted">{t('account.username')}</dt>
            <dd className="font-mono text-ink" dir="ltr">{user.username}</dd>
            <dt className="text-ink-muted">{t('account.role')}</dt>
            <dd className="text-ink">
              <Badge size="small">{user.role_name || nameFor(user.role)}</Badge>
            </dd>
            {!canEditProfile && (
              <>
                <dt className="text-ink-muted">{t('account.signInMethod')}</dt>
                <dd className="text-ink">{authProviderLabel(user.auth_provider)}</dd>
              </>
            )}
          </dl>
          <p className="text-xs text-ink-muted">
            {canEditProfile
              ? t('account.footAdmin')
              : t('account.foot')}
          </p>
        </Card.Content>
      </Card>
    </div>
  );
};

export default Account;
