// src/pages/public/PrivacyPolicy.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Lock,
  Globe,
  Mail,
  Clock,
  Users,
  ArrowRight,
  Info
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { SUPPORT_EMAIL } from '../../utils/constants';
import SEO from '../../components/seo/SEO';

const PrivacyPolicy = () => {
  const lastUpdated = 'January 30, 2026';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <SEO
        title="Privacy Policy"
        description="How Xposer AI collects, uses and protects your personal information, and the choices you have over your data."
        keywords={['privacy policy', 'data protection', 'whistleblowing', 'GDPR']}
      />
      <div className="max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mx-auto mb-4">
            <ShieldCheck className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Privacy Policy</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            We respect your privacy and are committed to protecting your personal information. This policy explains what we collect, how we use it, and the choices you have.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar / TOC */}
          <aside className="lg:col-span-1">
            <Card padding="small" className="sticky top-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">On This Page</h3>
              <nav className="text-sm text-gray-600 space-y-2">
                <a href="#what-we-collect" className="block hover:text-primary-600">What we collect</a>
                <a href="#how-we-use" className="block hover:text-primary-600">How we use your data</a>
                <a href="#cookies" className="block hover:text-primary-600">Cookies & Tracking</a>
                <a href="#security" className="block hover:text-primary-600">Security</a>
                <a href="#retention" className="block hover:text-primary-600">Data Retention</a>
                <a href="#your-rights" className="block hover:text-primary-600">Your rights</a>
                <a href="#contact" className="block hover:text-primary-600">Contact</a>
              </nav>
            </Card>

            <Card padding="small" className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="flex flex-col space-y-2">
                <Link to="/terms" className="text-sm text-primary-600 hover:text-primary-700">Terms of Service</Link>
                <Link to="/submit-anonymous" className="text-sm text-primary-600 hover:text-primary-700">Submit Anonymous Report</Link>
                <Link to="/track-report" className="text-sm text-primary-600 hover:text-primary-700">Track a Report</Link>
              </div>
            </Card>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-6">
            <Alert variant="info">
              <div className="flex items-start">
                <div>
                  <p className="font-medium">Important</p>
                  <p className="text-sm mt-1">This policy explains how we handle personal data submitted through our reporting platform, including anonymous reports. If you need immediate help, contact local authorities.</p>
                </div>
              </div>
            </Alert>

            <article id="what-we-collect">
              <Card>
                <div className="flex items-start mb-4">
                  <FileText className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">What we collect</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We may collect the following types of information:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong>Report content:</strong> The details you provide in a report (text, attachments). If you choose to report anonymously, we do not collect identifying information unless you enter it.</li>
                    <li><strong>Account information:</strong> If you create an account, we collect basic information such as name, username, email, and contact preferences.</li>
                    <li><strong>Technical data:</strong> IP address, browser type, device information, and usage logs to help operate and secure the service.</li>
                    <li><strong>Communications:</strong> Messages exchanged with investigators and support, and metadata like timestamps.</li>
                  </ul>
                </div>
              </Card>
            </article>

            <article id="how-we-use">
              <Card>
                <div className="flex items-start mb-4">
                  <Globe className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">How we use your data</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We use the information we collect to:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Process and investigate reports and facilitate secure communication between reporters and investigators.</li>
                    <li>Maintain accounts, send notifications, and provide support.</li>
                    <li>Improve the platform, monitor performance, and prevent fraud or abuse.</li>
                    <li>Comply with legal obligations and respond to lawful requests from public authorities.</li>
                  </ul>
                </div>
              </Card>
            </article>

            <article id="cookies">
              <Card>
                <div className="flex items-start mb-4">
                  <Info className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Cookies & Tracking</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We use cookies and similar technologies to operate the site and analyze usage. Cookies may include:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong>Essential cookies:</strong> Required for core functionality (e.g., sessions).</li>
                    <li><strong>Performance cookies:</strong> Help us understand usage and improve the site.</li>
                    <li><strong>Optional cookies:</strong> May be used for analytics or marketing when you consent to them.</li>
                  </ul>
                  <p>You can control cookie preferences through your browser settings. Blocking certain cookies may affect site functionality.</p>
                </div>
              </Card>
            </article>

            <article id="security">
              <Card>
                <div className="flex items-start mb-4">
                  <Lock className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Security</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We use industry-standard technical and organizational measures to protect data, including encryption in transit and at rest, access controls, and secure development practices.</p>
                  <p>While we take reasonable steps to protect information, no system is completely secure; if you suspect a security issue, contact us immediately (see Contact below).</p>
                </div>
              </Card>
            </article>

            <article id="retention">
              <Card>
                <div className="flex items-start mb-4">
                  <Clock className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Data retention</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We retain personal data only for as long as necessary to fulfill the purposes described in this policy, comply with legal obligations, resolve disputes, and enforce our agreements.</p>
                  <p>Retention periods may vary depending on the type of data and applicable law.</p>
                </div>
              </Card>
            </article>

            <article id="your-rights">
              <Card>
                <div className="flex items-start mb-4">
                  <Users className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Your rights</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>Depending on your jurisdiction, you may have certain rights regarding your personal data, including:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
                    <li><strong>Correction:</strong> Ask us to correct inaccurate or incomplete information.</li>
                    <li><strong>Deletion:</strong> Request deletion of your personal data where we have no lawful reason to keep it.</li>
                    <li><strong>Portability:</strong> Request a machine-readable copy of your data.</li>
                    <li><strong>Objection:</strong> Object to certain processing (e.g., direct marketing).</li>
                  </ul>
                  <p>To exercise these rights, contact us using the details in the Contact section below. We may need to verify your identity before responding.</p>
                </div>
              </Card>
            </article>

            <article id="contact">
              <Card>
                <div className="flex items-start mb-4">
                  <Mail className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>If you have questions about this policy or want to exercise your rights, contact our Data Protection Officer:</p>
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
                  <p className="text-sm text-gray-600 mt-1">By using our service you agree to this policy. For more, see our <Link to="/terms" className="text-primary-600 hover:underline">Terms of Service</Link>.</p>
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

export default PrivacyPolicy;
