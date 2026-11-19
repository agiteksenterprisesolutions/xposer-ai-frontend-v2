// src/components/roles/ChangeRoleModal.jsx
//
// Move a user to another role. Their access changes on their very next
// request — the server resolves permissions per request — so when the user is
// the one signed in, our cached permissions are refetched straight away.
//
// A role marked `requires_entity` (the fixed entity admin, ENTITY_ADMIN.md §1)
// also needs the legal entity they run: an Entity selector appears and is
// required. The same dialog moves an entity admin to another entity. Picking
// any other role drops the entity on the server.
import { useEffect, useId, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import RoleSelect from './RoleSelect';
import { usersAPI } from '../../api';
import { entitiesAPI } from '../../api/entities';
import { localized } from '../../api/jurisdiction';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { describeError } from '../../utils/errors';

const ChangeRoleModal = ({ user, isSelf = false, onClose, onChanged }) => {
  const { t } = useTranslation('people');
  const { roles, nameFor } = useOrgRoles();
  const [role, setRole] = useState(user.role);
  const [entityCode, setEntityCode] = useState(user.entity_code || '');
  const [entities, setEntities] = useState(null);
  const [entityError, setEntityError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const entityId = useId();
  const displayName = user.full_name || user.username;
  const needsEntity = Boolean(roles.find((r) => r.code === role)?.requires_entity);

  // Active entities, loaded when a role that needs one is picked.
  useEffect(() => {
    if (!needsEntity || entities) return;
    entitiesAPI
      .list()
      .then((list) => setEntities(list.filter((e) => e.is_active !== false)))
      .catch(() => setEntities([]));
  }, [needsEntity, entities]);

  const changed = role !== user.role || (needsEntity && entityCode !== (user.entity_code || ''));

  const save = async () => {
    if (needsEntity && !entityCode) {
      setEntityError(t('changeRole.entityRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    setEntityError(null);
    try {
      const result = await usersAPI.changeRole(user.id, role, needsEntity ? entityCode : null);
      const entityName = needsEntity ? localized(entities?.find((e) => e.code === entityCode)?.name) || entityCode : null;
      toast.success(
        entityName
          ? t('changeRole.doneEntity', { name: displayName, role: nameFor(role), entity: entityName })
          : t('changeRole.done', { name: displayName, role: nameFor(role) }),
      );
      if (isSelf) useAuthStore.getState().refreshUser();
      // `warnings` — e.g. assigned_cases_stranded: open cases they can no
      // longer work. The page shows them, since this modal closes.
      onChanged?.(role, Array.isArray(result?.warnings) ? result.warnings : []);
    } catch (err) {
      const described = describeError(err);
      const code = err?.response?.data?.detail?.code || described.problems?.[0]?.code;
      if (code === 'entity_required') setEntityError(t('changeRole.entityRequired'));
      else if (code === 'unknown_entity') setEntityError(t('changeRole.entityUnknown'));
      else setError(described);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={t('changeRole.title', { name: displayName })}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={save} isLoading={saving} disabled={!changed}>
            {role === user.role && needsEntity ? t('changeRole.submitMove') : t('changeRole.submit')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-secondary">
          <Trans
            t={t}
            i18nKey="changeRole.current"
            values={{ role: nameFor(user.role) }}
            components={{ b: <span className="font-medium text-ink" /> }}
          />
        </p>

        <RoleSelect
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setEntityError(null);
          }}
          aria-label={t('changeRole.roleLabel')}
          className="w-full rounded-lg border border-line-strong bg-subtle p-2 text-sm text-ink"
        />

        {needsEntity && (
          <div className="space-y-1.5">
            <label htmlFor={entityId} className="block text-sm font-medium text-ink-secondary">
              {t('changeRole.entity')}
              <span className="ms-0.5 text-danger-fg" aria-hidden="true">*</span>
            </label>
            <select
              id={entityId}
              required
              value={entityCode}
              onChange={(e) => {
                setEntityCode(e.target.value);
                setEntityError(null);
              }}
              disabled={!entities}
              aria-invalid={entityError ? 'true' : undefined}
              aria-describedby={`${entityId}-desc`}
              className="w-full rounded-lg border border-line-strong bg-subtle p-2 text-sm text-ink"
            >
              <option value="">{entities ? t('changeRole.entityChoose') : t('common:status.loading')}</option>
              {(entities || []).map((e) => (
                <option key={e.code} value={e.code}>{localized(e.name)} ({e.code})</option>
              ))}
            </select>
            <p id={`${entityId}-desc`} className={`text-xs ${entityError ? 'text-danger-fg' : 'text-ink-muted'}`}>
              {entityError || (entities?.length === 0 ? t('changeRole.entityNone') : t('changeRole.entityHint'))}
            </p>
          </div>
        )}

        {isSelf && (
          <Alert variant="warning" title={t('changeRole.selfTitle')}>
            {t('changeRole.selfBody')}
          </Alert>
        )}

        {error && (
          <Alert variant="error" title={error.summary}>
            {error.problems.length > 0 && (
              <ul className="list-disc space-y-1 ps-4">
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
