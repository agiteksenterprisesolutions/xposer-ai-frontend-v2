import React, { useState, useEffect } from "react"
import { Navigate, Outlet, useParams, useLocation } from "react-router-dom"
import Footer from "./Footer"
import Navbar from "./Navbar"
import AIChatWidget from "./AIChatWidget"
import { useAuthStore } from "../../store/authStore"
import { isOutsideOwnOrganization, toOwnOrganizationPath } from "../../utils/roles"

function getPublicHomePath(user) {
  if (user?.organization_slug) {
    return `/${user.organization_slug}`;
  }
  return "/";
}

/**
 * @param {object} props
 * @param {boolean} [props.requireOrg] – When true (under /:orgSlug/*), block access only when the
 *   slug is missing. Unauthenticated users with a valid slug are allowed through as anonymous visitors.
 *   Signed-in members of another organization are moved to the same page under their own slug.
 */
const PublicLayout = ({ requireOrg = false }) => {
  const { user, isAuthenticated } = useAuthStore();
  const { orgSlug } = useParams();
  // Called before any early return: a hook after a conditional return changes
  // the hook order between renders.
  const location = useLocation();

  // Signed in to one organization but on another's URL. Applies to every
  // /:orgSlug page, not only requireOrg ones.
  const onForeignOrganization = isAuthenticated && isOutsideOwnOrganization(user, orgSlug);

  const [isValidating, setIsValidating] = useState(false);
  const [orgExists, setOrgExists] = useState(null); // null = unknown, true = exists, false = not found
  const [currentCheckedSlug, setCurrentCheckedSlug] = useState("");

  useEffect(() => {
    // Nothing to look up when the visit is about to be redirected anyway.
    if (!orgSlug || onForeignOrganization) {
      setOrgExists(null);
      return;
    }

    if (orgSlug === currentCheckedSlug) {
      return;
    }

    const checkOrgSlug = async () => {
      setIsValidating(true);
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const res = await fetch(`${apiUrl}/organizations/by-slug/${orgSlug}`, {
          headers: {
            'accept': 'application/json'
          }
        });

        if (res.ok) {
          setOrgExists(true);
        } else {
          setOrgExists(false);
        }
      } catch (err) {
        console.error("Error validating organization slug:", err);
        setOrgExists(false);
      } finally {
        setIsValidating(false);
        setCurrentCheckedSlug(orgSlug);
      }
    };

    checkOrgSlug();
  }, [orgSlug, currentCheckedSlug, onForeignOrganization]);

  // The same page under the user's own slug. Placed after every hook so the
  // hook order is the same on every render.
  if (onForeignOrganization) {
    return <Navigate to={toOwnOrganizationPath(location, user)} replace />;
  }

  if (isValidating) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-12 h-12 border-4 border-line border-t-accent rounded-full animate-spin mb-4" />
        <p className="text-ink-muted text-sm font-medium tracking-wide animate-pulse">
          Validating organization access...
        </p>
      </div>
    );
  }

  if (orgSlug && orgExists === false) {
    return <Navigate to="/login" replace />;
  }

  if (requireOrg) {
    // No slug at all – there's nothing to show
    if (!orgSlug || orgSlug === "undefined") {
      return <Navigate to={getPublicHomePath(user)} replace />;
    }
    // Unauthenticated users (or anonymous reporters) with a valid slug are allowed through
  } else {
    // If we are at root "/" but logged in, redirect to org home
    if (!orgSlug && isAuthenticated && user?.organization_slug) {
      return <Navigate to={`/${user.organization_slug}`} replace />;
    }
  }

  const isHome = location.pathname === "/" || (orgSlug && (location.pathname === `/${orgSlug}` || location.pathname === `/${orgSlug}/`));

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      {orgSlug && <AIChatWidget />}
      {/* <Footer /> */}
    </div>
  )
}

export default PublicLayout;
