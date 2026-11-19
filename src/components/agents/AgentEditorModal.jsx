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
import { Trans, useTranslation } from 'react-i18next';
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
import { ACCESS, permissionLabel, togglePermissionIn } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { codeHint, CODE_PATTERN, suggestCode } from '../../utils/codes';
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


// Sensitive answers are masked for every AI agent, whatever its permissions.
const agentPermissionHints = (t) => ({
  'report:read_sensitive': t('editor.sensitiveHint'),
});

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
    className={`rounded-xl border p-3 text-start transition-colors disabled:cursor-not-allowed ${
      selected ? 'border-line-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
    } ${disabled && !selected ? 'opacity-50' : ''}`}
  >
    <span className="block text-sm font-semibold text-ink">{title}</span>
    {description && <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>}
  </button>
);

/** Verdict slugs as removable chips, added by typing and pressing Enter. */
const DecisionsInput = ({ value, onChange, readOnly }) => {
  const { t } = useTranslation('agents');
  const [draft, setDraft] = useState('');

  const add = (raw) => {
    const slug = suggestCode(raw, 'd');
    if (slug && !value.includes(slug)) onChange([...value, slug]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 && <span className="text-xs text-ink-subtle">{t('editor.decisions.none')}</span>}
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
                aria-label={t('editor.decisions.remove', { name: decision })}
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
              placeholder={t('editor.decisions.placeholder')}
              aria-label={t('editor.decisions.add')}
              dir="ltr"
              className={`${selectClass} font-mono`}
            />
            <Button variant="secondary" onClick={() => add(draft)} disabled={!draft.trim()}>
              {t('editor.decisions.addButton')}
            </Button>
          </div>
          {value.length === 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
              {t('editor.decisions.common')}
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
  const { t } = useTranslation('agents');
  const can = useCan();
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const { roles, byCode, nameFor } = useOrgRoles({ source: 'owners' });

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
    if (!code) return t('editor.codeRequired');
    if (!CODE_PATTERN.test(code)) return codeHint();
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
  const togglePermission = (permission) => setPermissions((prev) => togglePermissionIn(prev, permission));

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
      // The summarizer's state is the organization's summarizer switch
      // (PUT /org-agents/summarizer); sending is_active for it is a 400.
      ...(isSummarizer ? {} : { is_active: isActive }),
    };

    try {
      const saved = isCreate
        ? await orgAgentsAPI.create({ ...body, code, kind })
        : await orgAgentsAPI.update(agent.id, body);
      toast.success(isCreate ? t('editor.created', { name: body.name }) : t('editor.saved', { name: body.name }));
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
        {t('common:actions.close')}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        {t('common:actions.cancel')}
      </Button>
      <Button onClick={save} isLoading={saving} disabled={blocked}>
        {isCreate ? t('editor.create') : t('editor.saveChanges')}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={isCreate ? t('editor.newTitle') : readOnly ? agent.name : t('editor.editTitle', { name: agent.name })}
      size="xl"
      footer={footer}
      closeOnOverlayClick={false}
    >
      <div className="space-y-7">
        {saveError && (
          <Alert variant="error" title={saveError.summary}>
            {saveError.problems.length > 0 && (
              <ul className="list-disc space-y-1 ps-4">
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
            label={t('editor.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            readOnly={readOnly}
            placeholder={t('editor.namePlaceholder')}
          />
          <Input
            label={t('editor.code')}
            value={code}
            onChange={(event) => {
              setCodeTouched(true);
              setCode(event.target.value);
            }}
            readOnly={!isCreate || readOnly}
            required={isCreate}
            error={codeError}
            className="font-mono"
            dir="ltr"
            helperText={isCreate ? t('editor.codeHintCreate') : t('editor.codeHintEdit')}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('editor.description')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              readOnly={readOnly}
              placeholder={t('editor.descriptionPlaceholder')}
            />
          </div>
        </div>

        {/* Kind */}
        <Section
          title={t('editor.kind')}
          hint={isCreate ? t('editor.kindHintCreate') : t('editor.kindHintEdit')}
        >
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('editor.kind')}>
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
          <Section title={t('editor.permissions')} hint={t('editor.permissionsSummarizerHint')}>
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
          title={t('editor.permissions')}
          hint={t('editor.permissionsHint')}
        >
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('editor.permissionSource')}>
            <ChoiceCard
              selected={roleSource === ORG_ROLE}
              disabled={readOnly}
              onSelect={() => setRoleSource(ORG_ROLE)}
              title={t('editor.useRole')}
              description={t('editor.useRoleHint')}
            />
            <ChoiceCard
              selected={roleSource === CUSTOM}
              disabled={readOnly}
              onSelect={() => setRoleSource(CUSTOM)}
              title={t('editor.custom')}
              description={t('editor.customHint')}
            />
          </div>

          {roleSource === ORG_ROLE && (
            <div className="space-y-1.5">
              <label htmlFor="agent-role" className="text-xs font-medium text-ink-secondary">
                {t('editor.role')}
              </label>
              <select
                id="agent-role"
                value={roleCode}
                onChange={(event) => setRoleCode(event.target.value)}
                disabled={readOnly}
                className={selectClass}
              >
                <option value="">{t('editor.chooseRole')}</option>
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
                {roleCode && !byCode.has(roleCode) && <option value={roleCode}>{t('editor.roleNotFound', { name: nameFor(roleCode) })}</option>}
              </select>
              {selectedRole && (
                <p className="text-xs text-ink-muted">
                  {/* Only an admin's role list carries permissions. */}
                  {Array.isArray(selectedRole.permissions) && t('editor.permissionCount', { count: selectedRole.permissions.length })}
                  {roleLink && (
                    <>
                      {' '}
                      <Link to={roleLink} className="text-link hover:underline">
                        {t('editor.reviewRoles')}
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
              hints={agentPermissionHints(t)}
              readOnly={readOnly}
            />
          )}
        </Section>
        )}

        {/* Capabilities */}
        <Section
          title={t('editor.capabilities')}
          hint={isSummarizer ? t('editor.capabilitiesSummarizerHint') : t('editor.capabilitiesHint')}
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
                  title={forbiddenReason ? t('editor.notForSummarizerTitle', { reason: forbiddenReason }) : undefined}
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
                      <p className="mt-0.5 text-[11px] text-ink-subtle">{t('editor.needs', { permission: permissionLabel(requires) })}</p>

                      {forbiddenReason && (
                        <p className="mt-1.5 text-xs text-ink-muted">{t('editor.notForSummarizer', { reason: forbiddenReason })}</p>
                      )}

                      {checked && !works && !forbiddenReason && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-xs text-warning-fg">
                          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                          <span>
                            {roleSource === ORG_ROLE ? (
                              roleCode ? (
                                <Trans
                                  t={t}
                                  i18nKey="editor.wontWorkRole"
                                  values={{ permission: permissionLabel(requires), role: nameFor(roleCode) }}
                                  components={{
                                    role: roleLink ? (
                                      <Link to={roleLink} className="font-medium underline" />
                                    ) : (
                                      <span className="font-medium" />
                                    ),
                                  }}
                                />
                              ) : (
                                t('editor.chooseRoleToCheck')
                              )
                            ) : (
                              <>
                                {t('editor.wontWorkCustom', { permission: permissionLabel(requires) })}
                                {!readOnly && permissionEntries.get(requires)?.granted && (
                                  <button
                                    type="button"
                                    onClick={() => setPermissions((prev) => new Set(prev).add(requires))}
                                    className="ms-1.5 font-medium underline"
                                  >
                                    {t('editor.addIt')}
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
            title={t('editor.decisionsTitle')}
            hint={t('editor.decisionsHint')}
          >
            <DecisionsInput value={decisions} onChange={setDecisions} readOnly={readOnly} />
            {decisions.length === 0 && (
              <p className="flex items-start gap-1.5 text-xs text-warning-fg">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                {t('editor.noDecisionsWarning')}
              </p>
            )}
          </Section>
        )}

        <Section title={t('editor.instructions')} hint={t('editor.instructionsHint')}>
          <Textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            readOnly={readOnly}
            rows={6}
            placeholder={isSummarizer ? t('editor.instructionsSummarizerPlaceholder') : t('editor.instructionsPlaceholder')}
            aria-label={t('editor.instructions')}
            dir="auto"
          />
        </Section>

        {!isCreate && isSummarizer && (
          <p className="rounded-lg bg-subtle px-3 py-2.5 text-xs text-ink-muted">
            <Trans
              t={t}
              i18nKey={agent?.is_active === false ? 'editor.summarizerSwitchOff' : 'editor.summarizerSwitchOn'}
              components={{ b: <span className="font-semibold text-ink" /> }}
            />
          </p>
        )}

        {!isCreate && !isSummarizer && (
          <label className="flex items-start gap-3">
            <Checkbox
              checked={isActive}
              disabled={readOnly}
              onChange={() => setIsActive((value) => !value)}
              labelledBy="agent-active-label"
            />
            <span>
              <span id="agent-active-label" className="block text-sm font-medium text-ink">
                {t('editor.active')}
              </span>
              <span className="block text-xs text-ink-muted">{t('editor.activeHint')}</span>
            </span>
          </label>
        )}

        {/* Advanced */}
        <div className="rounded-xl border border-line">
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            aria-expanded={showAdvanced}
            className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-start text-sm font-semibold text-ink hover:bg-hover"
          >
            {t('editor.advanced')}
            <ChevronDown className={`h-4 w-4 text-ink-subtle transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          {showAdvanced && (
            <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
              <Input
                label={t('editor.model')}
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                readOnly={readOnly}
                helperText={t('editor.serviceDefault')}
                className="font-mono"
                dir="ltr"
              />
              <Input
                label={t('editor.temperature')}
                type="number"
                step="0.1"
                min="0"
                value={temperature}
                onChange={(event) => setTemperature(event.target.value)}
                readOnly={readOnly}
                helperText={t('editor.serviceDefault')}
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AgentEditorModal;
