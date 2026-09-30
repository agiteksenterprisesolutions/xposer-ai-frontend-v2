// src/components/roles/DeleteRoleModal.jsx
//
// Deleting a role can be refused for two reasons, both 409s worth explaining
// rather than retrying: active users still hold it (offer the filtered user
// list, so they can be reassigned), or it is the last role that can manage
// roles (deleting it would lock the organization out of this screen).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { orgRolesAPI } from '../../api/orgRoles';
import { invalidateOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { useCan } from '../../hooks/useCan';
import { ACCESS } from '../../utils/permissions';
import { staffPath } from '../../utils/navigation';
import { describeError } from '../../utils/errors';

const StillAssigned = /user\(s\)|\busers?\b.*(still|reassign)/i;

const DeleteRoleModal = ({ role, onClose, onDeleted }) => {
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const can = useCan();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await orgRolesAPI.remove(role.id);
      toast.success(`Role "${role.name}" deleted.`);
      invalidateOrgRoles();
      useAuthStore.getState().refreshUser();
      onDeleted?.(role);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setDeleting(false);
    }
  };

  const assignedUsersBlock = error?.status === 409 && StillAssigned.test(error.summary);

  return (
    <Modal
      isOpen
      onClose={deleting ? () => {} : onClose}
      title={`Delete ${role.name}?`}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            {error ? 'Close' : 'Cancel'}
          </Button>
          {!error && (
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete role
            </Button>
          )}
        </div>
      }
    >
      {!error ? (
        <p className="text-sm leading-relaxed text-ink-secondary">
          The <span className="font-mono text-ink">{role.code}</span> role will be removed from your organization.
          This cannot be undone.
        </p>
      ) : (
        <Alert variant={error.status === 409 ? 'warning' : 'error'} title="This role can't be deleted yet">
          <p>{error.summary}</p>
          {assignedUsersBlock && can(ACCESS.users) && (
            <Link
              to={`${staffPath(orgSlug, 'users')}?role=${encodeURIComponent(role.code)}`}
              className="mt-2 inline-block font-medium text-link hover:underline"
            >
              See who has this role →
            </Link>
          )}
        </Alert>
      )}
    </Modal>
  );
};

export default DeleteRoleModal;
