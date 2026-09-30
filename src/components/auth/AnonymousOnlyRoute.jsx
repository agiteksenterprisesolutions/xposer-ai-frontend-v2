import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../layout/LoadingSpinner';
import { isIdentifiedUser } from '../../utils/roles';
import { getHomePath } from '../../utils/navigation';

/**
 * AnonymousOnlyRoute
 *
 * Guards the anonymous reporting flow. Only logged-out visitors and anonymous
 * tracking tokens pass through; every signed-in account — staff or reporter —
 * is sent back to its home page and has to log out to file an anonymous report.
 */
const AnonymousOnlyRoute = ({ children }) => {
  const { user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner message="Checking authentication..." />;
  }

  if (isIdentifiedUser(user)) {
    const orgHome = user?.organization_slug ? `/${user.organization_slug}` : '/';
    return (
      <Navigate
        to={getHomePath(user) || orgHome}
        state={{ from: location, anonymousOnly: true }}
        replace
      />
    );
  }

  return children;
};

export default AnonymousOnlyRoute;
