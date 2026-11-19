// src/pages/admin/VoiceProfile.jsx
//
// How the voice agent introduces the organization on a call: the name it
// uses, background it keeps to itself, and the first thing callers hear.
//
// The API keeps greetings per language. This page edits the one written
// greeting (English); callers in other languages hear it translated, and any
// other language's entry already saved is carried through untouched.
// Every field is optional — an empty one falls back to a sensible default —
// and a save applies from the next call.
//
// Organization admins edit their own organization. Super admins have none of
// their own, so they choose one first and every request carries its id.
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AudioLines, Info, Lock, Plus, Volume2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../../components/ui/Button';
import Skeleton from '../../components/ui/Skeleton';
import Alert from '../../components/ui/Alert';
import { ConfirmationModal } from '../../components/ui/Modal';
import api from '../../api/axios';
import { voiceProfileAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import useSEO from '../../hooks/useSEO';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { agentOrgRequiredMessage } from '../../utils/agents';
import { intlLocale } from '../../utils/locale';
import {
  GREETING_LANGUAGE,
  ORGANIZATION_PLACEHOLDER,
  VOICE_PROFILE_LIMITS,
  greetingFrom,
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
  greeting: greetingFrom(profile),
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
  const { t } = useTranslation('agents');
  useSEO({
    title: t('voice.title'),
    description: t('voice.seoDescription'),
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
      setLoadError(voiceProfileErrorMessage(error, t('voice.loadFailedBody')));
    } finally {
      setLoading(false);
    }
  }, [applyProfile, canLoad, scope, t]);

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
      toast.error(t('voice.fixFields'));
      return;
    }

    setSaving(true);
    try {
      // Every field, every time: one left out of the body is cleared. Only the
      // English greeting is edited here; any other language's entry is kept.
      const others = (profile?.greetings || []).filter((entry) => entry.language !== GREETING_LANGUAGE);
      const greeting = form.greeting.trim();
      const data = await voiceProfileAPI.updateVoiceProfile(
        {
          displayName: form.display_name.trim() || null,
          about: form.about.trim() || null,
          greetings: greeting ? [...others, { language: GREETING_LANGUAGE, text: greeting }] : others,
        },
        scope,
      );
      applyProfile(data);
      toast.success(t('voice.saved'));
    } catch (error) {
      console.error('Error saving voice profile:', error);
      const fieldErrors = parseVoiceProfileErrors(error);
      // Anything that is not a 422 has already been toasted by the interceptor.
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        toast.error(t('voice.fixFields'));
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
      toast.success(t('voice.resetDone'));
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
    return date.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
  }, [profile?.updated_at]);

  const discard = () => {
    setForm(savedForm);
    setErrors({});
  };

  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  // Greetings in other languages, set outside this page, are kept untouched.
  const otherGreetings = (profile?.greetings || []).filter((entry) => entry.language !== GREETING_LANGUAGE);

  const header = (
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-xl font-bold text-ink">{t('voice.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t('voice.intro')}</p>
      </div>
      {!profile && loading && canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton.Text size="xs" className="w-24" />
          <Skeleton.Button className="w-36" />
        </div>
      )}
      {profile && (
        <div className="flex flex-wrap items-center gap-3">
          {profile.version > 0 && updatedLabel && <span className="text-xs text-ink-subtle">{t('voice.savedOn', { date: updatedLabel })}</span>}
          {canManage && (
            <Button
              variant="outline"
              onClick={() => setConfirmReset(true)}
              disabled={busy || isDefault}
              title={isDefault ? t('voice.alreadyDefault') : t('voice.resetTitle')}
            >
              {t('voice.reset')}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (!isOrgAdmin && !isSuperAdmin) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <Alert variant="warning" title={t('voice.notAvailable')}>
          {t('voice.notAvailableBody')}
        </Alert>
      </div>
    );
  }

  if (missingOrganization) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <Alert variant="warning" title={t('activity.noOrg')}>
          {agentOrgRequiredMessage()}
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24">
      {header}

      {isSuperAdmin && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <form onSubmit={openOrganization} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor="vp-organization" className="mb-1.5 block text-sm font-medium text-ink">
                {t('voice.orgId')}
              </label>
              <input
                id="vp-organization"
                value={organizationInput}
                onChange={(event) => setOrganizationInput(event.target.value)}
                placeholder="e.g. 66f1c2a9e4b0a1b2c3d4e5f6"
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
                dir="ltr"
                className={`${controlClass(false)} font-mono`}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={busy || !organizationInput.trim()}>
              {t('voice.openProfile')}
            </Button>
          </form>
          <p className="mt-2 text-xs text-ink-subtle">
            {profile ? t('voice.editing', { name: profile.organization_name }) : t('voice.superAdminHint')}
          </p>
        </section>
      )}

      {loading && (
        // The real cards and fields, empty and pulsing, so the page doesn't
        // move when the profile arrives.
        <div className="space-y-5" aria-busy="true">
          <section className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center gap-4 bg-ink px-6 py-8 text-center text-canvas">
              <span className="flex h-18 w-18 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_0_0_10px_color-mix(in_srgb,var(--color-accent)_22%,transparent)]">
                <AudioLines className="h-8 w-8" />
              </span>
              <span className="flex flex-col items-center">
                <Skeleton.Text size="xl" className="w-28 opacity-30" />
                <span className="mt-1 block text-sm opacity-70">{t('voice.agentLabel')}</span>
              </span>
            </div>
            <div className="space-y-6 p-5 sm:p-7">
              <Field id="vp-skeleton-name" label={t('voice.nameLabel')} hint={<Skeleton.Text size="xs" className="w-72" />}>
                <input disabled aria-hidden="true" className={`${controlClass()} animate-pulse text-[15px]`} />
              </Field>
              <Field
                id="vp-skeleton-about"
                label={t('voice.aboutLabel')}
                hint={<Skeleton.Text size="xs" className="w-80" />}
                action={
                  <span className="inline-flex items-center gap-1 rounded-full bg-active px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                    <Lock className="h-3 w-3" />
                    {t('voice.private')}
                  </span>
                }
              >
                <textarea disabled rows={4} aria-hidden="true" className={`${controlClass()} animate-pulse resize-none leading-relaxed`} />
              </Field>
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-ink">{t('voice.firstHeard')}</h2>
              <p className="text-sm text-ink-muted">{t('voice.firstHeardHint')}</p>
            </div>
            <div className="mt-5">
              <Field
                id="vp-skeleton-greeting"
                label={t('voice.greeting')}
                hint={<Skeleton.Text size="xs" className="w-64" />}
                action={canManage && <Skeleton className="h-6.5 w-36 rounded-md" />}
              >
                <textarea disabled rows={3} aria-hidden="true" className={`${controlClass()} animate-pulse resize-none leading-relaxed`} />
              </Field>
            </div>
            <div className="mt-5 flex gap-3 rounded-xl bg-ink p-4 text-canvas">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                <Volume2 className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Skeleton.Text size="2xs" className="w-40 opacity-30" />
                <Skeleton.Lines lines={2} className="mt-1 opacity-30" />
              </div>
            </div>
          </section>
        </div>
      )}

      {!loading && loadError && (
        <Alert variant="error" title={t('voice.loadFailed')}>
          {loadError}
        </Alert>
      )}

      {!loading && profile && (
        <>
          {isDefault && (
            <Alert variant="info" title={t('voice.usingDefaults')}>
              {t('voice.usingDefaultsBody', { name: profile.organization_name })}
            </Alert>
          )}

          {!canManage && (
            <Alert variant="info" title={t('page.viewOnly')}>
              {t('voice.viewOnlyBody')}
            </Alert>
          )}

          {/* Identity */}
          <section className="grid overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center gap-4 bg-ink px-6 py-8 text-center text-canvas">
              <span className="flex h-18 w-18 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_0_0_10px_color-mix(in_srgb,var(--color-accent)_22%,transparent)]">
                <AudioLines className="h-8 w-8" />
              </span>
              <span>
                <span dir="auto" className="block break-words text-xl font-bold">{spokenName}</span>
                <span className="mt-1 block text-sm opacity-70">{t('voice.agentLabel')}</span>
              </span>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              <Field
                id="vp-display-name"
                label={t('voice.nameLabel')}
                hint={t('voice.nameHint', { name: profile.organization_name })}
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
                  className={`${controlClass(errors.display_name)} text-[15px]`}
                />
              </Field>

              <Field
                id="vp-about"
                label={t('voice.aboutLabel')}
                hint={t('voice.aboutHint')}
                error={errors.about}
                counter={<Counter value={form.about} max={VOICE_PROFILE_LIMITS.about} />}
                action={
                  <span className="inline-flex items-center gap-1 rounded-full bg-active px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                    <Lock className="h-3 w-3" />
                    {t('voice.private')}
                  </span>
                }
              >
                <textarea
                  id="vp-about"
                  dir="auto"
                  rows={4}
                  value={form.about}
                  onChange={(event) => setField('about', event.target.value)}
                  placeholder={t('voice.aboutPlaceholder')}
                  disabled={locked}
                  aria-invalid={errors.about ? 'true' : undefined}
                  className={`${controlClass(errors.about)} resize-y leading-relaxed`}
                />
              </Field>
            </div>
          </section>

          {/* Greeting */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-ink">{t('voice.firstHeard')}</h2>
              <p className="text-sm text-ink-muted">{t('voice.firstHeardHint')}</p>
            </div>

            <div className="mt-5">
              <Field
                id="vp-greeting"
                label={t('voice.greetingEnglish')}
                hint={
                  form.greeting.trim()
                    ? t('voice.greetingHint', { placeholder: ORGANIZATION_PLACEHOLDER })
                    : t('voice.greetingBlank')
                }
                error={errors.greeting}
                counter={<Counter value={form.greeting} max={VOICE_PROFILE_LIMITS.greeting} />}
                action={
                  canManage && (
                    <button
                      type="button"
                      onClick={insertPlaceholder}
                      disabled={locked}
                      title={t('voice.insertTitle', { placeholder: ORGANIZATION_PLACEHOLDER })}
                      className="inline-flex items-center gap-1 rounded-md border border-line-accent bg-surface px-2 py-1 text-xs font-semibold text-accent-fg transition-colors hover:bg-accent-soft disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('voice.insertButton')}
                    </button>
                  )
                }
              >
                <textarea
                  id="vp-greeting"
                  ref={greetingRef}
                  dir="auto"
                  rows={3}
                  value={form.greeting}
                  onChange={(event) => setField('greeting', event.target.value)}
                  placeholder={`e.g. Welcome to the ${ORGANIZATION_PLACEHOLDER} speak-up line. What would you like to report?`}
                  disabled={locked}
                  aria-invalid={errors.greeting ? 'true' : undefined}
                  className={`${controlClass(errors.greeting)} resize-y leading-relaxed`}
                />
              </Field>
            </div>

            {/* What it sounds like, with the name filled in */}
            <div className="mt-5 flex gap-3 rounded-xl bg-ink p-4 text-canvas">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                <Volume2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-60">
                  {form.greeting.trim() ? t('voice.willHear') : t('voice.willHearDefault')}
                </p>
                <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                  “{preview}”
                </p>
              </div>
            </div>

            {otherGreetings.length > 0 && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-ink-subtle">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                {t('voice.otherGreetings', {
                  count: otherGreetings.length,
                  languages: otherGreetings.map((entry) => entry.language.toUpperCase()).join(t('listSeparator')),
                })}
              </p>
            )}
          </section>
        </>
      )}

      {/* Save bar */}
      {canManage && isDirty && (
        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl bg-ink px-4 py-3 text-canvas shadow-xl sm:flex-row sm:items-center sm:ps-5">
          <p className="min-w-0 flex-1 text-sm">{t('voice.unsaved')}</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={busy}
              className="h-9 rounded-lg border border-canvas/25 px-3.5 text-sm font-medium transition-colors hover:bg-canvas/10 disabled:opacity-50"
            >
              {t('summarizer.discard')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="h-9 rounded-lg bg-canvas px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t('common:status.saving') : t('voice.save')}
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title={t('voice.resetConfirmTitle')}
        message={t('voice.resetConfirmBody')}
        confirmText={t('voice.reset')}
        destructive
        isLoading={resetting}
      />
    </div>
  );
};

export default VoiceProfile;
