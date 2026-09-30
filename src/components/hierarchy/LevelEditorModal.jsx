// src/components/hierarchy/LevelEditorModal.jsx
//
// Create or edit one rung of the reporting hierarchy.
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import TagInput from '../ui/TagInput';
import { Checkbox } from '../roles/PermissionPicker';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { CODE_HINT, CODE_PATTERN, suggestCode } from '../../utils/codes';
import { describeError } from '../../utils/errors';

const selectClass =
  'w-full rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink hover:border-line-strong disabled:opacity-60';

/**
 * Props:
 *   level       – the level to edit; omit to create one
 *   defaultRank – suggested rank for a new level
 *   readOnly, onClose, onSaved
 */
const LevelEditorModal = ({ level = null, defaultRank = 10, readOnly = false, onClose, onSaved }) => {
  const isCreate = !level;
  const { roles } = useOrgRoles();

  const [title, setTitle] = useState(level?.title || '');
  const [code, setCode] = useState(level?.code || '');
  const [codeTouched, setCodeTouched] = useState(false);
  const [rank, setRank] = useState(String(level?.rank ?? defaultRank));
  const [department, setDepartment] = useState(level?.department || '');
  const [aliases, setAliases] = useState(level?.designation_aliases || []);
  const [escalationRole, setEscalationRole] = useState(level?.escalation_role || '');
  const [isActive, setIsActive] = useState(level?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isCreate && !codeTouched) setCode(suggestCode(title, 'level'));
  }, [title, isCreate, codeTouched]);

  const rankNumber = Number(rank);
  const rankError = rank === '' || !Number.isInteger(rankNumber) ? 'A whole number. Higher is more senior.' : null;
  const codeError = isCreate ? (!code ? 'A code is required.' : !CODE_PATTERN.test(code) ? CODE_HINT : null) : null;
  const blocked = !title.trim() || Boolean(rankError) || Boolean(codeError);

  const save = async () => {
    if (blocked || saving) return;
    setSaving(true);
    setError(null);
    const body = {
      title: title.trim(),
      rank: rankNumber,
      department: department.trim() || null,
      designation_aliases: aliases,
      escalation_role: escalationRole || null,
    };
    try {
      const saved = isCreate
        ? await orgHierarchyAPI.createLevel({ ...body, code })
        : await orgHierarchyAPI.updateLevel(level.id, { ...body, is_active: isActive });
      toast.success(isCreate ? `Level "${body.title}" added.` : `Level "${body.title}" saved.`);
      onSaved?.(saved);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={isCreate ? 'New level' : readOnly ? level.title : `Edit ${level.title}`}
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
            <Button onClick={save} isLoading={saving} disabled={blocked}>
              {isCreate ? 'Add level' : 'Save changes'}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
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
            label="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            readOnly={readOnly}
            placeholder="e.g. Finance Manager"
          />
          <Input
            label="Code"
            value={code}
            onChange={(event) => {
              setCodeTouched(true);
              setCode(event.target.value);
            }}
            readOnly={!isCreate || readOnly}
            required={isCreate}
            error={codeError}
            className="font-mono"
            helperText={isCreate ? 'Directory entries refer to the level by this. It cannot be changed later.' : 'Codes cannot change.'}
          />
          <Input
            label="Rank"
            type="number"
            step="1"
            value={rank}
            onChange={(event) => setRank(event.target.value)}
            readOnly={readOnly}
            error={rankError}
            helperText="Higher is more senior. Leave gaps (10, 20, 30) so a level can be slotted in later."
          />
          <Input
            label="Department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            readOnly={readOnly}
            placeholder="Leave empty for organization-wide"
            helperText="Restricts the level to one department. Empty means it applies everywhere."
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">Job titles from your HR system</p>
          <p className="text-xs text-ink-muted">
            The exact titles your HR system uses for people at this level — e.g. "Finance Manager" and "Sr. Finance
            Manager". During a sync, anyone whose title matches one of these is placed on this level.
          </p>
          <TagInput
            value={aliases}
            onChange={setAliases}
            readOnly={readOnly}
            placeholder="Type a job title and press Enter"
            emptyText="No job titles yet — people can still be placed on this level by hand."
            ariaLabel="Job titles"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="level-escalation-role" className="text-sm font-medium text-ink">
            Escalation role
          </label>
          <select
            id="level-escalation-role"
            value={escalationRole}
            onChange={(event) => setEscalationRole(event.target.value)}
            disabled={readOnly}
            className={selectClass}
          >
            <option value="">None</option>
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
            {escalationRole && !roles.some((role) => role.code === escalationRole) && (
              <option value={escalationRole}>{escalationRole}</option>
            )}
          </select>
          <p className="text-xs text-ink-muted">
            Optional. The role a report is routed to when it escalates to this level — the same role report types name as
            their default owner.
          </p>
        </div>

        {!isCreate && (
          <label className="flex items-start gap-3">
            <Checkbox
              checked={isActive}
              disabled={readOnly}
              onChange={() => setIsActive((value) => !value)}
              labelledBy="level-active-label"
            />
            <span>
              <span id="level-active-label" className="block text-sm font-medium text-ink">
                Active
              </span>
              <span className="block text-xs text-ink-muted">An inactive level is ignored when resolving escalations.</span>
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
};

export default LevelEditorModal;
