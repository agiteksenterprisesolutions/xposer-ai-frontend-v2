// src/pages/admin/Jurisdiction.jsx
//
// What the organization's jurisdiction pack says (XPAI-82/85/86/89), read-only:
// the super admin creates, signs off and activates packs. A tenant is pinned
// to one region (UAE or KSA) and follows its default pack's active version;
// a legal entity can follow another pack from the same region.
//
// No pack, or a pack with no active version, means deadlines, retention and
// calendars work exactly as before.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, Landmark, Lock } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Skeleton from '../../components/ui/Skeleton';
import { jurisdictionAPI, localized } from '../../api/jurisdiction';
import { useOrgJurisdiction } from '../../hooks/useOrgJurisdiction';
import { useCan } from '../../hooks/useCan';
import { ACCESS } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { formatDate } from '../../utils/formatters';
import useSEO from '../../hooks/useSEO';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMERS = [
  ['acknowledge', 'Acknowledge the reporter'],
  ['triage', 'Triage'],
  ['feedback', 'Feedback to the reporter'],
];
const CADENCE = { monthly: 'Monthly', quarterly: 'Quarterly', semi_annual: 'Every six months', annual: 'Yearly' };
const STATUS = {
  active: ['success', 'Active'],
  draft: ['warning', 'Draft'],
  superseded: ['default', 'Superseded'],
};

const LegalReview = ({ review }) =>
  review?.reviewer_name ? (
    <span className="inline-flex items-center gap-1 text-xs text-ink-secondary">
      <CheckCircle2 className="h-3.5 w-3.5 text-success-fg" />
      Signed off by <span className="font-medium text-ink">{review.reviewer_name}</span>
      {review.reviewed_on && <> on {formatDate(review.reviewed_on)}</>}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-fg">
      <AlertTriangle className="h-3.5 w-3.5" /> No legal sign-off yet
    </span>
  );

const Row = ({ label, children }) => (
  <>
    <dt className="text-ink-muted">{label}</dt>
    <dd className="min-w-0 text-ink">{children || <span className="text-ink-subtle">Not set</span>}</dd>
  </>
);

const Named = ({ items, nameKey = 'name' }) =>
  items?.length ? (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.code}>
          <span className="font-medium">{localized(item[nameKey]) || item.code}</span>
          {localized(item[nameKey]) && <span className="ml-1 font-mono text-xs text-ink-muted">{item.code}</span>}
          {item.regulator && <span className="text-xs text-ink-muted"> · {item.regulator}</span>}
          {localized(item.description) && <span className="block text-xs text-ink-muted">{localized(item.description)}</span>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" className="block text-xs text-link hover:underline">
              {item.url}
            </a>
          )}
        </li>
      ))}
    </ul>
  ) : null;

const Jurisdiction = () => {
  useSEO({ title: 'Jurisdiction', description: 'Your organization’s region and jurisdiction pack.', noIndex: true });
  const { orgSlug } = useParams();
  const can = useCan();
  const { loading, organization, pack, versions, active } = useOrgJurisdiction();
  const [calendar, setCalendar] = useState(null);
  const [regionPacks, setRegionPacks] = useState(null);

  const code = organization?.default_jurisdiction_pack_code;

  useEffect(() => {
    if (!code) return;
    jurisdictionAPI.calendar(code).then(setCalendar).catch(() => setCalendar(false));
  }, [code]);

  useEffect(() => {
    if (loading) return;
    jurisdictionAPI
      .list()
      .then((list) => setRegionPacks(list.filter((p) => !organization?.region || p.region === organization.region)))
      .catch(() => setRegionPacks([]));
  }, [loading, organization?.region]);

  const holidays = useMemo(
    () => [...(calendar?.holidays || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [calendar],
  );

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton.Text size="2xl" className="w-48" />
        <Card>
          <Skeleton.Lines lines={4} />
        </Card>
        <Card>
          <Skeleton.Lines lines={8} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">Jurisdiction</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          The rules your organization’s cases follow: deadlines, business days, minimum retention and regulators. Set
          up by Xposer; contact us to change them.
        </p>
      </div>

      <Card>
        <dl className="grid grid-cols-[minmax(9rem,auto)_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm">
          <Row label="Region">
            {organization?.region ? (
              <span className="inline-flex items-center gap-2">
                <Badge variant="info" size="small">
                  {organization.region}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                  <Lock className="h-3 w-3" /> Fixed
                  {organization.region_pinned_at && ` since ${formatDate(organization.region_pinned_at)}`}
                </span>
              </span>
            ) : (
              <span className="text-ink-muted">Not set yet</span>
            )}
          </Row>
          <Row label="Currency">{organization?.default_currency}</Row>
          <Row label="Jurisdiction pack">
            {code ? (
              <span className="font-mono">{code}</span>
            ) : (
              <span className="text-ink-muted">None. Deadlines and retention follow each report type.</span>
            )}
          </Row>
        </dl>
        {can(ACCESS.entities) && (
          <p className="mt-4 border-t border-line-subtle pt-3 text-xs text-ink-muted">
            A legal entity can follow a different pack from the same region.{' '}
            <Link to={staffPath(orgSlug, 'entities')} className="font-medium text-link hover:underline">
              See legal entities
            </Link>
          </p>
        )}
      </Card>

      {code && !pack && (
        <Card>
          <p className="text-sm text-ink-muted">Couldn’t load the {code} pack.</p>
        </Card>
      )}

      {pack && (
        <>
          {!active && (
            <div className="flex items-start gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-fg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {code} has no active version yet, so it doesn’t apply to cases. Below is the latest draft; cases work as
                before until it’s signed off and activated.
              </p>
            </div>
          )}

          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <Card.Title className="flex items-center gap-2 text-base">
                  <Landmark className="h-4 w-4 text-accent-fg" />
                  {localized(pack.name) || code}
                </Card.Title>
                <p className="mt-1">
                  <LegalReview review={pack.legal_review} />
                </p>
              </div>
              <span className="text-sm text-ink-secondary">
                Version {pack.version}{' '}
                {(() => {
                  const [variant, label] = STATUS[versions.find((v) => v.version === pack.version)?.status] || ['default', ''];
                  return label ? (
                    <Badge variant={variant} size="small" dot>
                      {label}
                    </Badge>
                  ) : null;
                })()}
              </span>
            </div>

            <dl className="grid grid-cols-[minmax(9rem,auto)_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
              <Row label="Deadlines">
                <ul className="space-y-0.5">
                  {TIMERS.map(([key, label]) => {
                    const t = pack.timers?.[key];
                    return (
                      <li key={key}>
                        {label}:{' '}
                        {t?.days != null ? (
                          <span className="font-medium">
                            {t.days} {t.basis === 'business' ? 'business' : 'calendar'} days
                          </span>
                        ) : (
                          <span className="text-ink-subtle">not set</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Row>
              <Row label="Minimum retention">
                {pack.retention?.min_years != null &&
                  `${pack.retention.min_years} years from ${pack.retention.starts_from === 'submission' ? 'submission' : 'when the case is closed'}. A report type can keep cases longer, never shorter.`}
              </Row>
              <Row label="Board reporting">{CADENCE[pack.board_reporting_cadence]}</Row>
              <Row label="Reporting channels">{(pack.required_channels || []).join(', ')}</Row>
              <Row label="Regulators">
                <Named items={pack.regulators} />
              </Row>
              <Row label="Regulatory triggers">
                <Named items={pack.regulatory_triggers} nameKey="label" />
              </Row>
              <Row label="External routes">
                <Named items={pack.external_routes} />
              </Row>
              <Row label="Not a whistleblowing report?">
                <Named items={pack.deflection_exits} nameKey="label" />
              </Row>
              <Row label="AI notice">
                {(pack.ai_notice?.en || pack.ai_notice?.ar) && (
                  <span className="block space-y-1">
                    {pack.ai_notice.en && <span className="block whitespace-pre-wrap">{pack.ai_notice.en}</span>}
                    {pack.ai_notice.ar && (
                      <span className="block whitespace-pre-wrap" dir="rtl" lang="ar">
                        {pack.ai_notice.ar}
                      </span>
                    )}
                  </span>
                )}
              </Row>
            </dl>
          </Card>

          <Card>
            <Card.Title className="mb-1 flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-accent-fg" /> Business days
            </Card.Title>
            <p className="mb-4 text-xs text-ink-muted">
              Business-day deadlines skip these. When a holiday is added, deadlines still running move later.
            </p>
            {calendar === null ? (
              <Skeleton.Lines lines={3} />
            ) : calendar === false ? (
              <p className="text-sm text-ink-muted">Couldn’t load the calendar.</p>
            ) : (
              <div className="space-y-4">
                <dl className="grid grid-cols-[minmax(9rem,auto)_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
                  <Row label="Weekend">{(calendar.weekend_days || []).map((d) => WEEKDAYS[d]).join(' and ')}</Row>
                  <Row label="Time zone">{calendar.timezone}</Row>
                </dl>
                {holidays.length ? (
                  <ul className="divide-y divide-line-subtle rounded-lg border border-line">
                    {holidays.map((h) => (
                      <li key={h.date} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                        <span className="text-ink">{localized(h.name) || 'Public holiday'}</span>
                        <span className="text-xs text-ink-muted tabular-nums">{formatDate(h.date)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-muted">No public holidays listed.</p>
                )}
              </div>
            )}
          </Card>

          {versions.length > 1 && (
            <Card>
              <Card.Title className="mb-3 text-base">Versions</Card.Title>
              <ul className="divide-y divide-line-subtle">
                {versions.map((v) => {
                  const [variant, label] = STATUS[v.status] || ['default', v.status];
                  return (
                    <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="text-sm font-medium text-ink">
                        Version {v.version}{' '}
                        <Badge variant={variant} size="small" dot>
                          {label}
                        </Badge>
                      </span>
                      <LegalReview review={v.legal_review} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      )}

      {regionPacks?.length > 0 && (
        <Card>
          <Card.Title className="mb-1 text-base">Packs for {organization?.region || 'your region'}</Card.Title>
          <p className="mb-3 text-xs text-ink-muted">The packs a legal entity can follow.</p>
          <ul className="divide-y divide-line-subtle">
            {regionPacks.map((p) => (
              <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm text-ink">
                  <span className="font-mono">{p.code}</span> · {localized(p.name)}
                  {p.code === code && <span className="ml-2 text-xs text-ink-muted">(yours)</span>}
                </span>
                <span className="flex items-center gap-3">
                  {p.active_version ? (
                    <Badge variant="success" size="small" dot>
                      v{p.active_version} active
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="warning" size="small" dot>
                        Not active yet
                      </Badge>
                      {/* Why it isn't active: a version needs a sign-off first. */}
                      <LegalReview review={p.latest_legal_review} />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
};

export default Jurisdiction;
