// src/components/roles/RoleEditorModal.jsx
//
// Create, edit or (for the fixed admin role) view a role.
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
import { invalidateOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { PERM, permissionLabels } from '../../utils/permissions';
import { CODE_HINT, CODE_PATTERN, suggestCode } from '../../utils/codes';
import PermissionPicker, { Checkbox, catalogEntries, localPrerequisiteErrors } from './PermissionPicker';
import { describeError } from '../../utils/errors';

// Structural codes an organization cannot define for itself.
const RESERVED_CODES = ['admin', 'reporter'];
// Warnings about one checkbox sit beside it; the rest sit beside Save.
const INLINE_WARNING_CODES = new Set(['redundant', 'advisory']);
const VALIDATE_DEBOUNCE_MS = 350;

const setKey = (permissions) => [...permissions].sort().join(',');

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
  const readOnly = Boolean(role?.is_fixed) || viewOnly;

  const [name, setName] = useState(role?.name || '');
  const [code, setCode] = useState(role?.code || '');
  const [codeTouched, setCodeTouched] = useState(false);
  const [isActive, setIsActive] = useState(role?.is_active ?? true);
  const [selected, setSelected] = useState(() => new Set(role?.permissions || []));
  const [validation, setValidation] = useState({ key: null, result: null });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmingEscalation, setConfirmingEscalation] = useState(false);

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
    name.trim() !== role.name ||
    isActive !== (role.is_active ?? true) ||
    currentKey !== setKey(role.permissions || []);

  const blocked =
    errorsByPermission.size > 0 || serverResult?.valid === false || !name.trim() || Boolean(codeError);

  const toggle = (permission) => {
    setSaveError(null);
    setConfirmingEscalation(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  };

  const add = (permission) => {
    setSelected((prev) => new Set(prev).add(permission));
  };

  const save = async () => {
    if (blocked || saving) return;
    if (addsRoleManage && !confirmingEscalation) {
      setConfirmingEscalation(true);
      return;
    }

    setSaving(true);
    setSaveError(null);
    const permissions = [...selected];
    try {
      const saved = isCreate
        ? await orgRolesAPI.create({ code, name: name.trim(), permissions })
        : await orgRolesAPI.update(role.id, { name: name.trim(), permissions, is_active: isActive });

      toast.success(isCreate ? `Role "${name.trim()}" created.` : `Role "${name.trim()}" saved.`);
      (saved?.warnings || []).forEach((warning) => toast.warning(warning.message));

      invalidateOrgRoles();
      // The change applies on the server's next request; our copy of the
      // signed-in user's permissions has to be told.
      useAuthStore.getState().refreshUser();
      onSaved?.(saved);
    } catch (error) {
      setSaveError(describeError(error));
      setConfirmingEscalation(false);
    } finally {
      setSaving(false);
    }
  };

  const title = isCreate ? 'New role' : readOnly ? role.name : `Edit ${role.name}`;

  const footer = readOnly ? (
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

      {confirmingEscalation && (
        <Alert variant="warning" title="This role will be able to manage roles">
          Anyone holding it can rewrite every role's permissions — including their own. Only give it to people you
          would trust with your own access.
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-subtle">
          {selected.size} permission{selected.size === 1 ? '' : 's'} selected
          {!serverResult && selected.size > 0 && ' · checking…'}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={confirmingEscalation ? () => setConfirmingEscalation(false) : onClose}
            disabled={saving}
          >
            {confirmingEscalation ? 'Back' : 'Cancel'}
          </Button>
          <Button onClick={save} isLoading={saving} disabled={blocked || !isDirty}>
            {confirmingEscalation ? 'Save anyway' : isCreate ? 'Create role' : 'Save changes'}
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
            {role.name} is the organization's root role. It always holds every permission this organization can
            grant, and cannot be edited or deleted.
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
