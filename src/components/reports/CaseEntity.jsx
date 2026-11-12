// src/components/reports/CaseEntity.jsx
//
// Which legal entity a case is about (XPAI-83/84). Reporters never choose it:
// the AI agents set it after submission ("Set by AI", worth checking) and
// staff can correct it. `entity` is a snapshot taken when it was set, so a
// later rename doesn't change it here.
//
// Changing it is PUT /reports/{id} with entity_code. When the new entity
// follows another jurisdiction pack, the case's deadlines, retention and
// jurisdiction change at once, so the caller re-reads the whole case.
import { useEffect, useState } from 'react';
import { Bot, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import { reportsAPI } from '../../api';
import { entitiesAPI } from '../../api/entities';
import { localized } from '../../api/jurisdiction';
import { describeError } from '../../utils/errors';
import { formatRelativeTime } from '../../utils/formatters';

const CaseEntity = ({ report, canChange, onChanged }) => {
  const [editing, setEditing] = useState(false);
  const [entities, setEntities] = useState(null);
  const [choice, setChoice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!editing) return;
    setChoice(report.entity_code || '');
    setError(null);
    entitiesAPI
      .list()
      .then(setEntities)
      .catch(() => setEntities([]));
  }, [editing, report.entity_code]);

  const save = async () => {
    if ((choice || null) === (report.entity_code || null)) return setEditing(false);
    setSaving(true);
    setError(null);
    try {
      await reportsAPI.updateReport(report.id, { entity_code: choice || null }, { quiet: true });
      toast.success(choice ? 'Entity updated. Deadlines follow its jurisdiction pack.' : 'Entity cleared.');
      setEditing(false);
      onChanged?.();
    } catch (err) {
      const { status, summary } = describeError(err);
      setError(status === 403 ? 'You can only change the status of cases assigned to you.' : summary);
    } finally {
      setSaving(false);
    }
  };

  const entity = report.entity;
  const setBy = report.entity_set_by?.username || report.entity_set_by?.full_name;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-ink-muted">Legal entity</p>
        {canChange && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-link hover:underline"
          >
            <Pencil className="h-3 w-3" /> {report.entity_code ? 'Change' : 'Set'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <select
            aria-label="Legal entity"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            disabled={!entities || saving}
            className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink outline-none focus:border-line-accent"
          >
            <option value="">{entities ? 'Not identified' : 'Loading…'}</option>
            {(entities || []).map((e) => (
              <option key={e.code} value={e.code}>
                {localized(e.name)} ({e.code})
              </option>
            ))}
          </select>
          {entities?.length === 0 && <p className="text-xs text-ink-muted">No entities have been added yet.</p>}
          {error && <p className="text-xs text-danger-fg">{error}</p>}
          <div className="flex gap-2">
            <Button size="small" onClick={save} isLoading={saving} disabled={!entities}>
              Save
            </Button>
            <Button size="small" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : report.entity_code ? (
        <>
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
            {localized(entity?.name) || report.entity_code}
            {report.entity_source === 'agent' && (
              <span
                className="inline-flex items-center gap-1 rounded bg-info-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-info-fg"
                title="The AI worked this out from the report. Check it."
              >
                <Bot className="h-3 w-3" /> Set by AI
              </span>
            )}
          </p>
          <p className="text-xs text-ink-muted">
            <span className="font-mono">{report.entity_code}</span>
            {entity?.jurisdiction_pack_code && <> · {entity.jurisdiction_pack_code}</>}
            {report.entity_set_at && (
              <>
                {' '}
                · set {formatRelativeTime(report.entity_set_at)}
                {report.entity_source === 'staff' && setBy && ` by ${setBy}`}
              </>
            )}
          </p>
        </>
      ) : (
        <p className="text-sm text-ink-muted">Not identified yet</p>
      )}
    </div>
  );
};

export default CaseEntity;
