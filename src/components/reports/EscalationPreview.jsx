// src/components/reports/EscalationPreview.jsx
//
// "Who would this report escalate to?" — the report's own free text run
// through the reporting hierarchy. Nothing is changed; it is a lookup.
//
// Three outcomes, each with its own wording, because they mean very
// different things in a system that decides who hears about an allegation
// against them:
//   matched, with someone above  → the route.
//   matched, no one above on file → someone was identified, but the ladder
//                                    stops there; a person must route it.
//   not matched                  → no one ON FILE is named. Never "nobody is
//                                    implicated": matching is exact and
//                                    whole-word by design, so a misspelling or
//                                    a person missing from the directory looks
//                                    the same as no name at all.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDown, HelpCircle, Route, UserRound } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { getReportTexts } from '../../utils/reports';
import { describeError } from '../../utils/errors';

const Person = ({ member, level, label }) => (
  <div className="flex items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">{label}</p>
      <p className="text-sm font-medium text-ink">{member?.name || '—'}</p>
      <p className="text-xs text-ink-muted">
        {[member?.designation, level?.title || member?.level_code, member?.department].filter(Boolean).join(' · ')}
      </p>
    </div>
  </div>
);

const EscalationPreview = ({ report, hierarchyPath }) => {
  const { nameFor } = useOrgRoles();
  const [department, setDepartment] = useState('');
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  const texts = getReportTexts(report);

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      setResult(await orgHierarchyAPI.resolve({ texts, department: department.trim() || null }));
    } catch (err) {
      setResult(null);
      setError(describeError(err));
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <Route className="h-4 w-4 text-accent-fg" />
          Escalation route
        </Card.Title>
        <Card.Description>
          Who this report would go to, based on the people it names and your reporting hierarchy. Nothing is changed.
        </Card.Description>
      </Card.Header>
      <Card.Content className="space-y-4">
        <div className="flex flex-col gap-2">
          <input
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            placeholder="Department (optional)"
            aria-label="Department"
            className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink hover:border-line-strong"
          />
          <Button variant="secondary" onClick={check} isLoading={checking} disabled={texts.length === 0}>
            {result ? 'Check again' : 'Check routing'}
          </Button>
          <p className="text-xs text-ink-subtle">
            Scans {texts.length} answer{texts.length === 1 ? '' : 's'} from this report for names in the directory.
          </p>
        </div>

        {error && <Alert variant="error" title={error.summary} />}

        {result?.matched && result.escalate_to_member && (
          <div className="space-y-2">
            <Person member={result.implicated_member} level={result.implicated_level} label="Named in the report" />
            <div className="flex justify-center">
              <ArrowDown className="h-4 w-4 text-ink-subtle" />
            </div>
            <Person member={result.escalate_to_member} level={result.escalate_to_level} label="Escalates to" />
            {result.escalation_role && (
              <p className="text-xs text-ink-muted">
                Routed to the <span className="font-medium text-ink">{nameFor(result.escalation_role)}</span> role.
              </p>
            )}
            {result.reason && <p className="text-xs text-ink-subtle">{result.reason}</p>}
          </div>
        )}

        {result?.matched && !result.escalate_to_member && (
          <div className="space-y-2">
            <Person member={result.implicated_member} level={result.implicated_level} label="Named in the report" />
            <Alert variant="warning" title="No one above them on file">
              <p>
                This person was identified, but the directory has no manager or more senior level to escalate to. A
                person needs to decide where this report goes.
              </p>
              {result.reason && <p className="mt-1 text-xs">{result.reason}</p>}
              {hierarchyPath && (
                <Link to={hierarchyPath} className="mt-2 inline-block text-sm font-medium text-link hover:underline">
                  Review the hierarchy →
                </Link>
              )}
            </Alert>
          </div>
        )}

        {result && !result.matched && (
          <div className="flex items-start gap-2 rounded-lg border border-line bg-subtle px-3 py-2.5">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
            <div className="space-y-1 text-sm text-ink-secondary">
              <p className="font-medium text-ink">No one in the directory is named</p>
              <p className="text-xs">
                This does not mean no one is implicated — only that no name in the report matches someone on file.
                Matching is exact on purpose, so a misspelled name or a person missing from the directory reads the
                same. A person needs to decide the routing.
              </p>
              {result.reason && <p className="text-xs text-ink-subtle">{result.reason}</p>}
              {hierarchyPath && (
                <Link to={hierarchyPath} className="inline-block text-xs font-medium text-link hover:underline">
                  Check the directory →
                </Link>
              )}
            </div>
          </div>
        )}

        {texts.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
            <AlertTriangle className="h-3.5 w-3.5" /> This report has no written answers to check.
          </p>
        )}
      </Card.Content>
    </Card>
  );
};

export default EscalationPreview;
