// src/components/roles/RoleEditorModal.jsx
//
// Create, edit or (for the fixed admin role) view a role.
//
// Every role sits at one hierarchy level, and every holder of the role sits
// there with it: the Level picker is how a person is placed in the org chart.
// It is required once the organization has any level, editable on the fixed
// roles too (admin and reporter — their name and permissions are not), and
// moving an existing role asks first, since it moves everyone who holds it.
//
// The checkbox tree is built from GET /org-roles/permissions, never from a
// hardcoded list, and validated in two layers:
//   - locally, from each permission's `requires_any_of`, so ticking a box gives
//     instant feedback;
//   - on a debounce against POST /org-roles/validate, so the messages shown are
//     the exact sentences a save would produce.
// Errors block the save. Warnings never do — an organization may want
// something unusual — except that granting role:manage asks for a confirm,
// because its holders can rewrite their own permissions.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import { orgRolesAPI } from '../../api/orgRoles';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { usersAPI } from '../../api/users';
import { sortLevels } from '../../utils/roleLevels';
import { invalidateOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { PERM, permissionLabels, togglePermissionIn } from '../../utils/permissions';
import { CODE_HINT, CODE_PATTERN, suggestCode } from '../../utils/codes';
import PermissionPicker, { Checkbox, catalogEntries, localPrerequisiteErrors } from './PermissionPicker';
import { describeError } from '../../utils/errors';

// Structural codes an organization cannot define for itself.
const RESERVED_CODES = ['admin', 'reporter'];
// Warnings about one checkbox sit beside it; the rest sit beside Save.
const INLINE_WARNING_CODES = new Set(['redundant', 'advisory']);
const VALIDATE_DEBOUNCE_MS = 350;

const setKey = (permissions) => [...permissions].sort().join(',');

/** Which level the role sits at — and so where everyone holding it sits. */
const LevelField = ({ levels, value, onChange, disabled, missing, currentTitle }) => {
  if (levels === null) return null;
  if (levels.length === 0) {
    return (
      <p className="rounded-lg bg-subtle px-3 py-2.5 text-xs text-ink-muted">
        No hierarchy levels yet. Once you add levels under Reporting Hierarchy, give this role one — it decides where its
        holders sit in the org chart.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      <label htmlFor="role-level" className="block text-sm font-medium text-ink-secondary">
        Level
      </label>
      <select
        id="role-level"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={missing}
        className={`h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink outline-none focus:border-line-accent disabled:cursor-not-allowed disabled:bg-subtle ${
          missing ? 'border-warning-line' : 'border-line-strong'
        }`}
      >
        <option value="">Choose a level…</option>
        {levels.map((level) => (
          <option key={level.code} value={level.code}>
            {level.title}
          </option>
        ))}
        {value && !levels.some((l) => l.code === value) && <option value={value}>{currentTitle || value}</option>}
      </select>
      <p className={`text-xs ${missing ? 'text-warning-fg' : 'text-ink-muted'}`}>
        {missing
          ? 'Not placed yet — nobody holding this role can appear in the org chart until it has a level.'
          : 'Everyone holding this role sits at this level in the org chart. Several roles can share a level.'}
      </p>
    </div>
  );
};

/**
 * Props:
 *   role     – the role to edit or view; omit to create one
 *   catalog  – GET /org-roles/permissions
 *   readOnly – show the role without editing (fixed roles always are)
 *   onClose  – dismiss without saving
 *   onSaved  – called with the saved role
 */
const RoleEditorModal = ({ role = null, catalog, readOnly: viewOnly = false, onClose, onSaved }) => {
  const isCreate = !role;
  const isFixed = Boolean(role?.is_fixed);
  // Name, permissions and active state. A fixed role's level stays editable.
  const readOnly = isFixed || viewOnly;

  const [name, setName] = useState(role?.name || '');
  const [code, setCode] = useState(role?.code || '');
  const [codeTouched, setCodeTouched] = useState(false);
  const [isActive, setIsActive] = useState(role?.is_active ?? true);
  const [selected, setSelected] = useState(() => new Set(role?.permissions || []));
  const [validation, setValidation] = useState({ key: null, result: null });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmingEscalation, setConfirmingEscalation] = useState(false);
  const [levelCode, setLevelCode] = useState(role?.level_code || '');
  const [levels, setLevels] = useState(null); // null while loading
  // A level move, waiting for the admin to confirm: { from, to, holders }.
  const [confirmingMove, setConfirmingMove] = useState(null);
  // 409 level_move_inverts_chain: the people the move would put at or above their manager.
  const [conflicts, setConflicts] = useState([]);

  // The ladder to choose from. Quiet: a role editor without hierarchy access
  // still works, and a 400 level_required brings the choices with it.
  useEffect(() => {
    let live = true;
    orgHierarchyAPI
      .listLevels({ activeOnly: true, quiet: true })
      .then((data) => live && setLevels(sortLevels(Array.isArray(data) ? data : [])))
      .catch(() => live && setLevels([]));
    return () => {
      live = false;
    };
  }, []);
  const levelTitle = (code) => levels?.find((l) => l.code === code)?.title || role?.level_title || code;
  const levelChanged = !isCreate && levelCode !== (role.level_code || '');
  // Required as soon as any level exists; optional only on an empty ladder.
  const levelMissing = Boolean(levels?.length) && !levelCode;

  const entries = useMemo(() => catalogEntries(catalog), [catalog]);
  const currentKey = setKey(selected);

  // Suggest a code from the name until the user edits the code themselves.
  useEffect(() => {
    if (isCreate && !codeTouched) setCode(suggestCode(name, 'role'));
  }, [name, isCreate, codeTouched]);

  // The server's verdict on the current set, fetched once ticking settles. A
  // response for a set the user has since changed is dropped, so a slow reply
  // can never overwrite a newer one.
  const latestKey = useRef(currentKey);
  latestKey.current = currentKey;
  useEffect(() => {
    if (readOnly) return undefined;
    const requestKey = currentKey;
    const timer = setTimeout(async () => {
      try {
        const result = await orgRolesAPI.validate(requestKey ? requestKey.split(',') : []);
        if (latestKey.current === requestKey) setValidation({ key: requestKey, result });
      } catch {
        // Local checks still stand; the save is the final word anyway.
      }
    }, VALIDATE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [currentKey, readOnly]);

  const serverResult = validation.key === currentKey ? validation.result : null;

  // Prerequisites the local check can already see are missing.
  const localErrors = useMemo(() => localPrerequisiteErrors(selected, entries), [selected, entries]);

  // Server messages win where they exist — they are the sentences a save
  // would return, written for whoever is looking at the screen.
  const errorsByPermission = useMemo(() => {
    const merged = new Map(localErrors);
    (serverResult?.errors || []).forEach((error) => {
      if (error.permission) {
        merged.set(error.permission, { requires: error.requires || merged.get(error.permission)?.requires || [], message: error.message });
      }
    });
    return merged;
  }, [localErrors, serverResult]);

  const unplacedErrors = (serverResult?.errors || []).filter((error) => !error.permission || !selected.has(error.permission));
  const warnings = serverResult?.warnings || [];
  const inlineWarnings = new Map(
    warnings.filter((w) => w.permission && INLINE_WARNING_CODES.has(w.code)).map((w) => [w.permission, w.message]),
  );
  const saveWarnings = warnings.filter((w) => !(w.permission && INLINE_WARNING_CODES.has(w.code)));

  const addsRoleManage = selected.has(PERM.roleManage) && !(role?.permissions || []).includes(PERM.roleManage);

  const codeError = (() => {
    if (!isCreate) return null;
    if (!code) return 'A code is required.';
    if (!CODE_PATTERN.test(code)) return CODE_HINT;
    if (RESERVED_CODES.includes(code)) return `"${code}" is reserved.`;
    return null;
  })();

  const isDirty =
    isCreate ||
    levelChanged ||
    (!isFixed &&
      (name.trim() !== role.name || isActive !== (role.is_active ?? true) || currentKey !== setKey(role.permissions || [])));

  const blocked = isFixed
    ? levelMissing
    : errorsByPermission.size > 0 || serverResult?.valid === false || !name.trim() || Boolean(codeError) || levelMissing;

  const toggle = (permission) => {
    setSaveError(null);
    setConfirmingEscalation(false);
    setSelected((prev) => togglePermissionIn(prev, permission));
  };

  const add = (permission) => {
    setSelected((prev) => new Set(prev).add(permission));
  };

  const save = async () => {
    if (blocked || saving) return;
    if (!isFixed && addsRoleManage && !confirmingEscalation) {
      setConfirmingEscalation(true);
      return;
    }
    // Moving a role moves every holder in the org chart: say how many first.
    if (levelChanged && !confirmingMove) {
      setSaving(true);
      const holders = await usersAPI
        .getAllUsers({ role: role.code, page: 1, page_size: 1 })
        .then((data) => (typeof data?.total === 'number' ? data.total : null))
        .catch(() => null);
      setSaving(false);
      setConfirmingMove({ from: role.level_code, to: levelCode, holders });
      return;
    }

    setSaving(true);
    setSaveError(null);
    setConflicts([]);
    const permissions = [...selected];
    try {
      const saved = isCreate
        ? await orgRolesAPI.create({ code, name: name.trim(), permissions, level_code: levelCode || null })
        : isFixed
          ? // Only the level of admin and reporter may change; sending anything else is a 409.
            await orgRolesAPI.update(role.id, { level_code: levelCode || null })
          : await orgRolesAPI.update(role.id, {
              name: name.trim(),
              permissions,
              is_active: isActive,
              ...(levelChanged ? { level_code: levelCode || null } : {}),
            });

      toast.success(isCreate ? `Role "${name.trim()}" created.` : `Role "${name.trim()}" saved.`);

      // saved.warnings are shown on the roles page, which stays open after this closes.
      invalidateOrgRoles();
      // The change applies on the server's next request; our copy of the
      // signed-in user's permissions has to be told.
      useAuthStore.getState().refreshUser();
      onSaved?.(saved);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      // 400 level_required carries the levels to choose from.
      if (detail?.code === 'level_required' && Array.isArray(detail.available_levels) && !levels?.length) {
        setLevels(sortLevels(detail.available_levels));
      }
      if (detail?.code === 'level_move_inverts_chain') setConflicts(Array.isArray(detail.conflicts) ? detail.conflicts : []);
      setSaveError(describeError(error));
      setConfirmingEscalation(false);
      setConfirmingMove(null);
    } finally {
      setSaving(false);
    }
  };

  const title = isCreate ? 'New role' : readOnly ? role.name : `Edit ${role.name}`;

  const footer = viewOnly ? (
    <div className="flex justify-end">
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </div>
  ) : (
    <div className="space-y-3">
      {saveWarnings.length > 0 && !confirmingEscalation && (
        <div className="space-y-1.5">
          {saveWarnings.map((warning, index) => (
            <p key={`${warning.code}-${index}`} className="flex items-start gap-2 text-xs text-warning-fg">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{warning.message}</span>
            </p>
          ))}
        </div>
      )}

      {confirmingMove && (
        <Alert variant="warning" title="Move everyone who holds this role?">
          Moving {role.name} from {confirmingMove.from ? levelTitle(confirmingMove.from) : 'no level'} to{' '}
          {confirmingMove.to ? levelTitle(confirmingMove.to) : 'no level'} will move{' '}
          {confirmingMove.holders == null
            ? 'everyone who holds it'
            : confirmingMove.holders === 1
              ? 'the 1 person who holds it'
              : `all ${confirmingMove.holders} people who hold it`}{' '}
          in the org chart.
        </Alert>
      )}

      {confirmingEscalation && (
        <Alert variant="warning" title="This role will be able to manage roles">
          Anyone holding it can rewrite every role's permissions — including their own. Only give it to people you
          would trust with your own access.
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-subtle">
          {!isFixed && (
            <>
              {selected.size} permission{selected.size === 1 ? '' : 's'} selected
              {!serverResult && selected.size > 0 && ' · checking…'}
            </>
          )}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={
              confirmingMove
                ? () => setConfirmingMove(null)
                : confirmingEscalation
                  ? () => setConfirmingEscalation(false)
                  : onClose
            }
            disabled={saving}
          >
            {confirmingEscalation || confirmingMove ? 'Back' : 'Cancel'}
          </Button>
          <Button onClick={save} isLoading={saving} disabled={blocked || !isDirty}>
            {confirmingMove ? 'Move them' : confirmingEscalation ? 'Save anyway' : isCreate ? 'Create role' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Modal isOpen onClose={saving ? () => {} : onClose} title={title} size="xl" footer={footer} closeOnOverlayClick={false}>
      <div className="space-y-5">
        {role?.is_fixed && (
          <Alert variant="dark" title="Fixed role">
            {role.code === 'reporter'
              ? `${role.name} is the public self-service role: it files and tracks its own reports. Its permissions are fixed and it can't be deleted.`
              : `${role.name} is the organization's root role. It always holds every permission this organization can grant, and can't be deleted.`}{' '}
            {!viewOnly && 'Only its level in the hierarchy can be changed.'}
          </Alert>
        )}

        {saveError && (
          <Alert variant="error" title={saveError.summary}>
            {saveError.problems.length > 0 && (
              <ul className="list-disc space-y-1 pl-4">
                {saveError.problems.map((problem, index) => (
                  <li key={index}>{problem.message}</li>
                ))}
              </ul>
            )}
            {conflicts.length > 0 && (
              <>
                <ul className="list-disc space-y-1 pl-4">
                  {conflicts.map((conflict, index) => (
                    <li key={index}>{conflict}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">Choose another level, or change those reporting lines in the hierarchy first.</p>
              </>
            )}
          </Alert>
        )}

        {!readOnly && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
              placeholder="e.g. Finance lead"
            />
            <Input
              label="Code"
              value={code}
              onChange={(event) => {
                setCodeTouched(true);
                setCode(event.target.value);
              }}
              readOnly={!isCreate}
              required={isCreate}
              error={codeError}
              className="font-mono"
              helperText={
                isCreate
                  ? 'Users, agents and workflows refer to the role by this. It cannot be changed later.'
                  : 'Codes cannot change — users, agents and workflows refer to the role by it.'
              }
            />
          </div>
        )}

        <LevelField
          levels={levels}
          value={levelCode}
          onChange={(code) => {
            setLevelCode(code);
            setConfirmingMove(null);
            setSaveError(null);
          }}
          disabled={viewOnly}
          missing={levelMissing}
          currentTitle={role?.level_title}
        />

        {!isCreate && !readOnly && (
          <label className="flex items-start gap-3">
            <Checkbox checked={isActive} onChange={() => setIsActive((value) => !value)} labelledBy="role-active-label" />
            <span>
              <span id="role-active-label" className="block text-sm font-medium text-ink">
                Active
              </span>
              <span className="block text-xs text-ink-muted">
                An inactive role cannot be given to anyone. Users who already hold it keep it until reassigned.
              </span>
            </span>
          </label>
        )}

        {unplacedErrors.length > 0 && (
          <Alert variant="error" title="This set of permissions can't be saved">
            <ul className="list-disc space-y-1 pl-4">
              {unplacedErrors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-sm font-semibold text-ink">Permissions</h4>
            {!readOnly && (
              <p className="text-xs text-ink-subtle">
                <Lock className="-mt-0.5 mr-1 inline h-3 w-3" />
                You can only grant permissions you hold yourself.
              </p>
            )}
          </div>

          <PermissionPicker
            catalog={catalog}
            selected={selected}
            onToggle={toggle}
            onAdd={add}
            errorsByPermission={errorsByPermission}
            warningsByPermission={inlineWarnings}
            readOnly={readOnly}
          />
        </div>

        {!readOnly && selected.size > 0 && serverResult?.not_grantable?.length > 0 && (
          <p className="text-xs text-ink-muted">
            <Badge variant="warning" size="small" className="mr-1.5">
              Not grantable
            </Badge>
            {permissionLabels(serverResult.not_grantable, ', ')} — you don't hold{' '}
            {serverResult.not_grantable.length === 1 ? 'it' : 'them'},
            so saving will be refused.
          </p>
        )}
      </div>
    </Modal>
  );
};

export default RoleEditorModal;
