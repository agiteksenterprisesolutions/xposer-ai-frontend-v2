// src/components/roles/RoleSelect.jsx
//
// A role picker filled from GET /org-roles/ — never a hardcoded list, since an
// organization names and invents its own roles. Reporter is offered
// separately: it is the self-service identity, not one of the organization's
// staff roles, so the endpoint never lists it.
import { useTranslation } from 'react-i18next';
import { REPORTER_ROLE, useOrgRoles } from '../../hooks/useOrgRoles';

const RoleSelect = ({ value, onChange, name = 'role', includeReporter = true, disabled = false, className = '', ...props }) => {
  const { t } = useTranslation('people');
  const { roles, nameFor, loading, error } = useOrgRoles();
  // A user may hold a role that has since been deactivated; keep it visible
  // rather than silently showing a different selection.
  const listed = value === REPORTER_ROLE || roles.some((role) => role.code === value);

  return (
    <select
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {includeReporter && <option value={REPORTER_ROLE}>{t('roleSelect.reporter')}</option>}
      {roles.length > 0 && (
        <optgroup label={t('roleSelect.orgRoles')}>
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.name}
            </option>
          ))}
        </optgroup>
      )}
      {!listed && value && !loading && <option value={value}>{t('roleSelect.inactive', { name: nameFor(value) })}</option>}
      {loading && <option disabled>{t('roleSelect.loading')}</option>}
      {error && <option disabled>{t('roleSelect.error')}</option>}
    </select>
  );
};

export default RoleSelect;
