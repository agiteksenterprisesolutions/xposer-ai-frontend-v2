// src/pages/public/CookiePolicy.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Cookie,
  FileText,
  Shield,
  Settings,
  BarChart,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Info
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { SUPPORT_EMAIL } from '../../utils/constants';
import useSEO from '../../hooks/useSEO';

const CookiePolicy = () => {
  useSEO({
    title: 'Cookie Policy',
    description: 'Which cookies Xposer AI uses, what they do, and how you can control them.',
  });
  const lastUpdated = 'January 30, 2026';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mx-auto mb-4">
            <Cookie className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Cookie Policy</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            This Cookie Policy explains how we use cookies and similar technologies to recognize you when you visit our whistleblowing platform.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar / TOC */}
          <aside className="lg:col-span-1">
            <Card padding="small" className="sticky top-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">On This Page</h3>
              <nav className="text-sm text-gray-600 space-y-2">
                <a href="#what-are-cookies" className="block hover:text-primary-600">What are cookies</a>
                <a href="#why-we-use" className="block hover:text-primary-600">Why we use cookies</a>
                <a href="#types" className="block hover:text-primary-600">Types of cookies</a>
                <a href="#third-party" className="block hover:text-primary-600">Third-party cookies</a>
                <a href="#manage" className="block hover:text-primary-600">Manage cookies</a>
                <a href="#updates" className="block hover:text-primary-600">Policy updates</a>
                <a href="#contact" className="block hover:text-primary-600">Contact</a>
              </nav>
            </Card>

            <Card padding="small" className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="flex flex-col space-y-2">
                <Link to="/privacy" className="text-sm text-primary-600 hover:text-primary-700">Privacy Policy</Link>
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
                  <p className="font-medium">Cookie Notice</p>
                  <p className="text-sm mt-1">By continuing to use our platform, you consent to our use of cookies as described in this policy. You can manage your cookie preferences at any time through your browser settings.</p>
                </div>
              </div>
            </Alert>

            <article id="what-are-cookies">
              <Card>
                <div className="flex items-start mb-4">
                  <Info className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">What are cookies?</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and provide information to the site owners.</p>
                  <p>Cookies can be "persistent" or "session" cookies. Persistent cookies remain on your device after you close your browser, while session cookies are deleted when you close your browser.</p>
                </div>
              </Card>
            </article>

            <article id="why-we-use">
              <Card>
                <div className="flex items-start mb-4">
                  <FileText className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Why we use cookies</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We use cookies for several important reasons:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong>Essential functionality:</strong> To enable core features like secure login, session management, and report tracking.</li>
                    <li><strong>Security:</strong> To protect against fraudulent activity and ensure secure communications.</li>
                    <li><strong>Performance:</strong> To understand how visitors use our platform and identify areas for improvement.</li>
                    <li><strong>User preferences:</strong> To remember your settings and preferences for a better experience.</li>
                    <li><strong>Analytics:</strong> To analyze site traffic and usage patterns to improve our services.</li>
                  </ul>
                </div>
              </Card>
            </article>

            <article id="types">
              <Card>
                <div className="flex items-start mb-4">
                  <Settings className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Types of cookies we use</h2>
                </div>
                <div className="space-y-4 text-gray-700 text-sm">
                  <div className="border-l-4 border-green-500 pl-4 py-2">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                      Essential Cookies
                    </h3>
                    <p className="mb-2">These cookies are necessary for the website to function and cannot be disabled in our systems. They are usually only set in response to actions you take, such as setting privacy preferences, logging in, or filling in forms.</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Session authentication cookies</li>
                      <li>Security cookies</li>
                      <li>Load balancing cookies</li>
                      <li>User interface customization cookies</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <BarChart className="w-4 h-4 mr-2 text-blue-500" />
                      Performance & Analytics Cookies
                    </h3>
                    <p className="mb-2">These cookies help us understand how visitors interact with our platform by collecting and reporting information anonymously. This helps us improve the way our website works.</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Google Analytics cookies</li>
                      <li>Page view tracking</li>
                      <li>Click tracking and heatmaps</li>
                      <li>Error reporting and diagnostics</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4 py-2">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <Settings className="w-4 h-4 mr-2 text-purple-500" />
                      Functional Cookies
                    </h3>
                    <p className="mb-2">These cookies enable enhanced functionality and personalization, such as remembering your preferences and settings. They may be set by us or by third-party providers.</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Language preference cookies</li>
                      <li>Theme and display preferences</li>
                      <li>Recently viewed reports</li>
                      <li>Notification preferences</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4 py-2">
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
                      Targeting & Advertising Cookies
                    </h3>
                    <p className="mb-2">We currently do not use advertising cookies on our platform. If this changes in the future, we will update this policy and seek your consent where required.</p>
                  </div>
                </div>
              </Card>
            </article>

            <article id="third-party">
              <Card>
                <div className="flex items-start mb-4">
                  <Shield className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Third-party cookies</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>In addition to our own cookies, we may use various third-party cookies to report usage statistics and deliver relevant content. These third parties include:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li><strong>Google Analytics:</strong> To analyze how users interact with our platform and improve our services.</li>
                    <li><strong>Content Delivery Networks (CDNs):</strong> To deliver static content quickly and reliably.</li>
                    <li><strong>Security providers:</strong> To protect against fraud, abuse, and security threats.</li>
                  </ul>
                  <p className="mt-3">These third parties have their own privacy policies and cookie policies. We encourage you to review their policies to understand how they use cookies and collect data.</p>
                </div>
              </Card>
            </article>

            <article id="manage">
              <Card>
                <div className="flex items-start mb-4">
                  <Settings className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">How to manage cookies</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>You have the right to decide whether to accept or reject cookies. You can exercise your cookie preferences by:</p>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3">
                    <h4 className="font-semibold text-gray-900 mb-2">Browser Settings</h4>
                    <p className="mb-2">Most web browsers allow you to control cookies through their settings. You can:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>View what cookies are stored and delete them individually</li>
                      <li>Block third-party cookies</li>
                      <li>Block cookies from particular sites</li>
                      <li>Block all cookies from being set</li>
                      <li>Delete all cookies when you close your browser</li>
                    </ul>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Browser-Specific Instructions</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</li>
                      <li><strong>Firefox:</strong> Options → Privacy & Security → Cookies and Site Data</li>
                      <li><strong>Safari:</strong> Preferences → Privacy → Cookies and website data</li>
                      <li><strong>Edge:</strong> Settings → Cookies and site permissions → Cookies and site data</li>
                    </ul>
                  </div>

                  <Alert variant="warning" className="">
                    <div className="flex items-start">
                      <div>
                        <p className="font-medium">Important Note</p>
                        <p className="text-sm mt-1">If you choose to block or delete cookies, some features of our platform may not function properly. Essential cookies are required for core functionality like secure login and report tracking.</p>
                      </div>
                    </div>
                  </Alert>

                  <div className="mt-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Opt-out Links</h4>
                    <p className="mb-2">You can also opt out of certain third-party cookies:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Google Analytics: <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Google Analytics Opt-out Browser Add-on</a></li>
                      <li>Network Advertising Initiative: <a href="http://www.networkadvertising.org/choices/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">NAI Opt-out Tool</a></li>
                    </ul>
                  </div>
                </div>
              </Card>
            </article>

            <article id="updates">
              <Card>
                <div className="flex items-start mb-4">
                  <FileText className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Changes to this Cookie Policy</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the new Cookie Policy on this page and updating the "Last Updated" date.</p>
                  <p>We encourage you to review this Cookie Policy periodically to stay informed about how we use cookies.</p>
                </div>
              </Card>
            </article>

            <article id="contact">
              <Card>
                <div className="flex items-start mb-4">
                  <Info className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Contact us</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>If you have questions or concerns about our use of cookies or this Cookie Policy, please contact us:</p>
                  <div className="mt-2">
                    <p className="text-sm"><strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 hover:underline">{SUPPORT_EMAIL}</a></p>
                    <p className="text-sm"><strong>Support:</strong> <Link to="/help" className="text-primary-600 hover:underline">Help Center</Link></p>
                  </div>
                  <p className="mt-3">For more information about how we handle your personal data, please see our <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>.</p>
                </div>
              </Card>
            </article>

            <Card>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">Last updated: <span className="font-medium text-gray-900">{lastUpdated}</span></p>
                  <p className="text-sm text-gray-600 mt-1">For more details, see our <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link> and <Link to="/terms" className="text-primary-600 hover:underline">Terms of Service</Link>.</p>
                </div>

                <div className="hidden sm:block shrink-0">
                  <Link to="/submit-anonymous">
                    <Button variant="secondary" size="medium" className="cursor-pointer">
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

export default CookiePolicy;