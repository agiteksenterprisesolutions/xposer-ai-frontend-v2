// src/components/reports/RoutingReason.jsx
//
// "Why is this case here?" (ROUTING_RULES.md §7–8). Built from the case's
// `rules_routing` — which routing rules matched at submission and what each
// one did — and `routing_note`.
//
// `applied[].used` says which of a rule's actions took effect
// (owner_role, backup_role, add_flags, raise_tier); the values themselves are
// the case's own owner_role / alternate_owner_role / confidentiality_tier,
// since those are the ones actually used. Cases filed before routing rules
// have no `rules_routing`: nothing is shown for them.
import { Route } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Card from '../ui/Card';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { formatDateTime } from '../../utils/formatters';

export const hasRoutingReason = (report) => Boolean(report?.rules_routing);

const RoutingReason = ({ report }) => {
  const { t } = useTranslation('cases');
  const { nameFor } = useOrgRoles();
  const routing = report?.rules_routing;
  if (!routing) return null;

  const applied = Array.isArray(routing.applied) ? routing.applied : [];
  const tier = report.confidentiality_tier;
  const ownerRule = applied.find((rule) => rule.used?.includes('owner_role'));
  const listSep = t('routing.listSeparator');

  // What one rule did, as a short clause list: "owner → SIU; flag IA_FRAUD".
  const effects = (rule) => {
    const parts = [];
    const used = rule.used || [];
    if (used.includes('owner_role') && report.owner_role) parts.push(t('routing.effect.owner', { role: nameFor(report.owner_role) }));
    if (used.includes('backup_role') && report.alternate_owner_role) parts.push(t('routing.effect.backup', { role: nameFor(report.alternate_owner_role) }));
    if (used.includes('raise_tier') && tier) parts.push(t('routing.effect.tier', { tier: t(`routing.tier.${tier}`, { defaultValue: tier }) }));
    const flags = rule.flags_added || [];
    if (flags.length) parts.push(t('routing.effect.flags', { count: flags.length, flags: flags.join(listSep) }));
    return parts.length ? parts.join(t('routing.clauseSeparator')) : t('routing.effect.none');
  };

  let summary;
  if (routing.error) summary = t('routing.summary.error');
  else if (routing.owner_source === 'rule' && ownerRule) summary = t('routing.summary.rule', { name: ownerRule.name, role: nameFor(report.owner_role) });
  else if (applied.length) summary = t('routing.summary.typeOwnerWithRules', { role: nameFor(routing.type_owner_role || report.owner_role) });
  else summary = t('routing.summary.noRule', { role: nameFor(routing.type_owner_role || report.owner_role) });

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Route className="h-4 w-4 text-accent-fg" aria-hidden="true" />
          {t('routing.title')}
        </Card.Title>
      </Card.Header>
      <Card.Content className="space-y-3 text-sm">
        <p className="text-ink-secondary" dir="auto">{summary}</p>

        {routing.error && (
          <p className="rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-xs text-warning-fg" dir="auto">
            {t('routing.errorDetail', { error: routing.error })}
          </p>
        )}

        {applied.length > 0 && (
          <ol className="space-y-2">
            {applied.map((rule, index) => (
              <li key={rule.rule_id || index} className="rounded-lg border border-line-subtle bg-subtle px-3 py-2">
                <p className="font-medium text-ink">
                  <span dir="auto">{rule.name}</span>{' '}
                  <span className="text-xs font-normal text-ink-muted">
                    {t('routing.ruleMeta', { version: rule.version, priority: rule.priority })}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-ink-secondary" dir="auto">{effects(rule)}</p>
              </li>
            ))}
          </ol>
        )}

        {routing.owner_source === 'rule' && routing.type_owner_role && routing.type_owner_role !== report.owner_role && (
          <p className="text-xs text-ink-muted">{t('routing.typeOwnerWas', { role: nameFor(routing.type_owner_role) })}</p>
        )}

        {report.routing_note && (
          <p className="border-t border-line-subtle pt-2 text-xs text-ink-muted" dir="auto">{report.routing_note}</p>
        )}

        {routing.evaluated_at && (
          <p className="text-xs text-ink-subtle">{t('routing.evaluatedAt', { when: formatDateTime(routing.evaluated_at) })}</p>
        )}
      </Card.Content>
    </Card>
  );
};

export default RoutingReason;
