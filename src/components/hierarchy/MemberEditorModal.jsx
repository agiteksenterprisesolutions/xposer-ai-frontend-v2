// src/components/hierarchy/MemberEditorModal.jsx
//
// Add a person to the reporting directory by hand, or correct an entry.
//
// A person is placed in the chart by their ROLE: each role sits at one level,
// and `level_code` on the entry is resolved from it, read-only. Moving someone
// means changing their role; if the role itself is at the wrong level, that
// is an edit to the role and moves everyone holding it. Changing the role
// here also changes the role on every account linked to this entry.
//
// For a person who came from the HR sync, the manager set here is stored as a
// correction: the next sync refreshes the raw HR value around it without
// undoing the fix. Only changed fields are sent on an edit, so opening and
// saving an entry never turns an HR value into a correction.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { describeError } from '../../utils/errors';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { staffPath } from '../../utils/navigation';
import { roleWithLevel, sortRolesByLevel } from '../../utils/roleLevels';

const selectClass =
  'w-full rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink hover:border-line-strong disabled:opacity-60';

const FIELDS = ['name', 'email', 'designation', 'department', 'role_code', 'manager_external_id'];

/**
 * Props:
 *   member   – the entry to edit; omit to add one
 *   levels   – to name the level a role resolves to
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
  // 400 role_has_no_level names the role: a one-field fix on the Roles screen.
  const [roleWithoutLevel, setRoleWithoutLevel] = useState(null);
  const { allRoles } = useOrgRoles();
  const roles = useMemo(() => sortRolesByLevel(allRoles.filter((r) => r.is_active !== false)), [allRoles]);
  const chosenRole = allRoles.find((r) => r.code === form.role_code);
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const levelTitle = (code) => levels.find((l) => l.code === code)?.title || code;
  // Where they will sit: the chosen role's level, else what the server resolved.
  const resolvedLevel = chosenRole ? chosenRole.level_title || (chosenRole.level_code && levelTitle(chosenRole.level_code)) : null;
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
    setRoleWithoutLevel(null);
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
      const detail = err?.response?.data?.detail;
      if (detail?.code === 'role_has_no_level') setRoleWithoutLevel(detail.role_code || form.role_code);
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
            A manager change is kept as a correction and survives the next sync. Other fields may be overwritten by it.
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
            {roleWithoutLevel && (
              <Link
                to={`${staffPath(orgSlug, 'roles')}?role=${encodeURIComponent(roleWithoutLevel)}`}
                className="mt-2 inline-block font-semibold underline underline-offset-2"
              >
                Give that role a level
              </Link>
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
            <label htmlFor="member-role" className="text-xs font-medium text-ink-secondary">
              Role
            </label>
            <select id="member-role" value={form.role_code} onChange={set('role_code')} disabled={readOnly} className={selectClass}>
              <option value="">No role</option>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {roleWithLevel(role)}
                </option>
              ))}
              {form.role_code && !roles.some((r) => r.code === form.role_code) && (
                <option value={form.role_code}>{form.role_code} (not found)</option>
              )}
            </select>
            {form.role_code ? (
              resolvedLevel ? (
                <p className="text-xs text-ink-muted">
                  Sits at <span className="font-medium text-ink">{resolvedLevel}</span>, with everyone else in this role.
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-xs text-warning-fg">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                  This role has no level yet, so this person can't be placed until it gets one.
                </p>
              )
            ) : (
              <p className="flex items-start gap-1.5 text-xs text-warning-fg">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                {member?.level_from === 'legacy' && member?.level_code
                  ? `Still on the old level (${levelTitle(member.level_code)}). Give them a role to place them properly.`
                  : "Without a role, a report naming this person can't be escalated."}
              </p>
            )}
            <p className="text-xs text-ink-subtle">
              To move someone, change their role. If the role itself is at the wrong level, change it in Roles &amp;
              Permissions — that moves everyone who holds it.
            </p>
            {!isCreate && (
              <p className="text-xs text-ink-subtle">Their account, if they have one, gets the same role.</p>
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
            <p className="text-xs text-ink-muted">
              Escalation goes to the direct manager first, before the level ladder. A manager has to sit above this person.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MemberEditorModal;
