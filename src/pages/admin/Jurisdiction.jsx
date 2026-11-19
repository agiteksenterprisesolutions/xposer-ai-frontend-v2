// src/pages/admin/Jurisdiction.jsx
//
// What the organization's jurisdiction pack says (XPAI-82/85/86/89), read-only:
// the super admin creates, signs off and activates packs. A tenant is pinned
// to one region (UAE or KSA) and follows its default pack's active version;
// a legal entity can follow another pack from the same region.
//
// No pack, or a pack with no active version, means deadlines, retention and
// calendars work exactly as before.
import { Trans, useTranslation } from 'react-i18next';
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
import { intlLocale } from '../../utils/locale';
import useSEO from '../../hooks/useSEO';

// Weekday names in the interface language; the API counts Monday as 0
// (1 January 2024 was a Monday).
const weekdayName = (index) =>
  new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + index)));
const TIMERS = ['acknowledge', 'triage', 'feedback'];
const CADENCES = ['monthly', 'quarterly', 'semi_annual', 'annual'];
const STATUS_VARIANT = { active: 'success', draft: 'warning', superseded: 'default' };

const LegalReview = ({ review }) => {
  const { t } = useTranslation('admin');
  return review?.reviewer_name ? (
    <span className="inline-flex items-center gap-1 text-xs text-ink-secondary">
      <CheckCircle2 className="h-3.5 w-3.5 text-success-fg" aria-hidden="true" />
      <span>
        <Trans
          t={t}
          i18nKey={review.reviewed_on ? 'jurisdiction.signedOffOn' : 'jurisdiction.signedOff'}
          values={{ name: review.reviewer_name, date: review.reviewed_on ? formatDate(review.reviewed_on) : '' }}
          components={{ b: <span className="font-medium text-ink" dir="auto" /> }}
        />
      </span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-fg">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {t('jurisdiction.noSignOff')}
    </span>
  );
};

const Row = ({ label, children }) => {
  const { t } = useTranslation('admin');
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children || <span className="text-ink-subtle">{t('jurisdiction.notSet')}</span>}</dd>
    </>
  );
};

const StatusBadge = ({ status }) => {
  const { t } = useTranslation('admin');
  if (!status) return null;
  return (
    <Badge variant={STATUS_VARIANT[status] || 'default'} size="small" dot>
      {t(`jurisdiction.status.${status}`, { defaultValue: status })}
    </Badge>
  );
};

const Named = ({ items, nameKey = 'name' }) =>
  items?.length ? (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.code}>
          <span className="font-medium" dir="auto">{localized(item[nameKey]) || item.code}</span>
          {localized(item[nameKey]) && <span className="ms-1 font-mono text-xs text-ink-muted">{item.code}</span>}
          {item.regulator && <span className="text-xs text-ink-muted"> · {item.regulator}</span>}
          {localized(item.description) && <span className="block text-xs text-ink-muted" dir="auto">{localized(item.description)}</span>}
          {item.url && (
            <a href={item.url} target="_blank" rel="noreferrer" dir="ltr" className="block text-xs text-link hover:underline">
              {item.url}
            </a>
          )}
        </li>
      ))}
    </ul>
  ) : null;

const Jurisdiction = () => {
  const { t } = useTranslation('admin');
  useSEO({ title: t('jurisdiction.title'), description: t('jurisdiction.seoDescription'), noIndex: true });
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
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{t('jurisdiction.title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t('jurisdiction.intro')}</p>
      </div>

      <Card>
        <dl className="grid grid-cols-[minmax(9rem,auto)_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-sm">
          <Row label={t('jurisdiction.region')}>
            {organization?.region ? (
              <span className="inline-flex items-center gap-2">
                <Badge variant="info" size="small">
                  {organization.region}
                </Badge>
                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  {organization.region_pinned_at
                    ? t('jurisdiction.fixedSince', { date: formatDate(organization.region_pinned_at) })
                    : t('jurisdiction.fixed')}
                </span>
              </span>
            ) : (
              <span className="text-ink-muted">{t('jurisdiction.notSetYet')}</span>
            )}
          </Row>
          <Row label={t('jurisdiction.currency')}>{organization?.default_currency}</Row>
          <Row label={t('jurisdiction.pack')}>
            {code ? (
              <span className="font-mono">{code}</span>
            ) : (
              <span className="text-ink-muted">{t('jurisdiction.noPack')}</span>
            )}
          </Row>
        </dl>
        {can(ACCESS.entities) && (
          <p className="mt-4 border-t border-line-subtle pt-3 text-xs text-ink-muted">
            {t('jurisdiction.entityNote')}{' '}
            <Link to={staffPath(orgSlug, 'entities')} className="font-medium text-link hover:underline">
              {t('jurisdiction.seeEntities')}
            </Link>
          </p>
        )}
      </Card>

      {code && !pack && (
        <Card>
          <p className="text-sm text-ink-muted">{t('jurisdiction.packLoadError', { code })}</p>
        </Card>
      )}

      {pack && (
        <>
          {!active && (
            <div className="flex items-start gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-fg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>{t('jurisdiction.noActiveVersion', { code })}</p>
            </div>
          )}

          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <Card.Title className="flex items-center gap-2 text-base">
                  <Landmark className="h-4 w-4 text-accent-fg" aria-hidden="true" />
                  <span dir="auto">{localized(pack.name) || code}</span>
                </Card.Title>
                <p className="mt-1">
                  <LegalReview review={pack.legal_review} />
                </p>
              </div>
              <span className="text-sm text-ink-secondary">
                {t('jurisdiction.version', { version: pack.version })}{' '}
                <StatusBadge status={versions.find((v) => v.version === pack.version)?.status} />
              </span>
            </div>

            <dl className="grid grid-cols-[minmax(9rem,auto)_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
              <Row label={t('jurisdiction.deadlines')}>
                <ul className="space-y-0.5">
                  {TIMERS.map((key) => {
                    const timer = pack.timers?.[key];
                    return (
                      <li key={key}>
                        {t(`jurisdiction.timers.${key}`)}:{' '}
                        {timer?.days != null ? (
                          <span className="font-medium">
                            {timer.basis === 'business'
                              ? t('jurisdiction.businessDays', { count: timer.days })
                              : t('jurisdiction.calendarDays', { count: timer.days })}
                          </span>
                        ) : (
                          <span className="text-ink-subtle">{t('jurisdiction.timerNotSet')}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Row>
              <Row label={t('jurisdiction.minRetention')}>
                {pack.retention?.min_years != null &&
                  t(pack.retention.starts_from === 'submission' ? 'jurisdiction.retentionFromSubmission' : 'jurisdiction.retentionFromClosure', {
                    count: pack.retention.min_years,
                  })}
              </Row>
              <Row label={t('jurisdiction.boardReporting')}>
                {CADENCES.includes(pack.board_reporting_cadence) ? t(`jurisdiction.cadence.${pack.board_reporting_cadence}`) : pack.board_reporting_cadence}
              </Row>
              <Row label={t('jurisdiction.channels')}>
                {(pack.required_channels || [])
                  .map((channel) => t(`jurisdiction.channel.${channel}`, { defaultValue: channel }))
                  .join(t('jurisdiction.listSeparator'))}
              </Row>
              <Row label={t('jurisdiction.regulators')}>
                <Named items={pack.regulators} />
              </Row>
              <Row label={t('jurisdiction.triggers')}>
                <Named items={pack.regulatory_triggers} nameKey="label" />
              </Row>
              <Row label={t('jurisdiction.externalRoutes')}>
                <Named items={pack.external_routes} />
              </Row>
              <Row label={t('jurisdiction.deflection')}>
                <Named items={pack.deflection_exits} nameKey="label" />
              </Row>
              <Row label={t('jurisdiction.aiNotice')}>
                {(pack.ai_notice?.en || pack.ai_notice?.ar) && (
                  <span className="block space-y-1">
                    {pack.ai_notice.en && <span className="block whitespace-pre-wrap" dir="ltr" lang="en">{pack.ai_notice.en}</span>}
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
              <CalendarDays className="h-4 w-4 text-accent-fg" aria-hidden="true" /> {t('jurisdiction.businessDaysTitle')}
            </Card.Title>
            <p className="mb-4 text-xs text-ink-muted">{t('jurisdiction.businessDaysIntro')}</p>
            {calendar === null ? (
              <Skeleton.Lines lines={3} />
            ) : calendar === false ? (
              <p className="text-sm text-ink-muted">{t('jurisdiction.calendarLoadError')}</p>
            ) : (
              <div className="space-y-4">
                <dl className="grid grid-cols-[minmax(9rem,auto)_minmax(0,1fr)] gap-x-6 gap-y-2 text-sm">
                  <Row label={t('jurisdiction.weekend')}>
                    {new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format((calendar.weekend_days || []).map(weekdayName))}
                  </Row>
                  <Row label={t('jurisdiction.timeZone')}>{calendar.timezone}</Row>
                </dl>
                {holidays.length ? (
                  <ul className="divide-y divide-line-subtle rounded-lg border border-line">
                    {holidays.map((h) => (
                      <li key={h.date} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                        <span className="text-ink" dir="auto">{localized(h.name) || t('jurisdiction.publicHoliday')}</span>
                        <span className="text-xs text-ink-muted tabular-nums">{formatDate(h.date)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-muted">{t('jurisdiction.noHolidays')}</p>
                )}
              </div>
            )}
          </Card>

          {versions.length > 1 && (
            <Card>
              <Card.Title className="mb-3 text-base">{t('jurisdiction.versions')}</Card.Title>
              <ul className="divide-y divide-line-subtle">
                {versions.map((v) => {
                  return (
                    <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <span className="text-sm font-medium text-ink">
                        {t('jurisdiction.version', { version: v.version })}{' '}
                        <StatusBadge status={v.status} />
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
          <Card.Title className="mb-1 text-base">
            {organization?.region ? t('jurisdiction.packsFor', { region: organization.region }) : t('jurisdiction.packsForYours')}
          </Card.Title>
          <p className="mb-3 text-xs text-ink-muted">{t('jurisdiction.packsIntro')}</p>
          <ul className="divide-y divide-line-subtle">
            {regionPacks.map((p) => (
              <li key={p.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm text-ink">
                  <span className="font-mono">{p.code}</span> · <span dir="auto">{localized(p.name)}</span>
                  {p.code === code && <span className="ms-2 text-xs text-ink-muted">{t('jurisdiction.yours')}</span>}
                </span>
                <span className="flex items-center gap-3">
                  {p.active_version ? (
                    <Badge variant="success" size="small" dot>
                      {t('jurisdiction.activeVersion', { version: p.active_version })}
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="warning" size="small" dot>
                        {t('jurisdiction.notActiveYet')}
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
