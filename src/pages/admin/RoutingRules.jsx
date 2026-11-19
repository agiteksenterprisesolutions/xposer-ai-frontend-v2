// src/pages/admin/RoutingRules.jsx
//
// Routing rules (XPAI-106; ROUTING_RULES.md §8). Where a case goes and which
// flags it carries, set by the organization's admin (routing:manage).
//
// The list is in run order: active rules are checked by priority, lower
// first. The first matching rule with an owner role overrides the report
// type's owner; flags add up; the tier only goes up. The conflict-of-interest
// policy always wins. Reordering (drag, or the move buttons for keyboard
// users) sends every rule once to PUT /routing-rules/order, which renumbers
// them 10, 20, 30….
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Route, Trash2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import Skeleton from '../../components/ui/Skeleton';
import { ConfirmationModal } from '../../components/ui/Modal';
import FlagBadge from '../../components/reports/FlagBadge';
import RuleEditor, { ProblemList } from '../../components/routing/RuleEditor';
import RoutingPreview from '../../components/routing/RoutingPreview';
import { caseRoles, errorsOf, warningsOf } from '../../components/routing/ruleUtils';
import { routingRulesAPI } from '../../api/routingRules';
import { reportTypesAPI } from '../../api/reportTypes';
import { entitiesAPI } from '../../api/entities';
import { localized } from '../../api/jurisdiction';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useOrgJurisdiction } from '../../hooks/useOrgJurisdiction';
import { CONFIDENTIALITY_TIERS } from '../../utils/reportTypes';
import { describeError, errorSummary } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';

const itemsOf = (data) => (Array.isArray(data) ? data : data?.items || []);

/** The rule's conditions in short: "FRD-CLM*", categories, codes, entities, answers. */
const ConditionSummary = ({ match = {}, entityName }) => {
  const { t } = useTranslation('routing');
  const parts = [];
  (match.code_prefixes || []).forEach((p) => parts.push({ key: `p-${p}`, text: `${p}*`, mono: true }));
  (match.categories || []).forEach((c) => parts.push({ key: `c-${c}`, text: c }));
  (match.report_type_codes || []).forEach((c) => parts.push({ key: `t-${c}`, text: c, mono: true }));
  (match.entity_codes || []).forEach((e) => parts.push({ key: `e-${e}`, text: entityName(e) }));
  const answers = match.answers?.rules?.length || 0;
  if (answers) parts.push({ key: 'answers', text: t('list.answerConditions', { count: answers }) });
  if (!parts.length) return <span className="text-ink-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {parts.map((p) => (
        <span key={p.key} className={`rounded bg-subtle px-1.5 py-px text-xs text-ink-secondary ${p.mono ? 'font-mono' : ''}`} dir="auto">
          {p.text}
        </span>
      ))}
    </span>
  );
};

const RoutingRules = () => {
  const { t } = useTranslation('routing');
  useSEO({ title: t('page.title'), description: t('page.intro'), noIndex: true });
  const [rules, setRules] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [types, setTypes] = useState([]);
  const [entities, setEntities] = useState([]);
  const [editing, setEditing] = useState(null); // a rule, or 'new'
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [announce, setAnnounce] = useState('');
  const { allRoles, nameFor } = useOrgRoles();
  const { pack } = useOrgJurisdiction();

  const roles = useMemo(() => caseRoles(allRoles), [allRoles]);
  const triggers = useMemo(() => pack?.regulatory_triggers || [], [pack]);
  const triggerByCode = useMemo(() => new Map(triggers.map((tr) => [tr.code, tr])), [triggers]);
  const entityName = useCallback((code) => localized(entities.find((e) => e.code === code)?.name) || code, [entities]);

  const load = useCallback(() => {
    setLoadError(null);
    routingRulesAPI
      .list()
      .then((data) => setRules(itemsOf(data)))
      .catch((err) => setLoadError(errorSummary(err)));
  }, []);

  useEffect(() => {
    load();
    reportTypesAPI.getReportTypes(false, true).then(setTypes).catch(() => setTypes([]));
    entitiesAPI.list().then(setEntities).catch(() => setEntities([]));
  }, [load]);

  // ── Reorder ──────────────────────────────────────────────────────────────
  const reorder = async (from, to) => {
    if (!rules || from === to || to < 0 || to >= rules.length) return;
    const previous = rules;
    const next = [...rules];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setRules(next);
    setAnnounce(t('list.moved', { name: moved.name, position: to + 1, total: next.length }));
    try {
      const data = await routingRulesAPI.reorder(next.map((r) => r.id));
      const items = itemsOf(data);
      if (items.length) setRules(items);
    } catch (err) {
      setRules(previous);
      toast.error(describeError(err).summary);
    }
  };

  const toggleActive = async (rule) => {
    const active = rule.active === false;
    setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, active } : r)));
    try {
      const saved = await routingRulesAPI.update(rule.id, { active });
      if (saved?.id) setRules((list) => list.map((r) => (r.id === saved.id ? saved : r)));
    } catch (err) {
      setRules((list) => list.map((r) => (r.id === rule.id ? { ...r, active: !active } : r)));
      toast.error(describeError(err).summary);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await routingRulesAPI.remove(deleting.id);
      toast.success(t('toast.deleted', { name: deleting.name }));
      setDeleting(null);
      load();
    } catch {
      // The interceptor has shown why.
    } finally {
      setBusy(false);
    }
  };

  const tierLabel = (value) => CONFIDENTIALITY_TIERS.find((tier) => tier.value === value)?.label || value;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{t('page.title')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">{t('page.intro')}</p>
        </div>
        <Button startIcon={Plus} onClick={() => setEditing('new')}>{t('page.add')}</Button>
      </div>

      <p className="sr-only" aria-live="polite">{announce}</p>

      {loadError ? (
        <Alert variant="error">{loadError}</Alert>
      ) : !rules ? (
        <Card>
          <Card.Content className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </Card.Content>
        </Card>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <Route className="h-7 w-7 text-ink-subtle" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">{t('page.emptyTitle')}</p>
          <p className="max-w-lg text-sm text-ink-muted">{t('page.emptyBody')}</p>
          <Button className="mt-2" startIcon={Plus} onClick={() => setEditing('new')}>{t('page.add')}</Button>
        </div>
      ) : (
        <Card padding="none">
          <p className="border-b border-line-subtle px-4 py-2.5 text-xs text-ink-muted sm:px-5">{t('list.orderHint')}</p>
          <ol className="divide-y divide-line-subtle">
            {rules.map((rule, index) => {
              const errors = errorsOf(rule.problems || []);
              const warnings = warningsOf(rule.problems || []);
              const inactive = rule.active === false;
              return (
                <li
                  key={rule.id}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(index);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) reorder(dragIndex, index);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={`flex gap-3 px-4 py-4 sm:px-5 ${dragIndex === index ? 'bg-accent-soft/40' : ''}`}
                >
                  <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
                    <GripVertical className="h-4 w-4 cursor-grab text-ink-subtle" aria-hidden="true" />
                    <span className="text-xs font-mono text-ink-muted" title={t('list.priority')}>{rule.priority}</span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink" dir="auto">{rule.name}</p>
                      <span className="text-xs text-ink-muted">{t('list.version', { version: rule.version ?? 1 })}</span>
                      {/* Inactive is said in words, not by fading the row (contrast). */}
                      {inactive && <span className="rounded-full border border-line px-2 py-px text-xs font-semibold text-ink-secondary">{t('list.inactive')}</span>}
                      {errors.length > 0 && (
                        <span className="rounded-full bg-danger-soft px-2 py-px text-xs font-semibold text-danger-fg">{t('list.errors', { count: errors.length })}</span>
                      )}
                      {warnings.length > 0 && (
                        <span className="rounded-full bg-warning-soft px-2 py-px text-xs font-semibold text-warning-fg">{t('list.warnings', { count: warnings.length })}</span>
                      )}
                    </div>
                    {rule.description && <p className="text-sm text-ink-muted" dir="auto">{rule.description}</p>}
                    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[7rem_1fr]">
                      <dt className="text-xs font-semibold uppercase text-ink-muted">{t('list.when')}</dt>
                      <dd><ConditionSummary match={rule.match} entityName={entityName} /></dd>
                      <dt className="text-xs font-semibold uppercase text-ink-muted">{t('list.then')}</dt>
                      <dd className="flex flex-wrap items-center gap-1.5 text-ink-secondary">
                        {rule.actions?.owner_role && <span dir="auto">{t('list.ownerTo', { role: nameFor(rule.actions.owner_role) })}</span>}
                        {rule.actions?.backup_role && <span className="text-xs text-ink-muted" dir="auto">{t('list.backupTo', { role: nameFor(rule.actions.backup_role) })}</span>}
                        {(rule.actions?.add_flags || []).map((code) => (
                          <FlagBadge key={code} flag={triggerByCode.get(code) || { code }} />
                        ))}
                        {rule.actions?.raise_tier && <span className="text-xs">{t('list.tierAtLeast', { tier: tierLabel(rule.actions.raise_tier) })}</span>}
                      </dd>
                    </dl>
                    <ProblemList problems={rule.problems} />
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!inactive}
                      aria-label={t('list.activeFor', { name: rule.name })}
                      onClick={() => toggleActive(rule)}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${inactive ? 'bg-line-strong' : 'bg-accent'}`}
                    >
                      <span aria-hidden="true" className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${inactive ? 'translate-x-0.5 rtl:-translate-x-0.5' : 'translate-x-5.5 rtl:-translate-x-5.5'}`} />
                    </button>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="small" aria-label={t('list.moveUp', { name: rule.name })} disabled={index === 0} onClick={() => reorder(index, index - 1)}>
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="small" aria-label={t('list.moveDown', { name: rule.name })} disabled={index === rules.length - 1} onClick={() => reorder(index, index + 1)}>
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="small" aria-label={t('list.edit', { name: rule.name })} onClick={() => setEditing(rule)}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="small" aria-label={t('list.delete', { name: rule.name })} onClick={() => setDeleting(rule)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <RoutingPreview types={types} entities={entities} nameFor={nameFor} />

      <RuleEditor
        isOpen={Boolean(editing)}
        rule={editing && editing !== 'new' ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={load}
        types={types}
        entities={entities}
        roles={roles}
        triggers={triggers}
        nameFor={nameFor}
      />

      {deleting && (
        <ConfirmationModal
          isOpen
          onClose={() => setDeleting(null)}
          onConfirm={remove}
          isLoading={busy}
          destructive
          title={t('delete.title', { name: deleting.name })}
          message={t('delete.body')}
          confirmText={t('delete.confirm')}
        />
      )}
    </div>
  );
};

export default RoutingRules;
