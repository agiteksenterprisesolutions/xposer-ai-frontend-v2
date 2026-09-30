// src/components/layout/Footer.jsx
import { Link, useParams } from 'react-router-dom';
import {
  Heart,
  Linkedin,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { SUPPORT_EMAIL } from '../../utils/constants';
import XposerLogo from '../brand/XposerLogo';
import { canSubmitAnonymousReport } from '../../utils/roles';

const Footer = () => {
  const { user } = useAuthStore();
  const { orgSlug: paramSlug } = useParams();
  const slug = user?.organization_slug ?? paramSlug;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#080c14] border-t border-gray-900 text-white">
      <div className=" mx-auto px-4 sm:px-6 lg:px-9 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company info */}
          <div className="space-y-4">
            <Link to={slug ? `/${slug}` : '/'} className="flex items-center">
              <XposerLogo className="h-8 w-auto" />
            </Link>
            <p className="text-gray-400 text-sm">
              A secure, anonymous reporting system that protects whistleblowers
              while ensuring compliance teams can effectively investigate and resolve cases.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://www.linkedin.com/company/agiteks/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link to={slug ? `/${slug}` : '/'} className="text-gray-400 hover:text-white text-sm">
                  Home
                </Link>
              </li>
              {canSubmitAnonymousReport(user) && (
                <li>
                  <Link to={slug ? `/${slug}/submit-anonymous` : '/submit-anonymous'} className="text-gray-400 hover:text-white text-sm">
                    Submit Anonymous Report
                  </Link>
                </li>
              )}
              <li>
                <Link to={slug ? `/${slug}/login` : '/login'} className="text-gray-400 hover:text-white text-sm">
                  Login
                </Link>
              </li>
              <li>
                <Link to={slug ? `/${slug}/help` : '/help'} className="text-gray-400 hover:text-white text-sm">
                  Help Center
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to={slug ? `/${slug}/privacy` : '/privacy'} className="text-gray-400 hover:text-white text-sm">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to={slug ? `/${slug}/terms` : '/terms'} className="text-gray-400 hover:text-white text-sm">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to={slug ? `/${slug}/cookie-policy` : '/cookie-policy'} className="text-gray-400 hover:text-white text-sm">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link to={slug ? `/${slug}/compliance` : '/compliance'} className="text-gray-400 hover:text-white text-sm">
                  Compliance
                </Link>
              </li>
              <li>
                <Link to={slug ? `/${slug}/security` : '/security'} className="text-gray-400 hover:text-white text-sm">
                  Security
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-center text-gray-400 text-sm">
                <Mail className="h-4 w-4 mr-2" />
                {SUPPORT_EMAIL || 'support@xposer.ai'}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © {currentYear} Xposer AI Reporting System. All rights reserved.
            </p>
            <div className="flex items-center mt-4 md:mt-0">
              <Heart className="h-4 w-4 text-red-400 mr-1" />
              <span className="text-gray-400 text-sm">
                Made with care for a safer workplace
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Minimal footer for auth pages
export const MinimalFooter = () => {
  const { user } = useAuthStore();
  const { orgSlug: paramSlug } = useParams();
  const slug = user?.organization_slug ?? paramSlug;
  return (
    <footer className="bg-white border-t border-gray-200 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <XposerLogo className="h-6 w-auto" />
          </div>
          <div className="flex space-x-6">
            <Link to={slug ? `/${slug}/privacy` : '/privacy'} className="text-sm text-gray-600 hover:text-gray-900">
              Privacy
            </Link>
            <Link to={slug ? `/${slug}/terms` : '/terms'} className="text-sm text-gray-600 hover:text-gray-900">
              Terms
            </Link>
            <Link to={slug ? `/${slug}/security` : '/security'} className="text-sm text-gray-600 hover:text-gray-900">
              Security
            </Link>
            <Link to={slug ? `/${slug}/help` : '/help'} className="text-sm text-gray-600 hover:text-gray-900">
              Help
            </Link>
          </div>
        </div>
        <p className="mt-4 text-center md:text-left text-sm text-gray-500">
          © {new Date().getFullYear()} Xposer AI Reporting System. Protecting voices that matter.
        </p>
      </div>
    </footer>
  );
};

export default Footer;