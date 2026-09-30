// src/components/roles/RoleSelect.jsx
//
// A role picker filled from GET /org-roles/ — never a hardcoded list, since an
// organization names and invents its own roles. Reporter is offered
// separately: it is the self-service identity, not one of the organization's
// staff roles, so the endpoint never lists it.
import { REPORTER_ROLE, useOrgRoles } from '../../hooks/useOrgRoles';

const RoleSelect = ({ value, onChange, name = 'role', includeReporter = true, disabled = false, className = '', ...props }) => {
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
      {includeReporter && <option value={REPORTER_ROLE}>Reporter (self-service)</option>}
      {roles.length > 0 && (
        <optgroup label="Organization roles">
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.name}
            </option>
          ))}
        </optgroup>
      )}
      {!listed && value && !loading && <option value={value}>{nameFor(value)} (inactive)</option>}
      {loading && <option disabled>Loading roles…</option>}
      {error && <option disabled>Couldn't load roles</option>}
    </select>
  );
};

export default RoleSelect;
