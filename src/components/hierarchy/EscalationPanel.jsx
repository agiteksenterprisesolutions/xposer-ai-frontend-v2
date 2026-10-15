// src/components/hierarchy/EscalationPanel.jsx
//
// The escalation policy: what happens when a report is about someone in the
// directory. The backend works it out in order, and the page follows it:
//   A. find who the report is about (the subject) — a name written in the
//      report (if detect_named_people), "My line manager", or a handler;
//   B. keep them off the case — always — and their direct reports (if
//      exclude_direct_reports); the reporter never;
//   C. decide where it goes — a subject at or above `senior_level` goes to
//      `senior_route` (triage, a role, or a level) and is raised to at least
//      `senior_tier`; anyone else goes up their own reporting line.
// There is deliberately no "their own manager" route for senior people:
// that's exactly who the case has to avoid.
//
// One GET brings the settings and every list the selects need. A save sends
// only what changed (clearing the level sends null explicitly). The live
// warnings are worked out here from the loaded lists, so a route that can't
// work shows while it's being chosen, not after saving.
//
// The preview runs the SAVED policy against a real report and changes
// nothing, so it is off while there are unsaved changes.
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Info, Lock, Play, ShieldAlert } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Skeleton from '../ui/Skeleton';
import { orgEscalationAPI } from '../../api/orgEscalation';
import { reportsAPI } from '../../api/reports';
import { normalizeListResponse } from '../../utils/pagination';
import { CONFIDENTIALITY_TIERS } from '../../utils/reportTypes';
import { describeError } from '../../utils/errors';
import { staffPath } from '../../utils/navigation';
import { useAuthStore } from '../../store/authStore';

const fieldClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-accent disabled:cursor-not-allowed disabled:opacity-60';

const ROUTES = [
  { value: 'triage_queue', label: 'Triage', hint: 'Held for a person to place by hand.' },
  { value: 'role', label: 'A role' },
  { value: 'level', label: 'A level' },
];

const tierLabel = (tier) => CONFIDENTIALITY_TIERS.find((t) => t.value === tier)?.label || tier;

const editableOf = (settings) => ({
  detect_named_people: Boolean(settings?.detect_named_people),
  exclude_direct_reports: Boolean(settings?.exclude_direct_reports),
  senior_level: settings?.senior_level || null,
  senior_route: {
    target: settings?.senior_route?.target || 'triage_queue',
    target_ref: settings?.senior_route?.target_ref || null,
  },
  senior_tier: settings?.senior_tier || 'restricted',
});

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The PUT body: only what changed. Clearing the senior level sends null
 * explicitly; while nobody is senior, the route and tier aren't sent — the
 * server keeps them for when a level is set again.
 */
const changesOf = (saved, draft) => {
  const body = {};
  ['detect_named_people', 'exclude_direct_reports'].forEach((key) => {
    if (saved[key] !== draft[key]) body[key] = draft[key];
  });
  if (saved.senior_level !== draft.senior_level) body.senior_level = draft.senior_level;
  if (draft.senior_level) {
    if (!same(saved.senior_route, draft.senior_route)) {
      body.senior_route = {
        target: draft.senior_route.target,
        target_ref: draft.senior_route.target === 'triage_queue' ? null : draft.senior_route.target_ref,
      };
    }
    if (saved.senior_tier !== draft.senior_tier) body.senior_tier = draft.senior_tier;
  }
  return body;
};

const Toggle = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-10.5 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
      checked ? 'bg-accent' : 'bg-active'
    }`}
  >
    <span
      className={`inline-block h-4.5 w-4.5 rounded-full bg-surface shadow-sm transition-transform ${
        checked ? 'translate-x-5.25' : 'translate-x-0.75'
      }`}
    />
  </button>
);

const SectionTitle = ({ letter, children }) => (
  <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
    {letter}. {children}
  </h3>
);

const SwitchRow = ({ label, help, checked, onChange, disabled }) => (
  <div className="flex items-start justify-between gap-4">
    <span>
      <span className="block text-sm font-medium text-ink">{label}</span>
      <span className="mt-0.5 block text-xs text-ink-muted">{help}</span>
    </span>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
  </div>
);

const Fixed = ({ children }) => (
  <p className="flex gap-2 rounded-lg bg-subtle px-3 py-2.5 text-sm text-ink-secondary">
    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

const Warning = ({ children }) => (
  <p className="mt-1.5 flex gap-1.5 text-xs text-warning-fg">
    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

const FieldError = ({ children }) => (children ? <p className="mt-1.5 text-xs text-danger-fg">{children}</p> : null);

const Select = forwardRef(({ id, label, help, children, after, ...props }, ref) => (
  <div>
    <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink-secondary">
      {label}
    </label>
    <select id={id} ref={ref} className={fieldClass} {...props}>
      {children}
    </select>
    {help && <p className="mt-1 text-[11px] text-ink-subtle">{help}</p>}
    {after}
  </div>
));
Select.displayName = 'Select';

// ── Preview ───────────────────────────────────────────────────────────────────

const OUTCOMES = {
  normal: { label: 'Usual owner', variant: 'default' },
  escalated: { label: 'Up the reporting line', variant: 'info' },
  senior_route: { label: 'Senior route', variant: 'purple' },
  triage: { label: 'Triage', variant: 'warning' },
};

const OutcomeBadge = ({ outcome }) => {
  const info = OUTCOMES[outcome] || { label: outcome, variant: 'default' };
  // Badge has no purple; draw it here so the four outcomes stay apart.
  if (info.variant === 'purple') {
    return (
      <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800 dark:bg-purple-500/20 dark:text-purple-200">
        {info.label}
      </span>
    );
  }
  return <Badge variant={info.variant}>{info.label}</Badge>;
};

const destinationOf = (result, roleName) => {
  const member = result.escalate_to_member;
  if (member) return [member.name, member.designation].filter(Boolean).join(' · ');
  if (result.escalate_to_role) return `Anyone with the ${roleName(result.escalate_to_role)} role`;
  if (result.outcome === 'triage') return 'Triage, where a person places it';
  return "The report type's usual owner";
};

const PreviewResult = ({ label, result, roleName }) => {
  const [open, setOpen] = useState(false);
  const subjects = result.subjects || [];
  const exclusions = result.exclusions || [];
  const subjectName = (id) => subjects.find((s) => s.member_id === id)?.name || id;
  const steps = result.steps || [];

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-subtle">{label}</p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <OutcomeBadge outcome={result.outcome} />
        {result.raise_tier_to && <span className="text-xs font-medium text-ink-secondary">Tier → {tierLabel(result.raise_tier_to)}</span>}
      </div>
      {result.reason && <p className="mt-2 text-sm text-ink">{result.reason}</p>}
      {result.hint && <p className="mt-1 text-xs text-ink-muted">{result.hint}</p>}
      {result.escalate_on_subject === false && (
        <p className="mt-1 text-xs text-ink-muted">
          This report's type has escalation turned off, so it stays with the usual owner.
        </p>
      )}

      {result.oversight_gap && (
        <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger-fg">
          Nobody with organization-wide access could open this case.
        </p>
      )}
      {result.needs_review && (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-fg">
          A name is uncertain. A handler must confirm who is meant.
        </p>
      )}

      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-ink-muted">About</dt>
        <dd className="text-ink">
          {subjects.length === 0
            ? 'Nobody in the directory'
            : subjects.map((s, i) => (
                <span key={s.member_id || i}>
                  {i > 0 && ' · '}
                  <span title={(s.evidence || []).join('\n') || undefined} className={s.evidence?.length ? 'cursor-help underline decoration-dotted underline-offset-2' : ''}>
                    {s.name}
                  </span>
                  {s.status === 'possible' && <span className="text-ink-muted"> (uncertain)</span>}
                </span>
              ))}
        </dd>
        <dt className="text-ink-muted">Kept off</dt>
        <dd className="text-ink">
          {exclusions.length === 0
            ? 'Nobody'
            : exclusions.map((e, i) => (
                <span key={`${e.name}-${i}`}>
                  {i > 0 && ' · '}
                  {e.name}
                  {e.reason === 'direct_report' && <span className="text-ink-muted"> (reports to {subjectName(e.of)})</span>}
                  {e.reason === 'possible_subject' && <span className="text-ink-muted"> (uncertain)</span>}
                </span>
              ))}
        </dd>
        <dt className="text-ink-muted">Goes to</dt>
        <dd className="font-medium text-ink">{destinationOf(result, roleName)}</dd>
      </dl>

      {steps.length > 0 && (
        <div className="mt-3 border-t border-line-subtle pt-3">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true" />
            How this was decided ({steps.length} step{steps.length === 1 ? '' : 's'})
          </button>
          {open && (
            <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm text-ink-secondary">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-ink-subtle">Nothing was changed on the report.</p>
    </div>
  );
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

/** The panel while the settings load: the same two cards, data stubbed. */
export const EscalationSkeleton = () => (
  <div className="space-y-5 pb-20" aria-busy="true">
    <Card>
      <Card.Content className="space-y-6">
        <div className="flex items-start gap-4">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-fg sm:flex">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-ink">Escalation policy</p>
            <Skeleton.Text className="mt-0.5 w-96 max-w-full" />
          </div>
        </div>
        {[1, 3, 3].map((rows, i) => (
          <div key={i} className="space-y-3 border-t border-line-subtle pt-5">
            <Skeleton.Text size="xs" className="w-48" />
            {Array.from({ length: rows }).map((_, j) => (
              <div key={j} className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Skeleton.Text className="w-64 max-w-full" />
                  <Skeleton.Text size="xs" className="mt-1 w-96 max-w-full" />
                </div>
                <Skeleton className="h-6 w-10.5 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </Card.Content>
    </Card>
    <Card>
      <Card.Content className="space-y-3">
        <Skeleton.Text className="w-40" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </Card.Content>
    </Card>
  </div>
);

// ── Panel ─────────────────────────────────────────────────────────────────────

const EscalationPanel = ({ canManage, onGoTo, onDirtyChange }) => {
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({}); // { senior_level, route_ref }
  const [forbidden, setForbidden] = useState(false); // a 403 on save

  const levelRef = useRef(null);
  const roleRef = useRef(null);
  const routeLevelRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orgEscalationAPI.get();
      setSettings(data);
      setDraft(editableOf(data));
      setLoadError(null);
    } catch (error) {
      setLoadError(describeError(error).summary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saved = useMemo(() => (settings ? editableOf(settings) : null), [settings]);
  const dirty = Boolean(saved && draft) && Object.keys(changesOf(saved, draft)).length > 0;

  // Leaving with unsaved changes asks first: the tab (via the page) and the browser.
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ── Preview ──
  const [recent, setRecent] = useState([]);
  const [reportRef, setReportRef] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null); // { label, result }
  const [previewError, setPreviewError] = useState(null);

  useEffect(() => {
    reportsAPI
      .getAllReports({ page_size: 25 })
      .then((data) => setRecent(normalizeListResponse(data).items))
      .catch(() => setRecent([]));
  }, []);

  const runPreview = async () => {
    const ref = reportRef.trim();
    if (!ref || dirty) return;
    setPreviewing(true);
    setPreviewError(null);
    try {
      // The previous card stays until the new one arrives.
      const result = await orgEscalationAPI.preview(ref);
      setPreview({ label: ref, result });
    } catch (error) {
      const described = describeError(error);
      // The old card would read as this report's result.
      setPreview(null);
      setPreviewError(described.status === 404 ? 'No report with that number in your organization.' : described.summary);
    } finally {
      setPreviewing(false);
    }
  };

  if (loading && !settings) return <EscalationSkeleton />;
  if (loadError && !settings) {
    return (
      <Alert variant="error" title="Couldn't load the escalation policy">
        {loadError}{' '}
        <button type="button" onClick={load} className="font-medium text-link hover:underline">
          Try again
        </button>
      </Alert>
    );
  }

  const readOnly = !canManage || forbidden;
  const levels = settings.available_levels || [];
  const roles = settings.available_roles || [];
  const tiers = settings.tiers || ['standard', 'confidential', 'restricted'];
  const levelByCode = new Map(levels.map((l) => [l.code, l]));
  const roleByCode = new Map(roles.map((r) => [r.code, r]));
  const roleName = (code) => roleByCode.get(code)?.name || code;
  const route = draft.senior_route;
  const seniorLevel = levelByCode.get(draft.senior_level);

  // ── Live warnings, from the loaded lists ──
  const routeWarnings = [];
  if (draft.senior_level && route.target === 'role' && route.target_ref) {
    const role = roleByCode.get(route.target_ref);
    if (role && role.can_handle_cases === false) routeWarnings.push(`${role.name} can't be assigned cases.`);
    if (role && !(role.cleared_tiers || []).includes(draft.senior_tier)) {
      routeWarnings.push(
        `${role.name} can't open ${tierLabel(draft.senior_tier)} cases, which is the tier senior cases are raised to. Every senior case would end up in triage. Pick another role, or a lower tier.`,
      );
    }
  }
  if (draft.senior_level && route.target === 'level' && route.target_ref) {
    const level = levelByCode.get(route.target_ref);
    if (level && level.can_receive_escalations === false) {
      routeWarnings.push(`${level.title} is set not to receive escalations, so senior cases would end up in triage.`);
    }
    if (level && seniorLevel && level.rank < seniorLevel.rank) {
      routeWarnings.push('This sends cases about senior people to a more junior level.');
    }
  }
  // A role or level route needs its choice before it can be saved.
  const missingRef = Boolean(draft.senior_level) && route.target !== 'triage_queue' && !route.target_ref;

  const set = (changes) => {
    setDraft((prev) => ({ ...prev, ...changes }));
    setSaveError(null);
  };
  const setRoute = (changes) => set({ senior_route: { ...route, ...changes } });

  const save = async () => {
    if (!dirty || missingRef) return;
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      const data = await orgEscalationAPI.update(changesOf(saved, draft));
      setSettings(data);
      setDraft(editableOf(data));
      toast.success('Saved.');
    } catch (error) {
      const described = describeError(error);
      const code = (error?.response?.data ?? error)?.detail?.code;
      if (described.status === 403) {
        setForbidden(true);
        setSaveError({ summary: "You don't have permission to change the escalation policy.", problems: [] });
      } else if (code === 'unknown_level') {
        setFieldErrors({ [route.target === 'level' && levelByCode.has(draft.senior_level) ? 'route_ref' : 'senior_level']: described.summary });
        load();
      } else if (code === 'unknown_role') {
        setFieldErrors({ route_ref: described.summary });
      } else {
        setSaveError(described);
      }
    } finally {
      setSaving(false);
    }
  };

  const focus = (ref) => {
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    ref.current?.focus();
  };

  const problemLink = (problem) => {
    const linkClass = 'shrink-0 text-sm font-semibold underline underline-offset-2';
    switch (problem.code) {
      case 'empty_directory':
        return onGoTo ? (
          <button type="button" onClick={() => onGoTo('directory')} className={linkClass}>
            Add people
          </button>
        ) : null;
      case 'no_senior_level':
        return readOnly ? null : (
          <button type="button" onClick={() => focus(levelRef)} className={linkClass}>
            Set a senior level
          </button>
        );
      case 'unknown_level':
        return (
          <button
            type="button"
            onClick={() => focus(draft.senior_level && !levelByCode.has(draft.senior_level) ? levelRef : routeLevelRef)}
            className={linkClass}
          >
            Fix the level
          </button>
        );
      case 'unknown_role':
        return (
          <button type="button" onClick={() => focus(roleRef)} className={linkClass}>
            Fix the role
          </button>
        );
      case 'senior_route_not_cleared':
        return (
          <Link
            to={`${staffPath(orgSlug, 'roles')}${route.target === 'role' && route.target_ref ? `?role=${encodeURIComponent(route.target_ref)}` : ''}`}
            className={linkClass}
          >
            Roles &amp; permissions
          </Link>
        );
      default:
        return null;
    }
  };

  const problems = settings.problems || [];
  const directorySize = settings.directory_size;

  return (
    <div className="space-y-5 pb-20">
      <Card>
        <Card.Content className="space-y-6">
          <div className="flex items-start gap-4">
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-fg sm:flex">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-ink">Escalation policy</p>
              {directorySize === 0 ? (
                <p className="mt-0.5 text-sm text-ink-muted">
                  Nobody is in the directory yet, so no report can be matched to a person.{' '}
                  {onGoTo && (
                    <button type="button" onClick={() => onGoTo('directory')} className="font-medium text-link hover:underline">
                      Open the directory
                    </button>
                  )}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-ink-muted">
                  When a report is about someone in your directory, they never see it, and it goes to someone independent of
                  them.
                  {directorySize != null && (
                    <span className="font-semibold text-ink"> {directorySize} {directorySize === 1 ? 'person' : 'people'} in the directory.</span>
                  )}
                </p>
              )}
            </div>
          </div>

          {problems.length > 0 && (
            <ul className="space-y-2">
              {problems.map((problem, index) => {
                const warning = problem.severity === 'warning';
                return (
                  <li
                    key={`${problem.code}-${index}`}
                    className={`flex flex-col gap-1.5 rounded-lg px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between ${
                      warning ? 'bg-warning-soft text-warning-fg' : 'bg-info-soft text-info-fg'
                    }`}
                  >
                    <span className="flex gap-2">
                      {warning ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      )}
                      {problem.message}
                    </span>
                    {problemLink(problem)}
                  </li>
                );
              })}
            </ul>
          )}

          {/* A. Finding who a report is about */}
          <section className="space-y-3 border-t border-line-subtle pt-5">
            <SectionTitle letter="A">Finding who a report is about</SectionTitle>
            <SwitchRow
              label="Look for names in what reporters write"
              help="When a reporter writes the full name of someone in the directory, the report is treated as being about that person. When this is off, people are identified only when a reporter picks “My line manager” or a handler adds them."
              checked={draft.detect_named_people}
              onChange={(value) => set({ detect_named_people: value })}
              disabled={readOnly}
            />
          </section>

          {/* B. Keeping them off the case */}
          <section className="space-y-3 border-t border-line-subtle pt-5">
            <SectionTitle letter="B">Keeping them off the case</SectionTitle>
            <Fixed>
              The person a report is about never sees it: not in lists, search, exports or through a direct link, whatever
              their role.
            </Fixed>
            <Fixed>
              If a name could belong to more than one person, all of them are kept off the case until a handler decides who
              is meant.
            </Fixed>
            <SwitchRow
              label="Also keep their direct reports off the case"
              help="Nobody should investigate their own manager. This only goes one level down. The person who filed the report is never kept off it."
              checked={draft.exclude_direct_reports}
              onChange={(value) => set({ exclude_direct_reports: value })}
              disabled={readOnly}
            />
          </section>

          {/* C. Where the case goes */}
          <section className="space-y-4 border-t border-line-subtle pt-5">
            <SectionTitle letter="C">Where the case goes</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="esc-senior-level"
                ref={levelRef}
                label="Senior from"
                value={draft.senior_level || ''}
                onChange={(e) => {
                  set({ senior_level: e.target.value || null });
                  setFieldErrors((prev) => ({ ...prev, senior_level: undefined }));
                }}
                disabled={readOnly || levels.length === 0}
                help="People at this level or above are treated as senior. A report about them goes to the senior route below, not to their own manager."
                after={
                  <>
                    {levels.length === 0 && (
                      <p className="mt-1.5 text-xs text-warning-fg">
                        Define levels first.{' '}
                        {onGoTo && (
                          <button type="button" onClick={() => onGoTo('levels')} className="font-semibold underline underline-offset-2">
                            Open Levels
                          </button>
                        )}
                      </p>
                    )}
                    <FieldError>{fieldErrors.senior_level}</FieldError>
                  </>
                }
              >
                <option value="">Nobody is treated as senior</option>
                {levels.map((level) => (
                  <option key={level.code} value={level.code}>
                    {level.title} (rank {level.rank}) and above
                  </option>
                ))}
                {draft.senior_level && !levelByCode.has(draft.senior_level) && (
                  <option value={draft.senior_level}>{draft.senior_level} (no longer exists)</option>
                )}
              </Select>

              {draft.senior_level && (
                <Select
                  id="esc-senior-tier"
                  label="Raise senior cases to"
                  value={draft.senior_tier}
                  onChange={(e) => set({ senior_tier: e.target.value })}
                  disabled={readOnly}
                  help="A case about a senior person is raised to at least this confidentiality. It is never lowered."
                >
                  {tiers.map((tier) => (
                    <option key={tier} value={tier}>
                      {tierLabel(tier)}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            {draft.senior_level && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-medium text-ink-secondary">Senior cases go to</legend>
                <div role="radiogroup" className="flex flex-wrap gap-2">
                  {ROUTES.map((option) => {
                    const on = route.target === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          on ? 'border-line-accent bg-accent-soft font-medium text-ink' : 'border-line text-ink-secondary hover:border-line-strong'
                        } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <input
                          type="radio"
                          name="esc-route"
                          value={option.value}
                          checked={on}
                          disabled={readOnly}
                          onChange={() => {
                            setRoute({ target: option.value, target_ref: null });
                            setFieldErrors((prev) => ({ ...prev, route_ref: undefined }));
                          }}
                          className="accent-accent"
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
                {route.target === 'triage_queue' && <p className="text-[11px] text-ink-subtle">{ROUTES[0].hint}</p>}

                {route.target === 'role' && (
                  <div className="sm:max-w-sm">
                    <Select
                      id="esc-route-role"
                      ref={roleRef}
                      label="Role"
                      value={route.target_ref || ''}
                      onChange={(e) => {
                        setRoute({ target_ref: e.target.value || null });
                        setFieldErrors((prev) => ({ ...prev, route_ref: undefined }));
                      }}
                      disabled={readOnly}
                      after={
                        <>
                          {missingRef && <p className="mt-1.5 text-xs text-ink-muted">Choose a role to save.</p>}
                          <FieldError>{fieldErrors.route_ref}</FieldError>
                          {routeWarnings.map((w) => (
                            <Warning key={w}>{w}</Warning>
                          ))}
                        </>
                      }
                    >
                      <option value="">Choose a role…</option>
                      {roles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.name}
                        </option>
                      ))}
                      {route.target_ref && !roleByCode.has(route.target_ref) && (
                        <option value={route.target_ref}>{route.target_ref} (no longer available)</option>
                      )}
                    </Select>
                  </div>
                )}

                {route.target === 'level' && (
                  <div className="sm:max-w-sm">
                    <Select
                      id="esc-route-level"
                      ref={routeLevelRef}
                      label="Level"
                      value={route.target_ref || ''}
                      onChange={(e) => {
                        setRoute({ target_ref: e.target.value || null });
                        setFieldErrors((prev) => ({ ...prev, route_ref: undefined }));
                      }}
                      disabled={readOnly}
                      help="Someone at this level who isn't kept off the case. If nobody is free, it goes to triage."
                      after={
                        <>
                          {missingRef && <p className="mt-1.5 text-xs text-ink-muted">Choose a level to save.</p>}
                          <FieldError>{fieldErrors.route_ref}</FieldError>
                          {routeWarnings.map((w) => (
                            <Warning key={w}>{w}</Warning>
                          ))}
                        </>
                      }
                    >
                      <option value="">Choose a level…</option>
                      {levels.map((level) => (
                        <option key={level.code} value={level.code}>
                          {level.title} (rank {level.rank})
                        </option>
                      ))}
                      {route.target_ref && !levelByCode.has(route.target_ref) && (
                        <option value={route.target_ref}>{route.target_ref} (no longer exists)</option>
                      )}
                    </Select>
                  </div>
                )}
              </fieldset>
            )}

            <p className="rounded-lg bg-subtle px-3 py-2.5 text-sm text-ink-secondary">
              For anyone <span className="font-semibold text-ink">below</span> the senior level, the case goes up their own
              reporting line to the nearest person who can take it. If nobody above them can, it goes to the report type's
              usual owner, and they are still kept off it.
            </p>
            <p className="text-xs text-ink-muted">
              Each report type can also turn escalation off (in the report type builder, under Handling). Its reports still
              keep the person they're about off the case, but never go up the reporting line or to the senior route. If a type
              doesn't escalate, look there.
            </p>
          </section>

          {readOnly && (
            <p className="text-xs text-ink-subtle">
              <Badge size="small">View only</Badge> Changing the policy needs permission to manage the hierarchy.
            </p>
          )}
        </Card.Content>
      </Card>

      {/* D. Try it on a report — against the SAVED policy, so outside the form. */}
      <Card>
        <Card.Header>
          <Card.Title>D. Try it on a report</Card.Title>
          <Card.Description>
            Shows where a real report would go under the saved policy. Nothing on the report changes.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              runPreview();
            }}
          >
            <input
              value={reportRef}
              onChange={(e) => setReportRef(e.target.value)}
              list="esc-recent-reports"
              placeholder="Report number, e.g. ACME-12345678"
              aria-label="Report number"
              className={`${fieldClass} font-mono sm:flex-1`}
            />
            <datalist id="esc-recent-reports">
              {recent.map((report) => (
                <option key={report.id} value={report.report_number} />
              ))}
            </datalist>
            <Button type="submit" startIcon={Play} isLoading={previewing} disabled={!reportRef.trim() || dirty}>
              Preview
            </Button>
          </form>
          {dirty && <p className="text-xs text-ink-muted">Save your changes to preview them.</p>}
          {previewError && <p className="text-sm text-danger-fg">{previewError}</p>}
          {preview && <PreviewResult label={preview.label} result={preview.result} roleName={roleName} />}
        </Card.Content>
      </Card>

      {!readOnly && dirty && (
        <div className="sticky bottom-4 z-20 space-y-2">
          {saveError && (
            <Alert variant="error" title={saveError.summary}>
              {saveError.problems?.length > 0 && (
                <ul className="list-disc space-y-1 pl-4">
                  {saveError.problems.map((problem, index) => (
                    <li key={index}>{problem.message}</li>
                  ))}
                </ul>
              )}
            </Alert>
          )}
          <div className="flex flex-col gap-3 rounded-2xl bg-ink px-4 py-3 text-canvas shadow-xl sm:flex-row sm:items-center sm:pl-5">
            <p className="min-w-0 flex-1 text-sm">
              {missingRef ? `Choose a ${route.target} for senior cases before saving.` : 'Unsaved changes to the escalation policy.'}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(editableOf(settings));
                  setSaveError(null);
                  setFieldErrors({});
                }}
                disabled={saving}
                className="h-9 rounded-lg border border-canvas/25 px-3.5 text-sm font-medium transition-colors hover:bg-canvas/10 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || missingRef}
                className="h-9 rounded-lg bg-canvas px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EscalationPanel;
