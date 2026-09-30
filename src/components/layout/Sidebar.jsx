// src/components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import {
  Home,
  FileText,
  BarChart3,
  MessageSquare,
  ClipboardList,
  Inbox,
  Lock,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import UserAvatar from '../ui/UserAvatar';
import { isPasswordAccount } from '../../utils/authProviders';
import { staffNavFor, staffPath } from '../../utils/navigation';

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// finance_lead → Finance lead
const humanizeCode = (code) =>
  code ? code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ') : '';

const Sidebar = ({ onClose }) => {
  const { user } = useAuthStore();
  const { sidebarOpen, mobileSidebarOpen, toggleMobileSidebar } = useUIStore();

  if (!user) return null;
  const basePath = user ? `${user?.organization_slug}` : '';
  // Organizations name their own roles; show that name, falling back to the code.
  const roleLabel = user?.role_name || humanizeCode(user?.role);

  // ── Menu Definitions ─────────────────────────────────────────────────────
  // Google/Microsoft accounts have no password to change — the provider owns
  // the credential, and the backend rejects the endpoint with a 400.
  const reporterMenu = [
    { name: 'Dashboard', icon: Home, path: `/${basePath}/reporter/dashboard` },
    { name: 'Submit Report', icon: FileText, path: `/${basePath}/reporter/submit` },
    { name: 'My Reports', icon: ClipboardList, path: `/${basePath}/reporter/reports` },
    ...(isPasswordAccount(user)
      ? [{ name: 'Change Password', icon: Lock, path: `/${basePath}/reporter/change-password` }]
      : []),
  ];

  // Staff see every page their permissions open, in one menu; anyone who can
  // open no staff page is a reporter account and gets the portal menu.
  // Analytics now lives on the overview dashboard, so it has no entry.
  const staffMenu = staffNavFor(user).map((item) => ({
    ...item,
    path: staffPath(user?.organization_slug, item.path),
  }));

  const menuItems = staffMenu.length > 0 ? staffMenu : reporterMenu;

  const handleLinkClick = () => {
    if (onClose) onClose();
    if (mobileSidebarOpen) toggleMobileSidebar();
  };

  const renderContent = (isCollapsed, isMobile = false) => {
    const labelClass = isMobile
      ? 'font-medium text-sm truncate'
      : `font-medium text-sm truncate ${isCollapsed ? 'hidden' : 'hidden lg:block'}`;

    const userInfoClass = isMobile
      ? 'min-w-0'
      : `min-w-0 ${isCollapsed ? 'hidden' : 'hidden lg:block'}`;

    const linkClass = (isActive) => {
      const base =
        'relative flex items-center gap-3 rounded-lg transition-colors duration-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
      const state = isActive
        ? 'bg-accent-soft text-accent-fg font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-r-full before:bg-accent'
        : 'text-ink-muted hover:text-ink hover:bg-hover';

      if (isMobile) {
        return `${base} px-3 py-2.5 ${state}`;
      }

      const padding = isCollapsed
        ? 'px-3 py-2.5 justify-center'
        : 'px-3 py-2.5 justify-center lg:px-3 lg:py-2.5 lg:justify-start';

      return `${base} ${padding} ${state}`;
    };

    const showLabels = !isCollapsed || isMobile;

    return (
      <>
        {/* User Info */}
        <div className="p-4 border-b border-line-subtle shrink-0" data-tour="sidebar-user">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="small" />
            {showLabels && (
              <div className={userInfoClass}>
                {/* <p className="text-xs text-accent-fg truncate">
                  {user?.organization_name}
                </p> */}
                <p className="text-sm font-semibold text-ink truncate">
                  {user?.full_name || user?.username}
                </p>
                <p className="text-sm font-medium text-accent-fg truncate">
                  {user?.organization_name}
                </p>
                <p className="text-xs text-ink-subtle truncate">
                  {roleLabel}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {showLabels && (
            <p className="px-3 pt-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-subtle">
              Menu
            </p>
          )}
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={handleLinkClick}
              className={({ isActive }) => linkClass(isActive)}
              title={!showLabels ? item.name : undefined}
              data-tour={`sidebar-${slugify(item.name)}`}
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" />
              {showLabels && <span className={labelClass}>{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer links */}
        <div className="p-3 border-t border-line-subtle space-y-1 shrink-0">
          {/* <NavLink
            to={`/${basePath}/help`}
            onClick={handleLinkClick}
            className={({ isActive }) => linkClass(isActive)}
            title={!showLabels ? 'Help & Support' : undefined}
            data-tour="sidebar-help"
          >
            <HelpCircle className="h-4.5 w-4.5 shrink-0" />
            {showLabels && <span className={labelClass}>Help &amp; Support</span>}
          </NavLink> */}
          {/* {user?.role === "reporter" && (
            <NavLink
              to={`/${basePath}/submit-anonymous`}
              onClick={handleLinkClick}
              className={({ isActive }) => linkClass(isActive)}
              title={!showLabels ? 'Anonymous Report' : undefined}
              data-tour="sidebar-anonymous"
            >
              <Lock className="h-4.5 w-4.5 shrink-0" />
              {showLabels && <span className={labelClass}>Anonymous Report</span>}
            </NavLink>
          )} */}
        </div>
      </>
    );
  };

  // If onClose is passed, we are rendered directly inside a mobile drawer parent layout
  if (onClose) {
    return (
      <div className="h-full flex flex-col bg-surface border-r border-line">
        {renderContent(false, true)}
      </div>
    );
  }

  return (
    <>
      {/* Desktop/Tablet inline sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-surface border-r border-line h-[calc(100vh-4rem)] sticky top-16 shrink-0 transition-[width] duration-300 ease-out-xp ${sidebarOpen ? 'w-20 lg:w-64' : 'w-20'
          }`}
      >
        {renderContent(!sidebarOpen, false)}
      </aside>

      {/* Mobile drawer sidebar */}
      {mobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-overlay backdrop-blur-sm z-40 lg:hidden animate-fade-in"
            onClick={toggleMobileSidebar}
          />
          {/* Drawer container */}
          <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-surface h-full flex flex-col border-r border-line shadow-xl lg:hidden animate-slide-down">
            {renderContent(false, true)}
          </aside>
        </>
      )}
    </>
  );
};

// Mini sidebar for collapsed state
export const MiniSidebar = () => {
  const { user } = useAuthStore();

  if (!user) return null;

  const quickActions = [
    { icon: FileText, path: '/submit', label: 'New Report' },
    { icon: Inbox, path: '/reports', label: 'Reports' },
    { icon: MessageSquare, path: '/messages', label: 'Messages' },
    { icon: BarChart3, path: '/analytics', label: 'Analytics' },
  ];

  return (
    <aside className="w-16 bg-surface border-r border-line h-[calc(100vh-4rem)] sticky top-16 flex flex-col items-center py-4 gap-2">
      {quickActions.map((action, index) => (
        <NavLink
          key={index}
          to={action.path}
          className={({ isActive }) =>
            `p-2.5 rounded-lg transition-colors ${isActive ? 'bg-accent-soft text-accent-fg' : 'text-ink-subtle hover:text-ink hover:bg-hover'}`
          }
          title={action.label}
        >
          <action.icon className="h-5 w-5" />
        </NavLink>
      ))}
    </aside>
  );
};

export default Sidebar;
