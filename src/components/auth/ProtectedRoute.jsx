import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../layout/LoadingSpinner';
import NoAccess from './NoAccess';
import { isOutsideOwnOrganization, toOwnOrganizationPath } from '../../utils/roles';
import { satisfies, getPermissions } from '../../utils/permissions';
import { getHomePath } from '../../utils/navigation';
import { SET_PASSWORD_PATH, mustChangePassword } from '../../utils/passwordPolicy';

// `access` is a rule from ACCESS ({ all, any }) or a predicate on the user.
const isAllowed = (user, access) => {
  if (!access) return true;
  if (typeof access === 'function') return access(user);
  return satisfies(getPermissions(user), access);
};

/**
 * Waits for the signed-in user's permissions, then renders children only when
 * `access` is satisfied. Assumes authentication was already checked by an
 * enclosing ProtectedRoute. A denied user sees the NoAccess state in place of
 * the page, inside whatever layout surrounds it.
 */
export const RequireAccess = ({ access, children }) => {
  const { user, permissionsStatus, refreshUser } = useAuthStore();
  const permissionsKnown = Array.isArray(user?.permissions) || permissionsStatus === 'error';

  // Normally already fetched on app start; this covers a session restored
  // from storage before /users/me came back.
  useEffect(() => {
    if (!permissionsKnown && permissionsStatus !== 'loading') refreshUser();
  }, [permissionsKnown, permissionsStatus, refreshUser]);

  if (!permissionsKnown) {
    return <LoadingSpinner message="Loading your access..." />;
  }

  if (!isAllowed(user, access)) return <NoAccess />;

  return children;
};

/**
 * ProtectedRoute
 *
 * Wraps a route that requires a signed-in account and, optionally, some access.
 * Access is always a permission question — roles are organization-defined and
 * are never compared here.
 *
 * Props:
 *   children          – the protected page/component
 *   access            – a rule from ACCESS, or (user) => boolean
 *   redirectIfDenied  – send a denied user to their own home page instead of
 *                       showing NoAccess (for whole areas, e.g. a staff member
 *                       following a link into the reporter portal)
 *   allowAnonymous    – if true, anonymous (reporter) tokens are allowed through
 */
const ProtectedRoute = ({ children, access, redirectIfDenied = false, allowAnonymous = false }) => {
    const { isAuthenticated, user, isLoading } = useAuthStore();
    const location = useLocation();
    const { orgSlug } = useParams();

    if (isLoading) {
        return <LoadingSpinner message="Checking authentication..." />;
    }

    if (!isAuthenticated) {
        const slug = user?.organization_slug || orgSlug;
        return <Navigate to={slug ? `/${slug}/login` : '/login'} state={{ from: location }} replace />;
    }

    // Still on the default password: every call but three would 403, so
    // nothing behind this route is rendered until it is replaced.
    if (mustChangePassword(user)) {
        return <Navigate to={SET_PASSWORD_PATH} replace />;
    }

    // A dashboard under another organization's slug: the account does not
    // belong there, so move it to the same page under its own slug.
    if (isOutsideOwnOrganization(user, orgSlug)) {
        return <Navigate to={toOwnOrganizationPath(location, user)} replace />;
    }

    // Block anonymous trackers from authenticated-only areas
    if (user?.is_anonymous && !allowAnonymous) {
        return <Navigate to={`/${user?.organization_slug}/track-report`} replace />;
    }

    if (redirectIfDenied && Array.isArray(user?.permissions) && !isAllowed(user, access)) {
        const home = getHomePath(user);
        if (home && home !== location.pathname) return <Navigate to={home} replace />;
    }

    if (user?.is_anonymous) return children;

    return <RequireAccess access={access}>{children}</RequireAccess>;
};

export default ProtectedRoute;
