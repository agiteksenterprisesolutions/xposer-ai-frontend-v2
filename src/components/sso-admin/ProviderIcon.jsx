// src/components/sso-admin/ProviderIcon.jsx
//
// Provider marks drawn inline: no external images on the admin screens.
import { Mail } from 'lucide-react';

const MicrosoftMark = ({ className }) => (
  <svg viewBox="0 0 23 23" className={className} aria-hidden="true">
    <path fill="#F25022" d="M1 1h10v10H1z" />
    <path fill="#7FBA00" d="M12 1h10v10H12z" />
    <path fill="#00A4EF" d="M1 12h10v10H1z" />
    <path fill="#FFB900" d="M12 12h10v10H12z" />
  </svg>
);

const GoogleMark = ({ className }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84a10.13 10.13 0 0 1-4.4 6.65v5.52h7.12c4.16-3.83 6.56-9.47 6.56-16.18z" />
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.12-5.52c-1.97 1.32-4.49 2.1-7.44 2.1-5.72 0-10.57-3.86-12.3-9.06H4.34v5.7A22 22 0 0 0 24 46z" />
    <path fill="#FBBC05" d="M11.7 28.19a13.2 13.2 0 0 1 0-8.38v-5.7H4.34a22 22 0 0 0 0 19.78l7.36-5.7z" />
    <path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.04 29.93 1 24 1 15.4 1 7.96 5.94 4.34 13.11l7.36 5.7c1.73-5.2 6.58-9.06 12.3-9.06z" />
  </svg>
);

const ProviderIcon = ({ provider, className = 'h-5 w-5' }) => {
  if (provider === 'microsoft') return <MicrosoftMark className={className} />;
  if (provider === 'google') return <GoogleMark className={className} />;
  return <Mail className={`${className} text-ink-muted`} aria-hidden="true" />;
};

export default ProviderIcon;
