// src/pages/auth/SetPassword.jsx
//
// The one screen an account still on its default password can reach. Every
// account the organization provisions — added by hand, imported, or approved
// from an HR sync — starts on a shared default password, and the backend
// refuses every call but change-password, /users/me and logout until it is
// replaced. So this page stands outside every layout: no navigation, no
// widgets, nothing that would fire a request and fail.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, KeyRound, LogOut } from 'lucide-react';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import XposerLogo from '../../components/brand/XposerLogo';
import { authAPI } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import { getHomePath } from '../../utils/navigation';
import { PASSWORD_RULES, changePasswordSchema, mustChangePassword } from '../../utils/passwordPolicy';
import useSEO from '../../hooks/useSEO';

const PasswordField = ({ id, label, value, onChange, error, autoComplete, describedBy }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`h-11 w-full rounded-lg border bg-surface px-3.5 pr-11 text-[0.9375rem] text-ink outline-none transition-colors focus:border-line-accent focus:ring-3 focus:ring-accent-ring ${
            error ? 'border-danger-line' : 'border-line-strong'
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-hover hover:text-ink"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="text-xs text-danger-fg">{error}</p>}
    </div>
  );
};

const SetPassword = () => {
  useSEO({ title: 'Set your password', noIndex: true });
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, markPasswordChanged, refreshUser } = useAuthStore();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  // Confirm the flag with the server — /users/me is one of the three calls
  // still allowed — so an account whose flag has since cleared moves on.
  useEffect(() => {
    if (isAuthenticated) refreshUser();
  }, [isAuthenticated, refreshUser]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!mustChangePassword(user)) return <Navigate to={getHomePath(user) || '/'} replace />;

  const loginPath = user?.organization_slug ? `/${user.organization_slug}/login` : '/login';

  const set = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    const parsed = changePasswordSchema.safeParse(form);
    if (!parsed.success) {
      const next = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (!next[field]) next[field] = issue.message;
      });
      setErrors(next);
      return;
    }

    setSaving(true);
    try {
      await authAPI.changePassword({ current_password: form.current_password, new_password: form.new_password });
      markPasswordChanged();
      const fresh = await refreshUser();
      if (!fresh) {
        // The session didn't survive the change; the new password signs in.
        logout();
        navigate(loginPath, { replace: true });
        return;
      }
      navigate(getHomePath(fresh) || '/', { replace: true });
    } catch (error) {
      // The backend's wording covers a wrong current password and a new one
      // that is the shared default — both written for the person.
      const detail = error?.detail;
      setServerError(
        (typeof detail === 'string' && detail) || detail?.message || error?.message || "Your password wasn't changed. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const name = user?.full_name?.split(' ')[0] || user?.username;

  return (
    <main className="flex min-h-dvh items-start justify-center bg-canvas px-4 py-10 sm:items-center">
      <div className="w-full max-w-md space-y-6">
        <XposerLogo className="mx-auto h-7 w-auto" />

        <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-lg sm:p-8">
          <div className="space-y-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-fg">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-bold tracking-[-0.01em] text-ink">Set your own password{name ? `, ${name}` : ''}</h1>
            <p className="text-sm leading-relaxed text-ink-muted">
              Your account was created with a temporary password. Choose your own to continue — you can't use the
              app until you do.
            </p>
          </div>

          {serverError && <Alert variant="error">{serverError}</Alert>}

          <PasswordField
            id="sp-current"
            label="Temporary password"
            value={form.current_password}
            onChange={set('current_password')}
            error={errors.current_password}
            autoComplete="current-password"
          />
          <PasswordField
            id="sp-new"
            label="New password"
            value={form.new_password}
            onChange={set('new_password')}
            error={errors.new_password}
            autoComplete="new-password"
            describedBy="sp-rules"
          />
          <ul id="sp-rules" className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2" aria-label="Password rules">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(form.new_password);
              return (
                <li key={rule.id} className={`flex items-center gap-1.5 ${met ? 'text-success-fg' : 'text-ink-muted'}`}>
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${met ? 'bg-success-soft' : 'border border-line-strong'}`}
                  >
                    {met && <Check className="h-3 w-3" aria-hidden="true" />}
                  </span>
                  {rule.label}
                  <span className="sr-only">{met ? '(met)' : '(not met)'}</span>
                </li>
              );
            })}
          </ul>
          <PasswordField
            id="sp-confirm"
            label="Confirm new password"
            value={form.confirm_password}
            onChange={set('confirm_password')}
            error={errors.confirm_password}
            autoComplete="new-password"
          />

          <Button type="submit" fullWidth size="large" isLoading={saving}>
            Set password and continue
          </Button>
          <p className="text-center text-xs text-ink-muted">Signing in elsewhere? Those sessions end when you set it.</p>
        </form>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate(loginPath, { replace: true });
          }}
          className="mx-auto flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </main>
  );
};

export default SetPassword;
