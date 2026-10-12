// src/utils/roleLevels.js
//
// A hierarchy level is a property of a role, not of a person: each role sits
// at one level (`level_code`, with `level_title` and `level_rank` sent
// alongside), and every holder of the role sits there. Two roles may share a
// level; one role is never at two. These helpers keep every screen ordering
// and labelling roles the same way.

/** Most senior first; roles with no level last; then by name. */
export const byLevelThenName = (a, b) => {
  const ra = a?.level_rank ?? -Infinity;
  const rb = b?.level_rank ?? -Infinity;
  if (ra !== rb) return rb - ra;
  return String(a?.name || a?.code || '').localeCompare(String(b?.name || b?.code || ''));
};

export const sortRolesByLevel = (roles = []) => [...roles].sort(byLevelThenName);

/** "Officer · Senior", so the consequence of picking a role is visible. */
export const roleWithLevel = (role) =>
  role ? `${role.name || role.code} · ${role.level_title || 'no level'}` : '';

/** A role that can't place anyone in the chart. */
export const isUnplacedRole = (role) => Boolean(role) && !role.level_code;

/** Levels as the API lists them, most senior first. */
export const sortLevels = (levels = []) => [...levels].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
