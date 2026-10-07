// src/components/hierarchy/EscalationPanel.jsx
//
// The conflict-of-interest rules: when a report implicates someone, where it
// goes, whether that person is locked out of it, and what confidentiality
// tier it is raised to. Detection is two signals — the reporter's answer to
// the trigger question, and (optionally) a match of the names they wrote
// against the directory.
//
// The rule editor works off `available_levels` / `available_roles` from the
// settings themselves. A preview runs the SAVED rules against a real report
// and changes nothing — the alternative is finding out by reassigning a live
// case away from someone.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Lock, Play, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import SkippedManagers from '../reports/SkippedManagers';
import Skeleton from '../ui/Skeleton';
import { orgEscalationAPI } from '../../api/orgEscalation';
import { reportsAPI } from '../../api/reports';
import { useOrgRoles, REPORTER_ROLE } from '../../hooks/useOrgRoles';
import { normalizeListResponse } from '../../utils/pagination';
import { getReportTitle } from '../../utils/reports';
import { CONFIDENTIALITY_TIERS } from '../../utils/reportTypes';
import { describeError, errorSummary } from '../../utils/errors';

const TARGETS = [
  { value: 'manager_chain', label: "Their manager", hint: "The implicated person's own manager, from the directory." },
  { value: 'level', label: 'A hierarchy level', hint: 'Whoever sits at the chosen level.' },
  { value: 'role', label: 'A role', hint: 'Holders of the chosen role — routing by function.' },
  { value: 'triage_queue', label: 'The triage queue', hint: 'Flagged for someone to place by hand.' },
];

// A floor: "standard" would never raise anything, so it isn't offered.
const TIERS = CONFIDENTIALITY_TIERS.filter((tier) => tier.value !== 'standard');

const fieldClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-accent disabled:cursor-not-allowed disabled:opacity-60';

const blankRule = () => ({
  when_value: '',
  target: 'manager_chain',
  target_ref: null,
  lock_out_implicated: true,
  raise_tier_to: null,
});

const editableOf = (settings) => ({
  enabled: Boolean(settings?.enabled),
  trigger_field: settings?.trigger_field || '',
  match_named_people: Boolean(settings?.match_named_people),
  rules: (settings?.rules || []).map((rule) => ({ ...blankRule(), ...rule })),
});

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

/** One named person in a preview result, whatever shape the lookup used. */
const personName = (person) =>
  person && typeof person === 'object' ? person.name || person.full_name || person.external_id || null : person || null;

const PreviewResult = ({ result, levelName, nameFor }) => {
  const rule = result.rule || result.matched_rule;
  const implicated = personName(result.implicated_member);
  const routedTo = personName(
    result.escalate_to_member || result.escalate_to || result.escalated_to || result.escalated_to_member || result.target_member,
  );
  return (
    <div className={`rounded-xl border p-4 ${result.matched ? 'border-line-accent bg-accent-soft' : 'border-line bg-subtle'}`}>
      <p className="text-sm font-semibold text-ink">{result.matched ? 'A rule would apply' : 'No rule would apply'}</p>
      {result.reason && <p className="mt-1 text-sm text-ink-secondary">{result.reason}</p>}
      {(implicated || routedTo || rule) && (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {implicated && (
            <div>
              <dt className="text-xs text-ink-subtle">Implicated</dt>
              <dd className="font-medium text-ink">{implicated}</dd>
            </div>
          )}
          {routedTo && (
            <div>
              <dt className="text-xs text-ink-subtle">Would go to</dt>
              <dd className="font-medium text-ink">{routedTo}</dd>
            </div>
          )}
          {rule && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-ink-subtle">Rule</dt>
              <dd className="text-ink">
                When the answer is <span className="font-mono">{rule.when_value}</span> →{' '}
                {rule.target === 'level'
                  ? levelName(rule.target_ref)
                  : rule.target === 'role'
                    ? nameFor(rule.target_ref)
                    : TARGETS.find((t) => t.value === rule.target)?.label || rule.target}
                {rule.lock_out_implicated && ' · locks them out'}
                {rule.raise_tier_to && ` · at least ${rule.raise_tier_to}`}
              </dd>
            </div>
          )}
        </dl>
      )}
      {result.matched && implicated && !routedTo && (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-fg">
          No one above them can take the case, so it would need manual triage.
        </p>
      )}
      {result.skipped_managers?.length > 0 && (
        <div className="mt-3">
          <SkippedManagers skipped={result.skipped_managers} />
        </div>
      )}
      <p className="mt-3 text-xs text-ink-subtle">Nothing was changed on the report.</p>
    </div>
  );
};

/** The panel while the settings load: the same three cards, data stubbed. */
export const EscalationSkeleton = () => (
  <div className="space-y-5 pb-20" aria-busy="true">
    <Card>
      <Card.Content className="space-y-5">
        <div className="flex items-start gap-4">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-fg sm:flex">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-ink">Conflict-of-interest routing</p>
            <Skeleton.Text className="mt-0.5 w-96 max-w-full" />
          </div>
          <Skeleton className="h-6 w-10.5 rounded-full" />
        </div>
        <div className="grid gap-4 border-t border-line-subtle pt-5 sm:grid-cols-2">
          <div>
            <Skeleton.Text size="xs" className="mb-1 w-24" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton.Text size="xs" className="mt-1 w-56" />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Skeleton.Text className="w-56" />
              <Skeleton.Lines size="xs" lines={2} className="mt-0.5" />
            </div>
            <Skeleton className="h-6 w-10.5 rounded-full" />
          </div>
        </div>
      </Card.Content>
    </Card>

    <Card>
      <Card.Header className="flex items-baseline justify-between gap-3">
        <div>
          <Card.Title>Rules</Card.Title>
          <Card.Description>One per answer to the trigger question.</Card.Description>
        </div>
        <Skeleton.Button small className="w-24" />
      </Card.Header>
      <Card.Content className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-line p-4">
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.4fr)]">
              <div>
                <Skeleton.Text size="xs" className="mb-1 w-28" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <span className="hidden w-4 lg:block" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Skeleton.Text size="xs" className="mb-1 w-16" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton.Text size="2xs" className="mt-1 w-40" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 border-t border-line-subtle pt-3">
              <div className="flex-1">
                <Skeleton.Text className="w-48" />
                <Skeleton.Text size="xs" className="w-80 max-w-full" />
              </div>
              <Skeleton className="h-9 w-40 rounded-lg" />
            </div>
          </div>
        ))}
      </Card.Content>
    </Card>
  </div>
);

const EscalationPanel = ({ levels = [], canManage, onGoTo }) => {
  const { nameFor } = useOrgRoles();
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [reports, setReports] = useState([]);
  const [previewId, setPreviewId] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await orgEscalationAPI.get();
      setSettings(data);
      setDraft(editableOf(data));
      setLoadError(null);
    } catch (error) {
      setLoadError(errorSummary(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    reportsAPI
      .getAllReports({ page_size: 25 })
      .then((data) => setReports(normalizeListResponse(data).items))
      .catch(() => setReports([]));
  }, [load]);

  const levelName = useCallback(
    (code) => levels.find((level) => level.code === code)?.title || code || '—',
    [levels],
  );

  const dirty = useMemo(
    () => Boolean(settings && draft) && JSON.stringify(editableOf(settings)) !== JSON.stringify(draft),
    [settings, draft],
  );

  // Two rules can't match the same answer; the server refuses it too.
  const duplicateValues = useMemo(() => {
    const seen = new Map();
    (draft?.rules || []).forEach((rule) => {
      const key = rule.when_value.trim().toLowerCase();
      if (key) seen.set(key, (seen.get(key) || 0) + 1);
    });
    return new Set([...seen].filter(([, count]) => count > 1).map(([key]) => key));
  }, [draft]);

  const ruleProblem = (rule) => {
    if (!rule.when_value.trim()) return 'Enter the answer this rule matches.';
    if (duplicateValues.has(rule.when_value.trim().toLowerCase())) return 'Another rule matches the same answer.';
    if ((rule.target === 'level' || rule.target === 'role') && !rule.target_ref)
      return `Choose a ${rule.target === 'level' ? 'level' : 'role'}.`;
    return null;
  };
  const blocked = Boolean(draft) && (!draft.trigger_field.trim() || draft.rules.some(ruleProblem));

  const setField = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  const setRule = (index, changes) =>
    setDraft((prev) => ({ ...prev, rules: prev.rules.map((rule, i) => (i === index ? { ...rule, ...changes } : rule)) }));

  const save = async () => {
    if (!dirty || blocked) return;
    setSaving(true);
    setSaveError(null);
    try {
      await orgEscalationAPI.update({
        ...draft,
        trigger_field: draft.trigger_field.trim(),
        rules: draft.rules.map((rule) => ({
          ...rule,
          when_value: rule.when_value.trim(),
          target_ref: rule.target === 'level' || rule.target === 'role' ? rule.target_ref : null,
        })),
      });
      await load();
      setPreview(null);
      toast.success('Escalation rules saved.');
    } catch (error) {
      setSaveError(describeError(error));
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!previewId) return;
    setPreviewing(true);
    setPreview(null);
    setPreviewError(null);
    try {
      setPreview(await orgEscalationAPI.preview(previewId));
    } catch (error) {
      setPreviewError(errorSummary(error));
    } finally {
      setPreviewing(false);
    }
  };

  if (loading && !settings) return <EscalationSkeleton />;
  if (loadError && !settings) {
    return (
      <Alert variant="error" title="Couldn't load the escalation rules">
        {loadError}{' '}
        <button type="button" onClick={load} className="font-medium text-link hover:underline">
          Try again
        </button>
      </Alert>
    );
  }

  const readOnly = !canManage;
  const availableLevels = settings.available_levels || [];
  const availableRoles = (settings.available_roles || []).filter((code) => code !== REPORTER_ROLE);

  return (
    <div className="space-y-5 pb-20">
      {(settings.problems || []).length > 0 && (
        <Alert variant="warning" title="These rules can't do everything they say yet">
          <ul className="space-y-1.5">
            {settings.problems.map((problem, index) => (
              <li key={`${problem.code}-${index}`} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span>{problem.message}</span>
                {problem.code === 'empty_directory' && onGoTo && (
                  <button type="button" onClick={() => onGoTo('directory')} className="shrink-0 text-sm font-semibold underline">
                    Open the directory
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <Card>
        <Card.Content className="space-y-5">
          <div className="flex items-start gap-4">
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning-fg sm:flex">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-ink">Conflict-of-interest routing</p>
              <p className="mt-0.5 text-sm text-ink-muted">
                When a report implicates someone senior, it goes around them instead of to them.
                {settings.directory_size != null && ` ${settings.directory_size} people in the directory.`}
              </p>
            </div>
            <Toggle
              checked={draft.enabled}
              onChange={(value) => setField('enabled', value)}
              disabled={readOnly}
              label="Apply escalation rules"
            />
          </div>
          {!draft.enabled && (
            <p className="rounded-lg bg-subtle px-3 py-2 text-sm text-ink-muted">
              Off — the rules below are kept but not applied. Switching back on needs nothing re-entered.
            </p>
          )}

          <div className="grid gap-4 border-t border-line-subtle pt-5 sm:grid-cols-2">
            <div>
              <label htmlFor="esc-trigger" className="mb-1 block text-xs font-medium text-ink-secondary">
                Trigger question
              </label>
              <input
                id="esc-trigger"
                value={draft.trigger_field}
                onChange={(event) => setField('trigger_field', event.target.value)}
                disabled={readOnly}
                className={`${fieldClass} font-mono`}
              />
              <p className="mt-1 text-[11px] text-ink-subtle">
                The question whose answer says who is implicated — what the reporter <em>said</em>.
              </p>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-ink">Also match people named in the report</span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Catches “my manager Ahmed told me to approve it” even when the reporter didn't answer the question —
                  who they <em>named</em>.
                </span>
              </span>
              <Toggle
                checked={draft.match_named_people}
                onChange={(value) => setField('match_named_people', value)}
                disabled={readOnly}
                label="Match people named in the report"
              />
            </div>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="flex items-baseline justify-between gap-3">
          <div>
            <Card.Title>Rules</Card.Title>
            <Card.Description>One per answer to the trigger question.</Card.Description>
          </div>
          {!readOnly && (
            <Button
              variant="outline"
              size="small"
              startIcon={Plus}
              onClick={() => setField('rules', [...draft.rules, blankRule()])}
            >
              Add rule
            </Button>
          )}
        </Card.Header>
        <Card.Content className="space-y-3">
          {draft.rules.length === 0 && <p className="text-sm text-ink-muted">No rules — no report is rerouted.</p>}
          {draft.rules.map((rule, index) => {
            const problem = ruleProblem(rule);
            const target = TARGETS.find((t) => t.value === rule.target);
            return (
              <div key={index} className={`rounded-xl border p-4 ${problem ? 'border-warning-line' : 'border-line'}`}>
                <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.4fr)]">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-secondary" htmlFor={`rule-${index}-when`}>
                      When the answer is
                    </label>
                    <input
                      id={`rule-${index}-when`}
                      value={rule.when_value}
                      onChange={(event) => setRule(index, { when_value: event.target.value })}
                      disabled={readOnly}
                      placeholder="e.g. executive"
                      className={`${fieldClass} font-mono`}
                    />
                  </div>
                  <ArrowRight className="mt-8 hidden h-4 w-4 text-ink-subtle lg:block" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-secondary" htmlFor={`rule-${index}-target`}>
                        Send it to
                      </label>
                      <select
                        id={`rule-${index}-target`}
                        value={rule.target}
                        onChange={(event) => setRule(index, { target: event.target.value, target_ref: null })}
                        disabled={readOnly}
                        className={fieldClass}
                      >
                        {TARGETS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-ink-subtle">{target?.hint}</p>
                    </div>
                    {rule.target === 'level' && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-ink-secondary" htmlFor={`rule-${index}-ref`}>
                          Level
                        </label>
                        <select
                          id={`rule-${index}-ref`}
                          value={rule.target_ref || ''}
                          onChange={(event) => setRule(index, { target_ref: event.target.value || null })}
                          disabled={readOnly}
                          className={fieldClass}
                        >
                          <option value="">Choose a level…</option>
                          {availableLevels.map((code) => (
                            <option key={code} value={code}>
                              {levelName(code)}
                            </option>
                          ))}
                          {rule.target_ref && !availableLevels.includes(rule.target_ref) && (
                            <option value={rule.target_ref}>{rule.target_ref} (deleted)</option>
                          )}
                        </select>
                        {availableLevels.length === 0 && (
                          <p className="mt-1 text-[11px] text-warning-fg">No levels yet — add them on the Levels tab.</p>
                        )}
                      </div>
                    )}
                    {rule.target === 'role' && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-ink-secondary" htmlFor={`rule-${index}-ref`}>
                          Role
                        </label>
                        <select
                          id={`rule-${index}-ref`}
                          value={rule.target_ref || ''}
                          onChange={(event) => setRule(index, { target_ref: event.target.value || null })}
                          disabled={readOnly}
                          className={fieldClass}
                        >
                          <option value="">Choose a role…</option>
                          {availableRoles.map((code) => (
                            <option key={code} value={code}>
                              {nameFor(code)}
                            </option>
                          ))}
                          {rule.target_ref && !availableRoles.includes(rule.target_ref) && (
                            <option value={rule.target_ref}>{nameFor(rule.target_ref)} (deleted)</option>
                          )}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-3 border-t border-line-subtle pt-3 sm:flex-row sm:items-center">
                  <label className="flex items-start gap-2 text-sm text-ink sm:flex-1">
                    <input
                      type="checkbox"
                      checked={rule.lock_out_implicated}
                      onChange={(event) => setRule(index, { lock_out_implicated: event.target.checked })}
                      disabled={readOnly}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Lock className="h-3.5 w-3.5" /> Lock out the implicated person
                      </span>
                      <span className="block text-xs text-ink-muted">
                        The case disappears for them entirely — list, search and direct link — even if they're an admin.
                      </span>
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`rule-${index}-tier`} className="shrink-0 text-xs font-medium text-ink-secondary">
                      Raise to at least
                    </label>
                    <select
                      id={`rule-${index}-tier`}
                      value={rule.raise_tier_to || ''}
                      onChange={(event) => setRule(index, { raise_tier_to: event.target.value || null })}
                      disabled={readOnly}
                      className={`${fieldClass} w-auto`}
                    >
                      <option value="">Don't change</option>
                      {TIERS.map((tier) => (
                        <option key={tier.value} value={tier.value}>
                          {tier.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => setField('rules', draft.rules.filter((_, i) => i !== index))}
                      aria-label="Remove this rule"
                      className="self-end rounded-lg p-2 text-ink-subtle transition-colors hover:bg-danger-soft hover:text-danger-fg sm:self-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {problem && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-fg">
                    <AlertTriangle className="h-3.5 w-3.5" /> {problem}
                  </p>
                )}
              </div>
            );
          })}
          <p className="text-xs text-ink-subtle">
            A tier set here is a minimum: applying a rule can raise a case's confidentiality, never lower it.
          </p>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>Try it on a report</Card.Title>
          <Card.Description>
            Runs the saved rules against a real report and shows what would happen. Nothing on the report changes.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={previewId}
              onChange={(event) => setPreviewId(event.target.value)}
              aria-label="Report to preview"
              className={`${fieldClass} sm:flex-1`}
            >
              <option value="">{reports.length ? 'Choose a recent report…' : 'No reports to try'}</option>
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.report_number}
                  {getReportTitle(report) ? ` — ${getReportTitle(report)}` : ''}
                </option>
              ))}
            </select>
            <Button startIcon={Play} onClick={runPreview} isLoading={previewing} disabled={!previewId || dirty}>
              Preview
            </Button>
          </div>
          {dirty && <p className="text-xs text-ink-muted">Save your changes first — the preview uses the saved rules.</p>}
          {previewError && <p className="text-sm text-danger-fg">{previewError}</p>}
          {preview && <PreviewResult result={preview} levelName={levelName} nameFor={nameFor} />}
        </Card.Content>
      </Card>

      {canManage && dirty && (
        <div className="sticky bottom-4 z-20 space-y-2">
          {saveError && (
            <Alert variant="error" title={saveError.summary}>
              {saveError.problems.length > 0 && (
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
              {blocked ? 'Fix the highlighted rules before saving.' : 'Unsaved changes to the escalation rules.'}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft(editableOf(settings));
                  setSaveError(null);
                }}
                disabled={saving}
                className="h-9 rounded-lg border border-canvas/25 px-3.5 text-sm font-medium transition-colors hover:bg-canvas/10 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || blocked}
                className="h-9 rounded-lg bg-canvas px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save rules'}
              </button>
            </div>
          </div>
        </div>
      )}
      {!canManage && (
        <p className="text-xs text-ink-subtle">
          <Badge size="small">View only</Badge> Changing these rules needs permission to manage the hierarchy.
        </p>
      )}
    </div>
  );
};

export default EscalationPanel;
