// src/components/layout/Navbar.jsx
import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Menu,
  User,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  BookOpen,
  Compass,
  X
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useTourStore } from '../../store/tourStore';
import Dropdown from '../ui/Dropdown';
import ThemeToggle from '../ui/ThemeToggle';
import XposerLogo from '../brand/XposerLogo';
import UserAvatar from '../ui/UserAvatar';
import TourTriggerButton from '../tour/TourTriggerButton';
import { canSubmitAnonymousReport } from '../../utils/roles';
import { getHomePath, STAFF_AREA, REPORTER_AREA } from '../../utils/navigation';

const DASHBOARD_ROUTE = new RegExp(`/(${STAFF_AREA}|${REPORTER_AREA})(/|$)`);

const navLinkClass = 'text-sm font-normal text-ink-muted no-underline px-3.5 py-2 rounded-md tracking-[-0.01em] transition-colors hover:text-ink hover:bg-hover';
const navCtaClass = 'inline-flex items-center gap-1.5 bg-accent text-on-accent text-sm font-semibold px-4 py-2 rounded-lg no-underline tracking-[-0.01em] transition-all hover:bg-accent-hover hover:-translate-y-px';
const iconBtnClass = 'inline-flex items-center justify-center h-9 w-9 rounded-lg text-ink-muted bg-transparent border-none transition-colors hover:text-ink hover:bg-hover';

const Navbar = ({ onMenuClick }) => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { toggleMobileSidebar, sidebarOpen, toggleSidebar } = useUIStore();
  // Set by the current page's tour, if it has one — see store/tourStore.
  const startTour = useTourStore((state) => state.start);
  const { orgSlug: paramSlug } = useParams();
  const orgSlug = user?.organization_slug ?? paramSlug;
  const location = useLocation();
  const isHome = location.pathname === "/" || (orgSlug && (location.pathname === `/${orgSlug}` || location.pathname === `/${orgSlug}/`));
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleLogout = () => {
    logout();
    navigate(`/login`);
  };

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  const dashboardLink = useMemo(() => {
    if (!user) return orgSlug ? `/${orgSlug}/login` : '/login';
    return getHomePath(user) || (orgSlug ? `/${orgSlug}` : '/');
  }, [user, orgSlug]);

  const howToUseLink = orgSlug ? `/${orgSlug}/how-to-use` : '/how-to-use';

  const isDashboardRoute = DASHBOARD_ROUTE.test(location.pathname);
  const isDashboardUser = isAuthenticated && !user?.is_anonymous && isDashboardRoute;
  // Compliance/reviewer/admin staff can only file a report once they have logged
  // out, so the anonymous reporting CTA is hidden for their sessions.
  const canReportAnonymously = canSubmitAnonymousReport(user);

  const userMenu = (
    <>
      <div className="px-3.5 py-3">
        <p className="text-sm font-semibold text-ink truncate">
          {user?.full_name || user?.username}
        </p>
        <p className="text-xs text-ink-subtle truncate">
          {user?.email}
        </p>
      </div>
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => navigate(dashboardLink)}>
        <User className="w-4 h-4 shrink-0" />
        Dashboard
      </Dropdown.Item>
      <Dropdown.Item onClick={() => navigate(howToUseLink)}>
        <BookOpen className="w-4 h-4 shrink-0" />
        How to use
      </Dropdown.Item>
      <Dropdown.Divider />
      <Dropdown.Item
        className="text-danger-fg hover:text-danger-fg"
        onClick={handleLogout}
      >
        <LogOut className="w-4 h-4 shrink-0" />
        Logout
      </Dropdown.Item>
    </>
  );

  return (
    <>
      <nav className={`${isHome ? 'fixed' : 'sticky'} top-0 left-0 right-0 z-100 h-16 px-4 sm:px-5 flex items-center justify-between bg-canvas border-b border-line font-sans box-border`}>
        {/* Left Side */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile sidebar toggle (only for authenticated dashboard users) */}
          {isMobile && isDashboardUser && (
            <button
              type="button"
              className={`${iconBtnClass} lg:hidden`}
              onClick={onMenuClick || toggleMobileSidebar}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          {/* Desktop sidebar collapse — drives the collapsed/expanded widths
              the sidebar already implements */}
          {!isMobile && isDashboardUser && (
            <button
              type="button"
              className={`${iconBtnClass} hidden lg:inline-flex`}
              onClick={toggleSidebar}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
            </button>
          )}

          {/* Logo */}
          <Link to={orgSlug ? `/${orgSlug}` : '/'} className="flex items-center no-underline min-w-0" data-tour="tour-logo">
            <XposerLogo className="h-6 sm:h-7 w-auto shrink-0" />
          </Link>
        </div>

        {/* Right Side - Desktop */}
        <div className="hidden md:flex items-center gap-2">
          {startTour && <TourTriggerButton onClick={startTour} />}
          <ThemeToggle variant="surface" className="border-transparent" />
          {orgSlug && !user && (
            <Link to={howToUseLink} className={"border border-line px-2.5 py-1.5 rounded-lg transition-colors hover:bg-hover hover:border-line-strong"}>
              How to use
            </Link>
          )}


          {isAuthenticated ? (
            <Dropdown
              trigger={
                <button
                  className="flex items-center gap-2 bg-subtle border border-line px-2.5 py-1.5 rounded-lg transition-colors hover:bg-hover hover:border-line-strong"
                  type="button"
                  data-tour="tour-user-menu"
                >
                  <UserAvatar user={user} size="xs" />
                  <div className="hidden lg:block text-left max-w-36">
                    <p className="text-[13px] font-medium text-ink leading-tight m-0 truncate">
                      {user?.full_name || user?.username}
                    </p>
                    <p className="text-[11px] text-ink-subtle leading-tight m-0 truncate">
                      {user?.role?.charAt(0)?.toUpperCase() + user?.role?.slice(1)}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 shrink-0 text-ink-subtle" />
                </button>
              }
              align="right"
              width="md"
            >
              {userMenu}
            </Dropdown>
          ) : null}

          {orgSlug && (
            <>
              {!isAuthenticated && (
                <Link
                  to={`/${orgSlug}/track-report`}
                  className={"border border-line px-2.5 py-1.5 rounded-lg transition-colors hover:bg-hover hover:border-line-strong"}
                  data-tour="tour-report-cta"
                >
                  Track Report
                </Link>
              )}
              {canReportAnonymously && (
                <Link
                  to={`/${user?.organization_slug ?? orgSlug}/submit-anonymous`}
                  className={navCtaClass}
                  data-tour="tour-report-cta"
                >
                  Report now
                </Link>
              )}
            </>
          )}
        </div>

        {/* Right Side - Mobile */}
        <div className="flex items-center md:hidden gap-1.5">
          {startTour && (
            <button
              type="button"
              className={`${iconBtnClass} text-accent-fg`}
              onClick={startTour}
              aria-label="Take a tour"
              title="Take a tour"
            >
              <Compass className="h-5 w-5" />
            </button>
          )}
          <ThemeToggle variant="surface" className="border-transparent" />

          {isAuthenticated && (
            <Dropdown
              trigger={
                <button className="flex items-center gap-1 bg-subtle border border-line rounded-lg transition-colors p-1 hover:bg-hover hover:border-line-strong" type="button">
                  <UserAvatar user={user} size="xs" />
                  <ChevronDown className="w-4 h-4 text-ink-subtle" />
                </button>
              }
              align="right"
              width="md"
            >
              {userMenu}
            </Dropdown>
          )}

          {(!isAuthenticated || user?.is_anonymous) && (
            <button
              type="button"
              className={iconBtnClass}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Links Dropdown Menu */}
      {mobileMenuOpen && (!isAuthenticated || user?.is_anonymous) && (
        <div className="fixed top-16 left-0 right-0 max-h-[calc(100dvh-4rem)] overflow-y-auto bg-canvas border-b border-line px-4 py-4 flex flex-col gap-2 z-99 md:hidden animate-slide-down">
          <Link to={howToUseLink} className={navLinkClass} onClick={handleLinkClick}>
            How to use
          </Link>

          {!isAuthenticated || !orgSlug ? (
            <>
              <Link to={orgSlug ? `/${orgSlug}/login` : `/login`} className={navLinkClass} onClick={handleLinkClick}>
                Login
              </Link>
              {/* <Link to={orgSlug ? `/${orgSlug}/track-report` : `/track-report`} className={`${navLinkClass} border border-line-strong text-center`} onClick={handleLinkClick}>
                Track a report
              </Link> */}
            </>
          ) : (
            <Link to={dashboardLink} className={navLinkClass} onClick={handleLinkClick}>
              Dashboard
            </Link>
          )}

          {orgSlug && (
            <>
              {!isAuthenticated && (
                <Link to={`/${orgSlug}/track-report`} className={`${navLinkClass} border border-line-strong text-center`} onClick={handleLinkClick}>
                  Track a report
                </Link>
              )}
              {canReportAnonymously && (
                <Link
                  to={`/${user?.organization_slug ?? orgSlug}/submit-anonymous`}
                  className={`${navCtaClass} justify-center`}
                  onClick={handleLinkClick}
                >
                  Report now
                </Link>
              )}

            </>
          )}
        </div>
      )}
    </>
  );
};

export default Navbar;
