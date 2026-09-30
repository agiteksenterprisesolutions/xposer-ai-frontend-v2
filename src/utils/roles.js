// src/utils/roles.js
import { hasStaffAccess } from './navigation';

// Staff: an account that can open some page of the staff area. Roles are
// organization-defined, so this is decided by permissions, not by role code.
export const isStaffUser = (user) =>
  Boolean(user) && !user.is_anonymous && hasStaffAccess(user);

// Any signed-in session that is tied to a real account — staff or reporter.
// Anonymous tracking tokens carry is_anonymous and are not identified.
export const isIdentifiedUser = (user) => Boolean(user) && !user.is_anonymous;

// Anonymous reporting is only genuinely anonymous from a session that carries no
// identity, so it stays open to logged-out visitors and anonymous tracking tokens
// only. Every logged-in account — compliance, reviewer, admin or reporter — has to
// log out first.
export const canSubmitAnonymousReport = (user) => !isIdentifiedUser(user);

// True when a signed-in account is looking at an organization it does not
// belong to — an Agiteks admin typing /abc into the address bar. Such a visit
// is moved to the same page under the account's own slug rather than being
// allowed to render another organization's pages under this session.
//
// Not applied to:
//   - super admins, who work across every organization;
//   - anonymous tracking tokens, which belong to a report rather than an
//     organization, and must not stop someone reporting to a second one;
//   - accounts with no organization_slug, where membership cannot be judged.
export const isOutsideOwnOrganization = (user, orgSlug) => {
  if (!orgSlug || !isIdentifiedUser(user)) return false;
  if (user.role === 'super_admin') return false;
  const ownSlug = user.organization_slug;
  if (!ownSlug) return false;
  return ownSlug.toLowerCase() !== String(orgSlug).toLowerCase();
};

// The same URL with the leading slug swapped for the account's own:
// /abc/admin/dashboard?tab=1 → /agiteks/admin/dashboard?tab=1. The rest of the
// path is kept so the page the user asked for is the one they get; the usual
// role guards then apply to it under the right organization.
export const toOwnOrganizationPath = (location, user) => {
  const [, ...rest] = location.pathname.split('/').filter(Boolean);
  const path = ['', user.organization_slug, ...rest].join('/');
  return `${path}${location.pathname.endsWith('/') && rest.length ? '/' : ''}${location.search}${location.hash}`;
};
