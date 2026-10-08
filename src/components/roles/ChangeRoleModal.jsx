// src/components/roles/ChangeRoleModal.jsx
//
// Move a user to another role. Their access changes on their very next
// request — the server resolves permissions per request — so when the user is
// the one signed in, our cached permissions are refetched straight away.
import { useState } from 'react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import RoleSelect from './RoleSelect';
import { usersAPI } from '../../api';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { describeError } from '../../utils/errors';

const ChangeRoleModal = ({ user, isSelf = false, onClose, onChanged }) => {
  const { nameFor } = useOrgRoles();
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const displayName = user.full_name || user.username;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await usersAPI.changeRole(user.id, role);
      toast.success(`${displayName} is now ${nameFor(role)}.`);
      if (isSelf) useAuthStore.getState().refreshUser();
      // `warnings` — e.g. assigned_cases_stranded: open cases they can no
      // longer work. The page shows them, since this modal closes.
      onChanged?.(role, Array.isArray(result?.warnings) ? result.warnings : []);
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
      title={`Change role for ${displayName}`}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} isLoading={saving} disabled={role === user.role}>
            Change role
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-secondary">
          Currently <span className="font-medium text-ink">{nameFor(user.role)}</span>. The new role's permissions
          apply from their next action — no sign-out needed.
        </p>

        <RoleSelect
          value={role}
          onChange={(event) => setRole(event.target.value)}
          aria-label="Role"
          className="w-full rounded-lg border border-line-strong bg-subtle p-2 text-sm text-ink"
        />

        {isSelf && (
          <Alert variant="warning" title="This is your own account">
            If the new role lacks a permission you are using now, you will lose access to it immediately.
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
      </div>
    </Modal>
  );
};

export default ChangeRoleModal;
