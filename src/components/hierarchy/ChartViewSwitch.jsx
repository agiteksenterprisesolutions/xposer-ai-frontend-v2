// src/components/hierarchy/ChartViewSwitch.jsx
//
// The org chart's two views: levels with the roles at each (from
// /org-hierarchy/chart), or the directory as a tree of people.
import { Layers, Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const VIEWS = [
  { value: 'levels', icon: Layers },
  { value: 'people', icon: Network },
];

const ChartViewSwitch = ({ value, onChange }) => {
  const { t } = useTranslation('hierarchy');
  return (
  <div role="radiogroup" aria-label={t('chartView.label')} className="mb-4 inline-flex rounded-lg bg-active p-1">
    {VIEWS.map(({ value: v, icon: Icon }) => {
      const on = v === value;
      return (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => onChange(v)}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            on ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink-muted hover:text-ink'
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {t(`chartView.${v}`)}
        </button>
      );
    })}
  </div>
  );
};

export default ChartViewSwitch;
