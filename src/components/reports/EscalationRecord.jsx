// src/components/reports/EscalationRecord.jsx
//
// What escalation routing did to this case, for the handlers who can see it:
// whether it was routed around the implicated person, who that is, where it
// went and why (`escalated_reason`, a sentence shown verbatim).
//
// `excluded_user_ids` is never read here. A locked-out person gets a 404 for
// the case, and nothing on any screen may hint at who else is excluded.
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { CONFIDENTIALITY_TIERS } from '../../utils/reportTypes';

const tierLabel = (tier) => CONFIDENTIALITY_TIERS.find((t) => t.value === tier)?.label || tier;

/** True when the report carries anything worth showing. */
export const hasEscalationRecord = (report) =>
  Boolean(
    report?.coi_bypass_applied ||
      report?.escalated_reason ||
      report?.implicated_member_id ||
      report?.escalated_to_member_id ||
      (report?.confidentiality_tier && report.confidentiality_tier !== 'standard'),
  );

const EscalationRecord = ({ report, canReadHierarchy = false }) => {
  const [members, setMembers] = useState(null);
  const ids = [report.implicated_member_id, report.escalated_to_member_id].filter(Boolean);

  // Names come from the directory, when the viewer may read it.
  useEffect(() => {
    if (!canReadHierarchy || ids.length === 0) return;
    orgHierarchyAPI
      .listMembers({ activeOnly: false })
      .then((list) => setMembers(Array.isArray(list) ? list : []))
      .catch(() => setMembers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadHierarchy, ids.join(',')]);

  const nameOf = (id) => {
    const member = (members || []).find((m) => m.external_id === id || m.id === id);
    return member ? [member.name, member.designation].filter(Boolean).join(' · ') : id;
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex flex-wrap items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning-fg" />
          Escalation
          {report.coi_bypass_applied && (
            <Badge variant="warning" size="small">
              Routed around the implicated person
            </Badge>
          )}
          {report.confidentiality_tier && report.confidentiality_tier !== 'standard' && (
            <Badge variant="danger" size="small">
              {tierLabel(report.confidentiality_tier)}
            </Badge>
          )}
        </Card.Title>
      </Card.Header>
      <Card.Content className="space-y-3">
        {report.escalated_reason && <p className="text-sm text-ink-secondary">{report.escalated_reason}</p>}
        {ids.length > 0 && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {report.implicated_member_id && (
              <div>
                <dt className="text-xs text-ink-subtle">Implicated</dt>
                <dd className="font-medium text-ink">{nameOf(report.implicated_member_id)}</dd>
              </div>
            )}
            {report.escalated_to_member_id && (
              <div>
                <dt className="text-xs text-ink-subtle">Escalated to</dt>
                <dd className="font-medium text-ink">{nameOf(report.escalated_to_member_id)}</dd>
              </div>
            )}
          </dl>
        )}
      </Card.Content>
    </Card>
  );
};

export default EscalationRecord;
