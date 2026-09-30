// src/components/layout/Layout.jsx
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Footer from './Footer';
import LoadingSpinner from './LoadingSpinner';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import AIChatWidget from './AIChatWidget';

const Layout = ({ children }) => {
  const { isAuthenticated, user, isLoading: authLoading } = useAuthStore();
  const { loading, loadingMessage, notification, clearNotification } = useUIStore();
  const location = useLocation();
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Reset mobile sidebar on route change
  useEffect(() => {
    setShowMobileSidebar(false);
  }, [location.pathname]);

  // Handle escape key to close mobile sidebar
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showMobileSidebar) {
        setShowMobileSidebar(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showMobileSidebar]);

  // Public layout (no auth required)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-50 to-white flex flex-col">
        <Navbar />
        <main className="flex-1">
          {children || <Outlet />}
          <AIChatWidget />
        </main>
        {/* <Footer /> */}

        {/* Loading overlay */}
        {(loading || authLoading) && <LoadingSpinner message={loadingMessage} />}

        {/* Global notification */}
        {notification && (
          <div className="fixed top-4 right-4 z-50 max-w-md">
            <Alert
              variant={notification.type}
              title={notification.message}
              dismissible
              onDismiss={clearNotification}
            />
          </div>
        )}
      </div>
    );
  }

  // Private layout (authenticated users)
  const isAnonymous = user?.is_anonymous;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar onMenuClick={() => setShowMobileSidebar(true)} />

      <div className="flex flex-1">
        {/* Desktop Sidebar (Hidden for anonymous users) */}
        {!isAnonymous && (
          <div className="hidden lg:block">
            <Sidebar />
          </div>
        )}

        {/* Mobile Sidebar Overlay (Hidden for anonymous users) */}
        {showMobileSidebar && !isAnonymous && (
          <>
            <div
              className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
              onClick={() => setShowMobileSidebar(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden">
              <Sidebar onClose={() => setShowMobileSidebar(false)} />
            </div>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden">
          <div className={`container mx-auto px-4 sm:px-6 lg:px-8 py-6 ${isAnonymous ? 'max-w-5xl' : ''}`}>
            {/* Breadcrumbs */}
            <div className="mb-6">
              <nav className="flex" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-2 text-sm text-gray-500">
                  <li>
                    <a href="/" className="hover:text-gray-700">
                      Home
                    </a>
                  </li>
                  <li>
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </li>
                  <li>
                    <span className="font-medium text-gray-900">
                      {isAnonymous ? 'Track Report' : (location.pathname.split('/')[1] || 'Dashboard')}
                    </span>
                  </li>
                </ol>
              </nav>

              {/* Page Title */}
              <h1 className="text-2xl font-bold text-gray-900 mt-2">
                {isAnonymous ? 'Report Tracking' : getPageTitle(location.pathname, user?.role)}
              </h1>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {children || <Outlet />}
            </div>
          </div>
        </main>
      </div>

      {/* <Footer /> */}

      {/* Loading overlay */}
      {(loading || authLoading) && <LoadingSpinner message={loadingMessage} />}

      {/* Global notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <Alert
            variant={notification.type}
            title={notification.message}
            dismissible
            onDismiss={clearNotification}
          />
        </div>
      )}
    </div>
  );
};

// Helper function to get page title based on route
const getPageTitle = (pathname, role) => {
  const path = pathname.split('/')[1];
  const subPath = pathname.split('/')[2];

  const titles = {
    '': 'Dashboard',
    'dashboard': 'Dashboard',
    'reports': 'Reports',
    'submit': 'Submit Report',
    'track': 'Track Report',
    'messages': 'Messages',
    'analytics': 'Analytics',
    'team': 'Team',
    'settings': 'Settings',
    'profile': 'My Profile',
    'admin': 'Admin',
  };

  if (role === 'admin' && path === 'admin') {
    return subPath ? `${subPath.charAt(0).toUpperCase() + subPath.slice(1)} Management` : 'Admin Dashboard';
  }

  if (role === 'reporter' && path === 'reporter') {
    return subPath ? titles[subPath] || 'Reporter Portal' : 'Reporter Dashboard';
  }

  if (['officer', 'manager', 'reviewer'].includes(role) && path === 'compliance') {
    return subPath ? titles[subPath] || 'Compliance Portal' : 'Compliance Dashboard';
  }

  if (role === 'reviewer' && path === 'reviewer') {
    return subPath ? titles[subPath] || 'Reviewer Portal' : 'Reviewer Dashboard';
  }

  return titles[path] || 'Page';
};

export default Layout;
