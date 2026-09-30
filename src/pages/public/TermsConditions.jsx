// src/pages/public/TermsConditions.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  FileText,
  CheckCircle,
  AlertTriangle,
  Info,
  ArrowRight
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { SUPPORT_EMAIL } from '../../utils/constants';
import useSEO from '../../hooks/useSEO';

const TermsConditions = () => {
  useSEO({
    title: 'Terms & Conditions',
    description: 'The terms governing your use of the Xposer AI whistleblowing and compliance platform.',
  });
  const lastUpdated = 'January 30, 2026';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mx-auto mb-4">
            <Shield className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Terms & Conditions</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            These Terms of Service govern your use of our whistleblowing platform. Please read them carefully before using the service.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <Card padding="small" className="sticky top-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">On This Page</h3>
              <nav className="text-sm text-gray-600 space-y-2">
                <a href="#acceptance" className="block hover:text-primary-600">Acceptance</a>
                <a href="#accounts" className="block hover:text-primary-600">Accounts</a>
                <a href="#content" className="block hover:text-primary-600">Report Content</a>
                <a href="#conduct" className="block hover:text-primary-600">User Conduct</a>
                <a href="#disclaimer" className="block hover:text-primary-600">Disclaimers</a>
                <a href="#termination" className="block hover:text-primary-600">Termination</a>
                <a href="#contact" className="block hover:text-primary-600">Contact</a>
              </nav>
            </Card>

            <Card padding="small" className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="flex flex-col space-y-2">
                <Link to="/privacy" className="text-sm text-primary-600 hover:text-primary-700">Privacy Policy</Link>
                <Link to="/submit-anonymous" className="text-sm text-primary-600 hover:text-primary-700">Submit Anonymous Report</Link>
                <Link to="/track-report" className="text-sm text-primary-600 hover:text-primary-700">Track a Report</Link>
              </div>
            </Card>
          </aside>

          <main className="lg:col-span-3 space-y-6">
            <Alert variant="info">
              <div className="flex items-start">
                <div>
                  <p className="font-medium">Note</p>
                  <p className="text-sm mt-1">By using the platform you agree to these Terms. If you do not agree, please do not use the service.</p>
                </div>
              </div>
            </Alert>

            <article id="acceptance">
              <Card>
                <div className="flex items-start mb-4">
                  <FileText className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Acceptance of Terms</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>These Terms constitute a binding agreement between you and the service operator. They apply to all users, including anonymous reporters, account holders, and guests.</p>
                </div>
              </Card>
            </article>

            <article id="accounts">
              <Card>
                <div className="flex items-start mb-4">
                  <CheckCircle className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Accounts & Registration</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>If you create an account, you must provide accurate information and keep credentials secure. You are responsible for all activity under your account.</p>
                  <p>We reserve the right to suspend or terminate accounts that violate these Terms or for security reasons.</p>
                </div>
              </Card>
            </article>

            <article id="content">
              <Card>
                <div className="flex items-start mb-4">
                  <AlertTriangle className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Report Content</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>When you submit a report, you grant us a non-exclusive license to use the content to investigate and resolve the report. You should not submit false, defamatory, or unlawful content.</p>
                  <p>We will process anonymous reports without collecting identifying information unless you provide it voluntarily.</p>
                </div>
              </Card>
            </article>

            <article id="conduct">
              <Card>
                <div className="flex items-start mb-4">
                  <Info className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">User Conduct</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <ul className="list-disc list-inside space-y-2">
                    <li>You agree not to use the service for unlawful purposes or to harass, impersonate, or defraud others.</li>
                    <li>Do not attempt to access systems you are not authorized to access.</li>
                    <li>Respect the privacy of others and refrain from submitting unnecessary personal data about third parties.</li>
                  </ul>
                </div>
              </Card>
            </article>

            <article id="disclaimer">
              <Card>
                <div className="flex items-start mb-4">
                  <Shield className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Disclaimers & Limitation of Liability</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>The service is provided "as is" and does not guarantee outcomes of investigations. We are not liable for indirect, incidental, or consequential damages arising from use of the service.</p>
                  <p>Some jurisdictions do not allow limitations on liability, so these limitations may not apply to you.</p>
                </div>
              </Card>
            </article>

            <article id="termination">
              <Card>
                <div className="flex items-start mb-4">
                  <CheckCircle className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Termination</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We may suspend or terminate access to the service at any time for breaches of these Terms or for safety and legal reasons.</p>
                  <p>Termination will not affect rights or obligations that accrued prior to termination.</p>
                </div>
              </Card>
            </article>

            <article id="contact">
              <Card>
                <div className="flex items-start mb-4">
                  <FileText className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>If you have questions about these Terms, please contact us:</p>
                  <div className="mt-2">
                    <p className="text-sm"><strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 hover:underline">{SUPPORT_EMAIL}</a></p>
                    <p className="text-sm"><strong>Support:</strong> <Link to="/help" className="text-primary-600 hover:underline">Help Center</Link></p>
                  </div>
                </div>
              </Card>
            </article>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Last updated: <span className="font-medium text-gray-900">{lastUpdated}</span></p>
                  <p className="text-sm text-gray-600 mt-1">By using our service you agree to these Terms. For privacy details, see our <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>.</p>
                </div>

                <div className="hidden sm:block">
                  <Link to="/submit-anonymous">
                    <Button variant="secondary" size="medium" className="ml-4 cursor-pointer">
                      Submit a Report
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            {/* Mobile CTA */}
            <div className="block sm:hidden">
              <Link to="/submit-anonymous">
                <Button variant="secondary" size="large" fullWidth>
                  Submit a Report
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default TermsConditions;
