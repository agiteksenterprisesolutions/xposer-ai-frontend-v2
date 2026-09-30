import { Navigate, Outlet, useParams } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

const RequireOrgSlug = () => {
  const { user } = useAuthStore();
  const { orgSlug } = useParams();

  if (user?.organization_slug && user?.organization_slug !== orgSlug) {
    return <Navigate to={`${user ? `/${user.organization_slug}/` : '/' }`} replace />;
  }

  return <Outlet />;
};

export default RequireOrgSlug;