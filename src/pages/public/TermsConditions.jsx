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
    <div className="min-h-screen bg-subtle py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent-soft rounded-full mx-auto mb-4">
            <Shield className="w-10 h-10 text-link" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-ink mb-3">Terms & Conditions</h1>
          <p className="text-ink-muted max-w-2xl mx-auto">
            These Terms of Service govern your use of our whistleblowing platform. Please read them carefully before using the service.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1">
            <Card padding="small" className="sticky top-6">
              <h3 className="text-sm font-semibold text-ink mb-3">On This Page</h3>
              <nav className="text-sm text-ink-muted space-y-2">
                <a href="#acceptance" className="block py-0.5 hover:text-link-hover">Acceptance</a>
                <a href="#accounts" className="block py-0.5 hover:text-link-hover">Accounts</a>
                <a href="#content" className="block py-0.5 hover:text-link-hover">Report Content</a>
                <a href="#conduct" className="block py-0.5 hover:text-link-hover">User Conduct</a>
                <a href="#disclaimer" className="block py-0.5 hover:text-link-hover">Disclaimers</a>
                <a href="#termination" className="block py-0.5 hover:text-link-hover">Termination</a>
                <a href="#contact" className="block py-0.5 hover:text-link-hover">Contact</a>
              </nav>
            </Card>

            <Card padding="small" className="mt-6">
              <h3 className="text-sm font-semibold text-ink mb-3">Quick Links</h3>
              <div className="flex flex-col space-y-2">
                <Link to="/privacy" className="inline-flex min-h-6 items-center text-sm text-link hover:text-link-hover">Privacy Policy</Link>
                <Link to="/submit-anonymous" className="inline-flex min-h-6 items-center text-sm text-link hover:text-link-hover">Submit Anonymous Report</Link>
                <Link to="/track-report" className="inline-flex min-h-6 items-center text-sm text-link hover:text-link-hover">Track a Report</Link>
              </div>
            </Card>
          </aside>

          <div className="lg:col-span-3 space-y-6">
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
                  <FileText className="w-5 h-5 text-link me-3" />
                  <h2 className="text-lg font-semibold text-ink">Acceptance of Terms</h2>
                </div>
                <div className="space-y-3 text-ink-secondary text-sm">
                  <p>These Terms constitute a binding agreement between you and the service operator. They apply to all users, including anonymous reporters, account holders, and guests.</p>
                </div>
              </Card>
            </article>

            <article id="accounts">
              <Card>
                <div className="flex items-start mb-4">
                  <CheckCircle className="w-5 h-5 text-link me-3" />
                  <h2 className="text-lg font-semibold text-ink">Accounts & Registration</h2>
                </div>
                <div className="space-y-3 text-ink-secondary text-sm">
                  <p>If you create an account, you must provide accurate information and keep credentials secure. You are responsible for all activity under your account.</p>
                  <p>We reserve the right to suspend or terminate accounts that violate these Terms or for security reasons.</p>
                </div>
              </Card>
            </article>

            <article id="content">
              <Card>
                <div className="flex items-start mb-4">
                  <AlertTriangle className="w-5 h-5 text-link me-3" />
                  <h2 className="text-lg font-semibold text-ink">Report Content</h2>
                </div>
                <div className="space-y-3 text-ink-secondary text-sm">
                  <p>When you submit a report, you grant us a non-exclusive license to use the content to investigate and resolve the report. You should not submit false, defamatory, or unlawful content.</p>
                  <p>We will process anonymous reports without collecting identifying information unless you provide it voluntarily.</p>
                </div>
              </Card>
            </article>

            <article id="conduct">
              <Card>
                <div className="flex items-start mb-4">
                  <Info className="w-5 h-5 text-link me-3" />
                  <h2 className="text-lg font-semibold text-ink">User Conduct</h2>
                </div>
                <div className="space-y-3 text-ink-secondary text-sm">
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
                  <Shield className="w-5 h-5 text-link me-3" />
                  <h2 className="text-lg font-semibold text-ink">Disclaimers & Limitation of Liability</h2>
                </div>
                <div className="space-y-3 text-ink-secondary text-sm">
                  <p>The service is provided "as is" and does not guarantee outcomes of investigations. We are not liable for indirect, incidental, or consequential damages arising from use of the service.</p>
                  <p>Some jurisdictions do not allow limitations on liability, so these limitations may not apply to you.</p>
                </div>
              </Card>
            </article>

            <article id="termination">
              <Card>
                <div className="flex items-start mb-4">
                  <CheckCircle className="w-5 h-5 text-link me-3" />
                  <h2 className="text-lg font-semibold text-ink">Termination</h2>
                </div>
                <div className="space-y-3 text-ink-secondary text-sm">
                  <p>We may suspend or terminate access to the service at any time for breaches of these Terms or for safety and legal reasons.</p>
                  <p>Termination will not affect rights or obligations that accrued prior to termination.</p>
                </div>
              </Card>
            </article>

            <article id="contact">
              <Card>
                <div className="flex items-start mb-4">
                  <FileText className="w-5 h-5 text-link me-3" />
                  <h2 className="text-lg font-semibold text-ink">Contact</h2>
                </div>
                <div className="space-y-3 text-ink-secondary text-sm">
                  <p>If you have questions about these Terms, please contact us:</p>
                  <div className="mt-2">
                    <p className="text-sm"><strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-link hover:underline">{SUPPORT_EMAIL}</a></p>
                    <p className="text-sm"><strong>Support:</strong> <Link to="/help" className="text-link hover:underline">Help Center</Link></p>
                  </div>
                </div>
              </Card>
            </article>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-ink-muted">Last updated: <span className="font-medium text-ink">{lastUpdated}</span></p>
                  <p className="text-sm text-ink-muted mt-1">By using our service you agree to these Terms. For privacy details, see our <Link to="/privacy" className="text-link hover:underline">Privacy Policy</Link>.</p>
                </div>

                <div className="hidden sm:block">
                  <Button variant="secondary" size="medium" className="ms-4 cursor-pointer" to="/submit-anonymous">
                      Submit a Report
                      <ArrowRight className="ms-2 w-4 h-4" />
                    </Button>
                </div>
              </div>
            </Card>

            {/* Mobile CTA */}
            <div className="block sm:hidden">
              <Button variant="secondary" size="large" fullWidth to="/submit-anonymous">
                  Submit a Report
                </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsConditions;
