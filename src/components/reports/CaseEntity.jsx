// src/components/reports/CaseEntity.jsx
//
// Which legal entity a case belongs to (ENTITIES.md §3). It is fixed by the
// portal address the reporter used (/acme/insurance → acme_insurance,
// entity_source "portal"); /acme gives no entity, a tenant-level case. The
// reporter is never asked, the AI doesn't set it, and staff can't change it
// (PUT /reports/{id} with entity_code → 400 entity_fixed), so this is
// read-only.
//
// Cases filed before the portal rule may still show an entity the AI or a
// staff member set; those keep their old label.
import { Bot, Globe, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { localized } from '../../api/jurisdiction';

const SOURCE = {
  portal: { icon: Globe, key: 'portal', className: 'bg-accent-soft text-accent-fg' },
  agent: { icon: Bot, key: 'agent', className: 'bg-info-soft text-info-fg' },
  staff: { icon: UserRound, key: 'staff', className: 'bg-subtle text-ink-secondary' },
};

const CaseEntity = ({ report }) => {
  const { t } = useTranslation('entities');
  const entity = report.entity;
  const source = SOURCE[report.entity_source];

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase text-ink-muted">{t('case.label')}</p>
      {report.entity_code ? (
        <>
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
            <span dir="auto">{localized(entity?.name) || report.entity_code}</span>
            {source && (
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide ${source.className}`}
                title={t(`case.source.${source.key}Title`)}
              >
                <source.icon className="h-3 w-3" aria-hidden="true" /> {t(`case.source.${source.key}`)}
              </span>
            )}
          </p>
          <p className="text-xs text-ink-muted">
            <span className="font-mono" dir="ltr">{report.entity_code}</span>
            {entity?.jurisdiction_pack_code && <> · <span dir="ltr">{entity.jurisdiction_pack_code}</span></>}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-secondary">{t('case.tenant')}</p>
      )}
    </div>
  );
};

export default CaseEntity;
