// src/components/reportTypes/TypeRoutingRules.jsx
//
// "Rules that affect this type" (ROUTING_RULES.md §8, suggested): the routing
// rules whose type conditions match this report type — its exact code, a
// code prefix (case-insensitive) or its category. Matching is done here on
// the client from GET /routing-rules/. Shown only to someone who manages
// routing rules (routing:manage), and only when at least one rule matches.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Route } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { routingRulesAPI } from '../../api/routingRules';
import { useCan } from '../../hooks/useCan';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { PERM } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import FlagBadge from '../reports/FlagBadge';

const upper = (v) => String(v || '').toUpperCase();

/** Whether a rule's type conditions match a report type `{ code, category }`. */
export const ruleMatchesType = (rule, type) => {
  const m = rule?.match || {};
  const code = upper(type?.code);
  const category = upper(type?.category);
  if (code && (m.report_type_codes || []).some((c) => upper(c) === code)) return true;
  if (code && (m.code_prefixes || []).some((p) => p && code.startsWith(upper(p)))) return true;
  if (category && (m.categories || []).some((c) => upper(c) === category)) return true;
  return false;
};

const TypeRoutingRules = ({ reportType, orgSlug }) => {
  const { t } = useTranslation('reportTypes');
  const canRoute = useCan()(PERM.routingManage);
  const { nameFor } = useOrgRoles();
  const [rules, setRules] = useState(null);

  useEffect(() => {
    if (!canRoute) return undefined;
    let cancelled = false;
    routingRulesAPI
      .list()
      .then((data) => !cancelled && setRules((data?.items || []).filter((rule) => ruleMatchesType(rule, reportType))))
      .catch(() => !cancelled && setRules([]));
    return () => {
      cancelled = true;
    };
  }, [canRoute, reportType]);

  if (!canRoute || !rules?.length) return null;

  return (
    <section aria-labelledby="type-routing-rules" className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="type-routing-rules" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Route className="h-4 w-4 text-accent-fg" aria-hidden="true" />
          {t('routingRules.title', { count: rules.length })}
        </h2>
        <Link to={staffPath(orgSlug, 'routing-rules')} className="text-sm font-medium text-link hover:underline">
          {t('routingRules.manage')}
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-line-subtle">
        {rules.map((rule) => {
          const actions = rule.actions || {};
          return (
            <li key={rule.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="font-medium text-ink" dir="auto">{rule.name}</span>
              {rule.active === false && (
                <span className="rounded bg-subtle px-1.5 py-px text-xs text-ink-muted">{t('routingRules.inactive')}</span>
              )}
              {actions.owner_role && (
                <span className="text-ink-secondary">{t('routingRules.owner', { role: nameFor(actions.owner_role) })}</span>
              )}
              {(actions.add_flags || []).map((code) => <FlagBadge key={code} flag={{ code }} />)}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default TypeRoutingRules;
