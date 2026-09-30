// src/pages/admin/VoiceProfile.jsx
//
// How the voice agent introduces the organization on a call: the name it
// uses, background it keeps to itself, and the first thing callers hear.
// Every field is optional — an empty one falls back to a sensible default —
// and a save applies from the next call.
//
// Organization admins edit their own organization. Super admins have none of
// their own, so they choose one first and every request carries its id.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AudioLines,
  Braces,
  Building2,
  Info,
  RotateCcw,
  Save,
  Volume2,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Badge from '../../components/ui/Badge';
import { ConfirmationModal } from '../../components/ui/Modal';
import api from '../../api/axios';
import { voiceProfileAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { AGENT_ORG_REQUIRED_MESSAGE } from '../../utils/agents';
import {
  ORGANIZATION_PLACEHOLDER,
  VOICE_PROFILE_LIMITS,
  normaliseLength,
  parseVoiceProfileErrors,
  renderGreeting,
  validateVoiceProfile,
  voiceProfileErrorMessage,
} from '../../utils/voiceProfile';

const EMPTY_FORM = { display_name: '', about: '', greeting: '' };

const toForm = (profile) => ({
  display_name: profile?.display_name ?? '',
  about: profile?.about ?? '',
  greeting: profile?.greeting ?? '',
});

// Labels sit above the control rather than floating inside it: the display
// name needs a real placeholder (the registered name), which a floating label
// would sit on top of.
const controlClass = (error) =>
  [
    'w-full rounded-lg border bg-subtle px-3 py-2.5 text-base text-ink placeholder-ink-subtle outline-none sm:text-sm',
    'transition-[border-color,box-shadow] duration-200 ease-out-xp',
    'disabled:cursor-not-allowed disabled:opacity-50',
    error
      ? 'border-danger-line focus:border-danger-solid focus:ring-2 focus:ring-danger-soft'
      : 'border-line hover:border-line-strong focus:border-line-accent focus:ring-2 focus:ring-accent-ring',
  ].join(' ');

const Counter = ({ value, max }) => {
  const length = normaliseLength(value);
  return (
    <span
      className={`shrink-0 text-xs tabular-nums ${
        length > max ? 'font-medium text-danger-fg' : 'text-ink-subtle'
      }`}
    >
      {length}/{max}
    </span>
  );
};

const Field = ({ id, label, hint, error, counter, action, children }) => (
  <div>
    <div className="mb-1.5 flex items-end justify-between gap-3">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {action}
    </div>
    {children}
    <div className="mt-1.5 flex items-start justify-between gap-3">
      <p className={`text-xs ${error ? 'text-danger-fg' : 'text-ink-subtle'}`}>
        {error || hint}
      </p>
      {counter}
    </div>
  </div>
);

const VoiceProfile = () => {
  useSEO({
    title: 'Voice Profile',
    description: 'Set how the voice assistant introduces your organization on calls.',
    noIndex: true,
  });
  const { user, role } = useAuthStore();
  const { orgSlug } = useParams();

  // Super admins belong to the separate platform service and have no
  // organization of their own; everyone else is judged by permission.
  const can = useCan();
  const isSuperAdmin = role === 'super_admin';
  const isOrgAdmin = !isSuperAdmin && can(PERM.voiceProfileRead);
  const canManage = isSuperAdmin || can(PERM.voiceProfileManage);

  // For a super admin, the organization being edited. An org admin never sets
  // this — their organization comes from the token.
  const [organizationInput, setOrganizationInput] = useState('');
  const [organizationId, setOrganizationId] = useState(null);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [loadError, setLoadError] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const greetingRef = useRef(null);

  // An org admin whose account has no organization would only get a 400 that
  // reads like a bug, so it is explained up front instead.
  const missingOrganization = isOrgAdmin && !user?.organization_id;
  const scope = isSuperAdmin ? organizationId : null;
  const canLoad = isOrgAdmin ? !missingOrganization : isSuperAdmin && Boolean(organizationId);

  const applyProfile = useCallback((data) => {
    setProfile(data);
    // Always from the response: the server normalises what it stores.
    setForm(toForm(data));
    setErrors({});
  }, []);

  // A super admin usually arrives under an organization's URL, so try to
  // start them on that organization. A silent fetch — this is a convenience,
  // and a miss should not raise the interceptor's "not found" toast.
  useEffect(() => {
    if (!isSuperAdmin || !orgSlug) return undefined;
    let cancelled = false;
    fetch(`${api.defaults.baseURL}/organizations/by-slug/${encodeURIComponent(orgSlug)}`, {
      headers: { accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((org) => {
        const id = org?.id ?? org?._id ?? org?.organization_id;
        if (cancelled || !id) return;
        setOrganizationInput((current) => current || String(id));
        setOrganizationId((current) => current || String(id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, orgSlug]);

  const fetchProfile = useCallback(async () => {
    if (!canLoad) return;
    setLoading(true);
    setLoadError(null);
    try {
      applyProfile(await voiceProfileAPI.getVoiceProfile(scope));
    } catch (error) {
      console.error('Error fetching voice profile:', error);
      setProfile(null);
      setForm(EMPTY_FORM);
      // 400/403 are already toasted by the interceptor; this keeps the reason
      // on the page, which is otherwise empty.
      setLoadError(voiceProfileErrorMessage(error, 'The voice profile could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [applyProfile, canLoad, scope]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear a field's error as soon as it is edited; save re-checks everything.
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Inserted at the caret, not appended, so it lands where the admin is
  // writing.
  const insertPlaceholder = () => {
    const el = greetingRef.current;
    const value = form.greeting;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const next = value.slice(0, start) + ORGANIZATION_PLACEHOLDER + value.slice(end);
    setField('greeting', next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + ORGANIZATION_PLACEHOLDER.length;
      el.setSelectionRange(caret, caret);
    });
  };

  const handleSave = async () => {
    const validation = validateVoiceProfile(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      toast.error('Fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    try {
      // All three, every time: a field left out of the body is cleared.
      const data = await voiceProfileAPI.updateVoiceProfile(
        {
          displayName: form.display_name.trim() || null,
          about: form.about.trim() || null,
          greeting: form.greeting.trim() || null,
        },
        scope,
      );
      applyProfile(data);
      toast.success('Saved — this applies from the next call.');
    } catch (error) {
      console.error('Error saving voice profile:', error);
      const fieldErrors = parseVoiceProfileErrors(error);
      // Anything that is not a 422 has already been toasted by the interceptor.
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        toast.error('Fix the highlighted fields before saving.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      applyProfile(await voiceProfileAPI.resetVoiceProfile(scope));
      setConfirmReset(false);
      toast.success('Voice profile reset to the defaults.');
    } catch (error) {
      console.error('Error resetting voice profile:', error);
    } finally {
      setResetting(false);
    }
  };

  const openOrganization = (event) => {
    event.preventDefault();
    const id = organizationInput.trim();
    if (!id) return;
    if (id === organizationId) {
      fetchProfile();
    } else {
      setOrganizationId(id);
    }
  };

  const savedForm = useMemo(() => toForm(profile), [profile]);
  const isDirty = Object.keys(EMPTY_FORM).some((field) => form[field] !== savedForm[field]);
  const isDefault = profile?.version === 0;
  const busy = saving || resetting;
  // Read-only for anyone who can see the profile but not change it.
  const locked = busy || !canManage;

  const organizationName = profile?.organization_name || 'your organization';
  const spokenName = form.display_name.trim() || organizationName;
  const preview = renderGreeting(form.greeting, spokenName);

  const updatedLabel = useMemo(() => {
    if (!profile?.updated_at) return null;
    // The server sends UTC without a zone designator.
    const raw = profile.updated_at;
    const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}Z`);
    if (Number.isNaN(date.getTime())) return null;
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const units = [
      ['second', 60],
      ['minute', 60],
      ['hour', 24],
      ['day', 7],
      ['week', 4.35],
      ['month', 12],
    ];
    const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    let value = seconds;
    for (const [unit, step] of units) {
      if (Math.abs(value) < step) return relative.format(Math.round(value), unit);
      value /= step;
    }
    return relative.format(Math.round(value), 'year');
  }, [profile?.updated_at]);

  const header = (
    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold text-ink">Voice Profile</h1>
        <p className="text-sm text-ink-muted">
          How the voice assistant introduces your organization on calls.
        </p>
      </div>
      {profile && (
        <div className="flex flex-wrap items-center gap-2">
          {profile.version > 0 && (
            <Badge variant="secondary" size="small">
              Version {profile.version}
              {updatedLabel ? ` · saved ${updatedLabel}` : ''}
            </Badge>
          )}
          {canManage && (
            <>
              <Button
                variant="outline"
                startIcon={RotateCcw}
                onClick={() => setConfirmReset(true)}
                disabled={busy || isDefault}
                title={isDefault ? 'Already using the defaults' : 'Clear the profile and use the defaults'}
              >
                Reset to defaults
              </Button>
              <Button
                startIcon={Save}
                onClick={handleSave}
                isLoading={saving}
                disabled={resetting || !isDirty}
              >
                Save profile
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );

  if (!isOrgAdmin && !isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <Alert variant="warning" title="Not available for your role">
          Viewing the voice profile needs the voice_profile:read permission on your role.
        </Alert>
      </div>
    );
  }

  if (missingOrganization) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <Alert variant="warning" title="No organization on this account">
          {AGENT_ORG_REQUIRED_MESSAGE}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {header}

      {isSuperAdmin && (
        <Card title="Organization" icon={Building2}>
          <form onSubmit={openOrganization} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="vp-organization" className="mb-1.5 block text-sm font-medium text-ink">
                Organization ID
              </label>
              <input
                id="vp-organization"
                value={organizationInput}
                onChange={(event) => setOrganizationInput(event.target.value)}
                placeholder="e.g. 66f1c2a9e4b0a1b2c3d4e5f6"
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
                className={`${controlClass(false)} font-mono`}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={busy || !organizationInput.trim()}>
              Open profile
            </Button>
          </form>
          <p className="mt-2 text-xs text-ink-subtle">
            {profile
              ? `Editing ${profile.organization_name}.`
              : 'As a super admin you can edit any organization. Choose one to load its profile.'}
          </p>
        </Card>
      )}

      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-line-accent" />
        </div>
      )}

      {!loading && loadError && (
        <Alert variant="error" title="Could not load the voice profile">
          {loadError}
        </Alert>
      )}

      {!loading && profile && (
        <>
          {isDefault && (
            <Alert variant="info" title="Using the defaults">
              Nothing has been saved for {profile.organization_name} yet. Callers hear the
              default greeting below until you save a profile.
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <Card title="Profile" icon={AudioLines}>
              <div className="space-y-6">
                <Field
                  id="vp-display-name"
                  label="Display name"
                  hint="The name the assistant uses for your organization. Leave empty to use the registered name."
                  error={errors.display_name}
                  counter={<Counter value={form.display_name} max={VOICE_PROFILE_LIMITS.display_name} />}
                >
                  <input
                    id="vp-display-name"
                    dir="auto"
                    value={form.display_name}
                    onChange={(event) => setField('display_name', event.target.value)}
                    placeholder={profile.organization_name}
                    disabled={locked}
                    aria-invalid={errors.display_name ? 'true' : undefined}
                    className={controlClass(errors.display_name)}
                  />
                </Field>

                <Field
                  id="vp-about"
                  label="About"
                  hint="What your organization does. The assistant uses this as background and never reads it out."
                  error={errors.about}
                  counter={<Counter value={form.about} max={VOICE_PROFILE_LIMITS.about} />}
                >
                  <textarea
                    id="vp-about"
                    dir="auto"
                    rows={5}
                    value={form.about}
                    onChange={(event) => setField('about', event.target.value)}
                    placeholder="e.g. A software company building AI products for enterprises."
                    disabled={locked}
                    aria-invalid={errors.about ? 'true' : undefined}
                    className={`${controlClass(errors.about)} resize-y`}
                  />
                </Field>

                <Field
                  id="vp-greeting"
                  label="Greeting"
                  hint="Write it in any language; callers hear it in their own language."
                  error={errors.greeting}
                  counter={<Counter value={form.greeting} max={VOICE_PROFILE_LIMITS.greeting} />}
                  action={
                    <button
                      type="button"
                      onClick={insertPlaceholder}
                      disabled={locked}
                      title="Insert the organization's name placeholder"
                      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-ink-secondary transition-colors hover:border-line-accent hover:text-accent-fg disabled:opacity-50"
                    >
                      <Braces className="h-3.5 w-3.5" />
                      {ORGANIZATION_PLACEHOLDER}
                    </button>
                  }
                >
                  <textarea
                    id="vp-greeting"
                    ref={greetingRef}
                    dir="auto"
                    rows={4}
                    value={form.greeting}
                    onChange={(event) => setField('greeting', event.target.value)}
                    placeholder={`e.g. Welcome to the ${ORGANIZATION_PLACEHOLDER} speak-up line. What would you like to report?`}
                    disabled={locked}
                    aria-invalid={errors.greeting ? 'true' : undefined}
                    className={`${controlClass(errors.greeting)} resize-y`}
                  />
                </Field>
              </div>
            </Card>

            <div className="space-y-4">
              <Card title="Callers will hear" icon={Volume2}>
                {!form.greeting.trim() && (
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-subtle">
                    Default greeting
                  </p>
                )}
                <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">
                  “{preview}”
                </p>
                <p className="mt-3 text-xs text-ink-subtle">
                  Translated into each caller's language automatically.
                </p>
              </Card>

              <div className="flex gap-2 rounded-xl border border-line-subtle bg-subtle p-4 text-xs text-ink-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" />
                <p>
                  <span className="font-mono">{ORGANIZATION_PLACEHOLDER}</span> is replaced with
                  the display name, or the registered name if that is empty. It is the only
                  placeholder allowed. Changes apply from the next call.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset the voice profile?"
        message="The display name, about text and greeting will be permanently cleared, and callers will hear the default greeting from the next call. This cannot be undone."
        confirmText="Reset to defaults"
        destructive
        isLoading={resetting}
      />
    </div>
  );
};

export default VoiceProfile;
