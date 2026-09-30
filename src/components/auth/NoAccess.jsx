import { useNavigate } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import Button from '../ui/Button';
import { useAuthStore } from '../../store/authStore';
import { getHomePath } from '../../utils/navigation';

/**
 * Shown in place of a page the signed-in user cannot open — a deep link, a
 * stale tab, or a role that lost a permission since the page was last loaded.
 * A quiet explanation rather than an error toast over a blank screen.
 */
const NoAccess = ({
  title = "You don't have access to this page",
  message = 'Your role does not include the permission this page needs. If you think it should, ask an administrator to update your role.',
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const home = getHomePath(user);
  const onHomeAlready = home && home === window.location.pathname;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sunken">
        <ShieldOff className="h-6 w-6 text-ink-muted" />
      </div>
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        {home ? message : 'Your account does not have access to any part of this workspace yet. Ask an administrator to assign you a role.'}
      </p>
      <div className="mt-6">
        {home && !onHomeAlready ? (
          <Button variant="secondary" onClick={() => navigate(home, { replace: true })}>
            Go to your dashboard
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              logout();
              navigate(user?.organization_slug ? `/${user.organization_slug}/login` : '/login');
            }}
          >
            Sign out
          </Button>
        )}
      </div>
    </div>
  );
};

export default NoAccess;
