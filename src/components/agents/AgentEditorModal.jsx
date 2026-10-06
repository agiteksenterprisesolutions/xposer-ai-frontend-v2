// src/components/agents/AgentEditorModal.jsx
//
// Create, edit or view one of the organization's AI agents.
//
// Everything choosable comes from GET /org-agents/capabilities — kinds, role
// sources, capabilities and the summarizer's forbidden set — never from a
// hardcoded list. The form previews what each ticked capability will really
// do: a capability only works when the agent's permissions carry the one it
// requires, and an admin who can't see that cannot tell why their agent is
// silent. The server re-resolves this on every read, so the saved agent's
// `disabled_capabilities` is the final word.
//
// The summarizer is different: one per organization (a second is a 409), with
// fixed permissions (role_source "intrinsic", role_code null) and only three
// allowed capabilities. So it has no permissions section, and the kind is only
// offered when the organization has no summarizer.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Plus, X } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input, { Textarea } from '../ui/Input';
import Alert from '../ui/Alert';
import PermissionPicker, { Checkbox, catalogEntries, localPrerequisiteErrors } from '../roles/PermissionPicker';
import { orgAgentsAPI } from '../../api/orgAgents';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useCan } from '../../hooks/useCan';
import { useAuthStore } from '../../store/authStore';
import { ACCESS, permissionLabel } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { CODE_HINT, CODE_PATTERN, suggestCode } from '../../utils/codes';
import { describeError } from '../../utils/errors';
import {
  AGENT_KIND_INFO,
  CAPABILITY_INFO,
  SUGGESTED_DECISIONS,
  SUMMARIZER_CAPABILITIES,
  SUMMARIZER_KIND,
  SUMMARIZER_PERMISSIONS,
  capabilityLabel,
} from '../../utils/agents';

const SUMMARIZER = SUMMARIZER_KIND;
const ORG_ROLE = 'org_role';
const CUSTOM = 'custom';

const selectClass =
  'w-full rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink hover:border-line-strong disabled:opacity-60';

const Section = ({ title, hint, children }) => (
  <section className="space-y-3">
    <div>
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
    </div>
    {children}
  </section>
);

const ChoiceCard = ({ selected, disabled, onSelect, title, description }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    disabled={disabled}
    onClick={onSelect}
    className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed ${
      selected ? 'border-line-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
    } ${disabled && !selected ? 'opacity-50' : ''}`}
  >
    <span className="block text-sm font-semibold text-ink">{title}</span>
    {description && <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>}
  </button>
);

/** Verdict slugs as removable chips, added by typing and pressing Enter. */
const DecisionsInput = ({ value, onChange, readOnly }) => {
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const slug = suggestCode(raw, 'd');
    if (slug && !value.includes(slug)) onChange([...value, slug]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-xs text-ink-subtle">No decisions yet.</span>}
        {value.map((decision) => (
          <span
            key={decision}
            className="inline-flex items-center gap-1 rounded-full border border-line-accent bg-accent-soft px-2.5 py-0.5 font-mono text-xs text-accent-fg"
          >
            {decision}
            {!readOnly && (
              <button
                type="button"
                onClick={() => onChange(value.filter((d) => d !== decision))}
                aria-label={`Remove ${decision}`}
                className="rounded-full hover:text-ink"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!readOnly && (
        <>
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault();
                  add(draft);
                }
              }}
              placeholder="e.g. escalate"
              aria-label="Add a decision"
              className={`${selectClass} font-mono`}
            />
            <Button variant="secondary" onClick={() => add(draft)} disabled={!draft.trim()}>
              Add
            </Button>
          </div>
          {value.length === 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
              Common:
              {SUGGESTED_DECISIONS.map((decision) => (
                <button
                  key={decision}
                  type="button"
                  onClick={() => add(decision)}
                  className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 font-mono hover:border-line-accent hover:text-accent-fg"
                >
                  <Plus className="h-3 w-3" />
                  {decision}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/**
 * Props:
 *   agent             – the agent to edit or view; omit to create one
 *   capabilityCatalog – GET /org-agents/capabilities
 *   permissionCatalog – GET /org-roles/permissions (for custom permissions)
 *   initialKind       – preselect a kind when creating (e.g. from "Recreate the summarizer")
 *   canCreateSummarizer – offer the summarizer kind; only when the org has none
 *   readOnly
 *   onClose, onSaved(agent)
 */
const AgentEditorModal = ({
  agent = null,
  capabilityCatalog,
  permissionCatalog,
  initialKind = null,
  canCreateSummarizer = false,
  readOnly = false,
  onClose,
  onSaved,
}) => {
  const isCreate = !agent;
  const can = useCan();
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const { roles, byCode, nameFor } = useOrgRoles();

  const [name, setName] = useState(agent?.name || '');
  const [code, setCode] = useState(agent?.code || '');
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState(agent?.description || '');
  // Kinds offered when creating. The summarizer only when there isn't one.
  const creatableKinds = (capabilityCatalog?.kinds || ['analyst', SUMMARIZER]).filter(
    (k) => k !== SUMMARIZER || canCreateSummarizer,
  );
  const [kind, setKind] = useState(
    agent?.kind || (creatableKinds.includes(initialKind) ? initialKind : null) || creatableKinds[0] || 'analyst',
  );
  const [roleSource, setRoleSource] = useState(agent?.role_source || ORG_ROLE);
  const [roleCode, setRoleCode] = useState(agent?.role_code || '');
  const [permissions, setPermissions] = useState(() => new Set(agent?.permissions || []));
  const [capabilities, setCapabilities] = useState(() => new Set(agent?.capabilities || []));
  const [decisions, setDecisions] = useState(agent?.decisions || []);
  const [instructions, setInstructions] = useState(agent?.instructions || '');
  const [modelName, setModelName] = useState(agent?.model_name || '');
  const [temperature, setTemperature] = useState(agent?.temperature ?? '');
  const [isActive, setIsActive] = useState(agent?.is_active ?? true);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(agent?.model_name || agent?.temperature != null));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (isCreate && !codeTouched) setCode(suggestCode(name, 'agent'));
  }, [name, isCreate, codeTouched]);

  const isSummarizer = kind === SUMMARIZER;
  const forbidden = useMemo(
    () => new Map((capabilityCatalog?.summarizer_forbidden_capabilities || []).map((f) => [f.capability, f.reason])),
    [capabilityCatalog],
  );

  // A summarizer can't carry the forbidden capabilities or any decisions; drop
  // them as soon as the kind says so, rather than letting the save 400.
  useEffect(() => {
    if (!isSummarizer) return;
    setCapabilities((prev) => new Set([...prev].filter((c) => !forbidden.has(c))));
  }, [isSummarizer, forbidden]);

  const selectedRole = roleSource === ORG_ROLE ? byCode.get(roleCode) : null;
  // The permissions the agent will act with: its role's, its own list, or —
  // for a summarizer — the fixed set.
  const actingPermissions = useMemo(() => {
    if (isSummarizer) return new Set(SUMMARIZER_PERMISSIONS);
    return roleSource === ORG_ROLE ? new Set(selectedRole?.permissions || []) : permissions;
  }, [isSummarizer, roleSource, selectedRole, permissions]);

  // A summarizer is offered only its three capabilities, not the refused rest.
  const capabilityEntries = (capabilityCatalog?.capabilities || []).filter(
    ({ capability }) => !isSummarizer || SUMMARIZER_CAPABILITIES.includes(capability),
  );

  const permissionEntries = useMemo(() => catalogEntries(permissionCatalog), [permissionCatalog]);
  const permissionErrors = useMemo(
    () =>
      !isSummarizer && roleSource === CUSTOM ? localPrerequisiteErrors(permissions, permissionEntries) : new Map(),
    [isSummarizer, roleSource, permissions, permissionEntries],
  );

  const codeError = (() => {
    if (!isCreate) return null;
    if (!code) return 'A code is required.';
    if (!CODE_PATTERN.test(code)) return CODE_HINT;
    return null;
  })();

  const blocked =
    !name.trim() ||
    Boolean(codeError) ||
    (!isSummarizer && roleSource === ORG_ROLE && !roleCode) ||
    permissionErrors.size > 0;

  const toggleIn = (setter) => (value) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  const toggleCapability = toggleIn(setCapabilities);
  const togglePermission = toggleIn(setPermissions);

  const save = async () => {
    if (blocked || saving) return;
    setSaving(true);
    setSaveError(null);

    const body = {
      name: name.trim(),
      description: description.trim() || null,
      // A summarizer's permissions are intrinsic; it takes no role fields.
      ...(isSummarizer
        ? {}
        : {
            role_source: roleSource,
            role_code: roleSource === ORG_ROLE ? roleCode : null,
            permissions: roleSource === CUSTOM ? [...permissions] : [],
          }),
      capabilities: [...capabilities].filter((c) => !isSummarizer || SUMMARIZER_CAPABILITIES.includes(c)),
      // A summarizer reaches no verdict; declaring any is refused.
      decisions: isSummarizer ? [] : decisions,
      instructions: instructions.trim() || null,
      model_name: modelName.trim() || null,
      temperature: temperature === '' || temperature === null ? null : Number(temperature),
      is_active: isActive,
    };

    try {
      const saved = isCreate
        ? await orgAgentsAPI.create({ ...body, code, kind })
        : await orgAgentsAPI.update(agent.id, body);
      toast.success(isCreate ? `Agent "${body.name}" created.` : `Agent "${body.name}" saved.`);
      onSaved?.(saved);
    } catch (error) {
      setSaveError(describeError(error));
    } finally {
      setSaving(false);
    }
  };

  const roleLink = can(ACCESS.roles) ? staffPath(orgSlug, 'roles') : null;

  const footer = readOnly ? (
    <div className="flex justify-end">
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </div>
  ) : (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={save} isLoading={saving} disabled={blocked}>
        {isCreate ? 'Create agent' : 'Save changes'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={isCreate ? 'New agent' : readOnly ? agent.name : `Edit ${agent.name}`}
      size="xl"
      footer={footer}
      closeOnOverlayClick={false}
    >
      <div className="space-y-7">
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

        {/* Identity */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            readOnly={readOnly}
            placeholder="e.g. Finance triage"
          />
          <Input
            label="Code"
            value={code}
            onChange={(event) => {
              setCodeTouched(true);
              setCode(event.target.value);
            }}
            readOnly={!isCreate || readOnly}
            required={isCreate}
            error={codeError}
            className="font-mono"
            helperText={
              isCreate
                ? 'Workflow stages refer to the agent by this. It cannot be changed later.'
                : 'Codes cannot change — workflow stages refer to the agent by it.'
            }
          />
          <div className="sm:col-span-2">
            <Input
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              readOnly={readOnly}
              placeholder="Optional — what this agent is for"
            />
          </div>
        </div>

        {/* Kind */}
        <Section
          title="Kind"
          hint={isCreate ? 'Fixed once the agent is created.' : 'The kind is fixed once an agent is created.'}
        >
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Kind">
            {(isCreate ? creatableKinds : [kind]).map((k) => (
              <ChoiceCard
                key={k}
                selected={kind === k}
                disabled={!isCreate || readOnly}
                onSelect={() => setKind(k)}
                title={AGENT_KIND_INFO[k]?.label || k}
                description={AGENT_KIND_INFO[k]?.description}
              />
            ))}
          </div>
        </Section>

        {/* Permissions — a summarizer's are fixed */}
        {isSummarizer ? (
          <Section title="Permissions" hint="Fixed for the summarizer — it doesn't act as a role.">
            <div className="flex flex-wrap gap-1.5">
              {SUMMARIZER_PERMISSIONS.map((permission) => (
                <span
                  key={permission}
                  className="inline-flex items-center rounded-full border border-line bg-subtle px-2.5 py-1 text-xs font-medium text-ink-secondary"
                >
                  {permissionLabel(permission)}
                </span>
              ))}
            </div>
          </Section>
        ) : (
        <Section
          title="Permissions"
          hint="An agent acts with a set of permissions, exactly like a person. You can only give it permissions you hold yourself."
        >
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Where its permissions come from">
            <ChoiceCard
              selected={roleSource === ORG_ROLE}
              disabled={readOnly}
              onSelect={() => setRoleSource(ORG_ROLE)}
              title="Use one of your roles"
              description="The agent acts with that role's permissions and follows any change to it."
            />
            <ChoiceCard
              selected={roleSource === CUSTOM}
              disabled={readOnly}
              onSelect={() => setRoleSource(CUSTOM)}
              title="Custom permissions"
              description="Choose a set just for this agent."
            />
          </div>

          {roleSource === ORG_ROLE && (
            <div className="space-y-1.5">
              <label htmlFor="agent-role" className="text-xs font-medium text-ink-secondary">
                Role
              </label>
              <select
                id="agent-role"
                value={roleCode}
                onChange={(event) => setRoleCode(event.target.value)}
                disabled={readOnly}
                className={selectClass}
              >
                <option value="">Choose a role…</option>
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
                {roleCode && !byCode.has(roleCode) && <option value={roleCode}>{nameFor(roleCode)} (not found)</option>}
              </select>
              {selectedRole && (
                <p className="text-xs text-ink-muted">
                  {selectedRole.permissions?.length || 0} permissions.
                  {roleLink && (
                    <>
                      {' '}
                      <Link to={roleLink} className="text-link hover:underline">
                        Review roles
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {roleSource === CUSTOM && permissionCatalog && (
            <PermissionPicker
              catalog={permissionCatalog}
              selected={permissions}
              onToggle={togglePermission}
              onAdd={(p) => setPermissions((prev) => new Set(prev).add(p))}
              errorsByPermission={permissionErrors}
              readOnly={readOnly}
            />
          )}
        </Section>
        )}

        {/* Capabilities */}
        <Section
          title="Capabilities"
          hint={
            isSummarizer
              ? 'A summarizer can only do these three. It never messages the reporter, changes a report or routes it.'
              : 'What the agent may do on a report. Each one only works while its permissions include the one it needs.'
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {capabilityEntries.map(({ capability, requires }) => {
              const checked = capabilities.has(capability);
              const forbiddenReason = isSummarizer ? forbidden.get(capability) : null;
              const works = !requires || actingPermissions.has(requires);
              const id = `cap-${capability}`;
              return (
                <div
                  key={capability}
                  className={`rounded-lg border px-3 py-2.5 ${
                    checked && !works ? 'border-warning-line bg-warning-soft' : checked ? 'border-line-accent bg-accent-soft' : 'border-line bg-surface'
                  } ${forbiddenReason ? 'opacity-60' : ''}`}
                  title={forbiddenReason ? `Not for a summarizer: ${forbiddenReason}` : undefined}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={checked}
                      disabled={readOnly || Boolean(forbiddenReason)}
                      onChange={() => toggleCapability(capability)}
                      labelledBy={id}
                    />
                    <div className="min-w-0 flex-1">
                      <p id={id} className="text-sm font-medium text-ink">
                        {capabilityLabel(capability)}
                      </p>
                      {CAPABILITY_INFO[capability]?.description && (
                        <p className="text-xs text-ink-muted">{CAPABILITY_INFO[capability].description}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-ink-subtle">Needs “{permissionLabel(requires)}”</p>

                      {forbiddenReason && (
                        <p className="mt-1.5 text-xs text-ink-muted">Not for a summarizer — {forbiddenReason}.</p>
                      )}

                      {checked && !works && !forbiddenReason && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-warning-fg">
                          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                          <span>
                            {roleSource === ORG_ROLE ? (
                              roleCode ? (
                                <>
                                  Won't work yet: needs “{permissionLabel(requires)}” on the{' '}
                                  {roleLink ? (
                                    <Link to={roleLink} className="font-medium underline">
                                      {nameFor(roleCode)}
                                    </Link>
                                  ) : (
                                    <span className="font-medium">{nameFor(roleCode)}</span>
                                  )}{' '}
                                  role.
                                </>
                              ) : (
                                'Choose a role to see whether this will work.'
                              )
                            ) : (
                              <>
                                Won't work yet: add “{permissionLabel(requires)}” to this agent's
                                permissions.
                                {!readOnly && permissionEntries.get(requires)?.granted && (
                                  <button
                                    type="button"
                                    onClick={() => setPermissions((prev) => new Set(prev).add(requires))}
                                    className="ml-1.5 font-medium underline"
                                  >
                                    Add it
                                  </button>
                                )}
                              </>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Decisions — an analyst's closed set of verdicts; a summarizer has none */}
        {!isSummarizer && (
          <Section
            title="Decisions"
            hint="The verdicts this agent may return. Workflow stages branch on them, so keep them short and stable."
          >
            <DecisionsInput value={decisions} onChange={setDecisions} readOnly={readOnly} />
            {decisions.length === 0 && (
              <p className="flex items-start gap-1.5 text-xs text-warning-fg">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                With no decisions, a workflow can't branch on this agent — every run just moves on to the next step.
              </p>
            )}
          </Section>
        )}

        <Section title="Instructions" hint="The organization's own guidance for this agent, in English.">
          <Textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            readOnly={readOnly}
            rows={6}
            placeholder={
              isSummarizer
                ? 'e.g. Lead with any amounts, dates and people named in the evidence.'
                : 'e.g. Prioritise anything implicating a budget holder.'
            }
            aria-label="Instructions"
          />
        </Section>

        {!isCreate && (
          <label className="flex items-start gap-3">
            <Checkbox
              checked={isActive}
              disabled={readOnly}
              onChange={() => setIsActive((value) => !value)}
              labelledBy="agent-active-label"
            />
            <span>
              <span id="agent-active-label" className="block text-sm font-medium text-ink">
                Active
              </span>
              <span className="block text-xs text-ink-muted">An inactive agent is skipped by every workflow.</span>
            </span>
          </label>
        )}

        {/* Advanced */}
        <div className="rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            aria-expanded={showAdvanced}
            className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-hover"
          >
            Advanced
            <ChevronDown className={`h-4 w-4 text-ink-subtle transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          {showAdvanced && (
            <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
              <Input
                label="Model"
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                readOnly={readOnly}
                helperText="Leave empty to use the service default."
                className="font-mono"
              />
              <Input
                label="Temperature"
                type="number"
                step="0.1"
                min="0"
                value={temperature}
                onChange={(event) => setTemperature(event.target.value)}
                readOnly={readOnly}
                helperText="Leave empty to use the service default."
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AgentEditorModal;
