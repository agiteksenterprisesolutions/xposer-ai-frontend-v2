// src/components/ui/UserAvatar.jsx
import React, { useEffect, useState } from 'react';

const SIZES = {
  xs: 'h-7 w-7 text-[13px]',
  small: 'h-9 w-9 text-sm',
  medium: 'h-10 w-10 text-base',
  large: 'h-14 w-14 text-lg',
};

function initialsOf(user) {
  return (
    user?.full_name?.[0]?.toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U'
  );
}

/**
 * Avatar for a user, showing photo_url when the account has one (Google and
 * Microsoft sign-ins supply it) and falling back to the initial otherwise.
 *
 * Provider photo URLs expire and can start returning 403 long after the
 * account was created, so a load failure silently falls back to initials
 * rather than leaving a broken image in the chrome.
 */
const UserAvatar = ({ user, size = 'xs', className = '' }) => {
  const [failed, setFailed] = useState(false);
  const photoUrl = user?.photo_url;

  // A different user (or a refreshed photo) deserves another attempt.
  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  const sizeClass = SIZES[size] || SIZES.xs;
  const base = `shrink-0 rounded-full overflow-hidden flex items-center justify-center ${sizeClass} ${className}`;

  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt={user?.full_name || user?.username || 'User'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${base} object-cover bg-subtle`}
      />
    );
  }

  return (
    <div className={`${base} bg-accent text-on-accent font-semibold`} aria-hidden="true">
      {initialsOf(user)}
    </div>
  );
};

export default UserAvatar;
