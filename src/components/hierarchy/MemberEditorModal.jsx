// src/components/hierarchy/MemberEditorModal.jsx
//
// Add a person to the reporting directory by hand, or correct an entry.
//
// For a person who came from the HR sync, the level and manager set here are
// stored as corrections: the next sync refreshes the raw HR fields around
// them without undoing the fix. Only changed fields are sent on an edit, so
// opening and saving an entry never turns an HR value into a correction.
import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { describeError } from '../../utils/errors';

const selectClass =
  'w-full rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink hover:border-line-strong disabled:opacity-60';

const FIELDS = ['name', 'email', 'designation', 'department', 'level_code', 'manager_external_id'];

/**
 * Props:
 *   member   – the entry to edit; omit to add one
 *   levels   – for the level picker (most senior first)
 *   members  – the directory, for the manager picker
 *   readOnly, onClose, onSaved
 */
const MemberEditorModal = ({ member = null, levels = [], members = [], readOnly = false, onClose, onSaved }) => {
  const isCreate = !member;
  const fromHr = member?.source === 'hr_sync';

  const [form, setForm] = useState(() => ({
    external_id: member?.external_id || '',
    ...Object.fromEntries(FIELDS.map((field) => [field, member?.[field] || ''])),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const levelTitle = (code) => levels.find((l) => l.code === code)?.title || code;
  const nameById = useMemo(() => new Map(members.map((m) => [m.external_id, m.name])), [members]);
  const managerOptions = useMemo(
    () =>
      members
        .filter((m) => m.external_id !== member?.external_id && m.is_active !== false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [members, member],
  );

  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      let saved;
      if (isCreate) {
        const body = Object.fromEntries(
          ['external_id', ...FIELDS].map((field) => [field, form[field].trim() || null]),
        );
        saved = await orgHierarchyAPI.createMember(body);
        toast.success(`${body.name} added to the directory.`);
      } else {
        const changes = {};
        FIELDS.forEach((field) => {
          const next = form[field].trim();
          if (next !== (member[field] || '')) changes[field] = next || null;
        });
        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }
        saved = await orgHierarchyAPI.updateMember(member.id, changes);
        toast.success(`${form.name.trim()} updated.`);
      }
      onSaved?.(saved);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const hrNote = (field, value, format = (v) => v) =>
    fromHr && member.has_manual_override && (member[`${field}_from_hr`] ?? null) !== (member[field] ?? null) ? (
      <p className="mt-1 text-xs text-ink-muted">
        HR says: <span className="font-medium">{value ? format(value) : '(none)'}</span>
      </p>
    ) : null;

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={isCreate ? 'Add a person' : readOnly ? member.name : `Edit ${member.name}`}
      size="large"
      closeOnOverlayClick={false}
      footer={
        readOnly ? (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} isLoading={saving} disabled={!form.name.trim()}>
              {isCreate ? 'Add person' : 'Save changes'}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        {fromHr && !readOnly && (
          <Alert variant="info" title="This person comes from your HR system">
            Level and manager changes are kept as corrections and survive the next sync. Other fields may be overwritten
            by it.
          </Alert>
        )}

        {error && (
          <Alert variant="error" title={error.summary}>
            {error.problems.length > 0 && (
              <ul className="list-disc space-y-1 pl-4">
                {error.problems.map((problem, index) => (
                  <li key={index}>{problem.message}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            value={form.name}
            onChange={set('name')}
            required
            readOnly={readOnly}
            helperText="Spelled as a reporter would write it — escalation matches names in report text exactly."
          />
          <Input
            label="Employee ID"
            value={form.external_id}
            onChange={set('external_id')}
            readOnly={!isCreate || readOnly}
            className="font-mono"
            helperText={isCreate ? 'Optional — generated from the name if left empty.' : 'IDs cannot change.'}
          />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} readOnly={readOnly} />
          <Input
            label="Job title"
            value={form.designation}
            onChange={set('designation')}
            readOnly={readOnly}
            placeholder="e.g. Finance Executive"
          />
          <Input label="Department" value={form.department} onChange={set('department')} readOnly={readOnly} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="member-level" className="text-xs font-medium text-ink-secondary">
              Level
            </label>
            <select id="member-level" value={form.level_code} onChange={set('level_code')} disabled={readOnly} className={selectClass}>
              <option value="">No level</option>
              {levels.map((level) => (
                <option key={level.code} value={level.code}>
                  {level.title} ({level.rank})
                </option>
              ))}
              {form.level_code && !levels.some((l) => l.code === form.level_code) && (
                <option value={form.level_code}>{form.level_code} (not found)</option>
              )}
            </select>
            {hrNote('level_code', member?.level_code_from_hr, levelTitle)}
            {!form.level_code && (
              <p className="flex items-start gap-1.5 text-xs text-warning-fg">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                Without a level, a report naming this person can't be escalated.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="member-manager" className="text-xs font-medium text-ink-secondary">
              Direct manager
            </label>
            <select
              id="member-manager"
              value={form.manager_external_id}
              onChange={set('manager_external_id')}
              disabled={readOnly}
              className={selectClass}
            >
              <option value="">No manager on file</option>
              {managerOptions.map((m) => (
                <option key={m.external_id} value={m.external_id}>
                  {m.name}
                  {m.designation ? ` — ${m.designation}` : ''}
                </option>
              ))}
              {form.manager_external_id && !nameById.has(form.manager_external_id) && (
                <option value={form.manager_external_id}>{form.manager_external_id} (not in directory)</option>
              )}
            </select>
            {hrNote('manager_external_id', member?.manager_external_id_from_hr, (id) => nameById.get(id) || id)}
            <p className="text-xs text-ink-muted">Escalation goes to the direct manager first, before the level ladder.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MemberEditorModal;
