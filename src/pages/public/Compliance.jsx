// src/pages/public/Compliance.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  Globe,
  Lock,
  Scale,
  CheckCircle,
  AlertTriangle,
  Users,
  ArrowRight,
  Info,
  Award,
  Eye
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import { SUPPORT_EMAIL } from '../../utils/constants';
import useSEO from '../../hooks/useSEO';

const Compliance = () => {
  useSEO({
    title: 'Compliance',
    description:
      'How Xposer AI helps you meet the EU Whistleblower Directive, GDPR, SOX, and other reporting obligations.',
    keywords: ['EU Whistleblower Directive', 'GDPR', 'SOX', 'compliance reporting'],
  });
  const lastUpdated = 'January 30, 2026';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mx-auto mb-4">
            <ShieldCheck className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Compliance & Regulations</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Our whistleblowing platform is designed to meet the highest standards of regulatory compliance and data protection across multiple jurisdictions.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar / TOC */}
          <aside className="lg:col-span-1">
            <Card padding="small" className="sticky top-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">On This Page</h3>
              <nav className="text-sm text-gray-600 space-y-2">
                <a href="#overview" className="block hover:text-primary-600">Overview</a>
                <a href="#gdpr" className="block hover:text-primary-600">GDPR Compliance</a>
                <a href="#eu-directive" className="block hover:text-primary-600">EU Whistleblowing Directive</a>
                <a href="#data-protection" className="block hover:text-primary-600">Data Protection</a>
                <a href="#certifications" className="block hover:text-primary-600">Certifications</a>
                <a href="#transparency" className="block hover:text-primary-600">Transparency</a>
                <a href="#audits" className="block hover:text-primary-600">Audits & Reviews</a>
                <a href="#contact" className="block hover:text-primary-600">Contact</a>
              </nav>
            </Card>

            <Card padding="small" className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="flex flex-col space-y-2">
                <Link to="/privacy" className="text-sm text-primary-600 hover:text-primary-700">Privacy Policy</Link>
                <Link to="/terms" className="text-sm text-primary-600 hover:text-primary-700">Terms of Service</Link>
                <Link to="/cookie-policy" className="text-sm text-primary-600 hover:text-primary-700">Cookie Policy</Link>
                <Link to="/submit-anonymous" className="text-sm text-primary-600 hover:text-primary-700">Submit Anonymous Report</Link>
              </div>
            </Card>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-6">
            <Alert variant="info">
              <div className="flex items-start">
                <div>
                  <p className="font-medium">Commitment to Compliance</p>
                  <p className="text-sm mt-1">We are committed to maintaining the highest standards of compliance with applicable laws and regulations to protect whistleblowers and ensure the integrity of our platform.</p>
                </div>
              </div>
            </Alert>

            <article id="overview">
              <Card>
                <div className="flex items-start mb-4">
                  <Info className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Compliance Overview</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>Our whistleblowing platform is built with compliance at its core. We adhere to international standards and best practices to ensure that our service meets regulatory requirements across different jurisdictions.</p>
                  <p>Our compliance framework covers:</p>
                  <ul className="list-disc list-inside space-y-2">
                    <li>European Union regulations, including GDPR and the EU Whistleblowing Directive</li>
                    <li>Industry-specific compliance requirements</li>
                    <li>Data protection and privacy laws</li>
                    <li>Information security standards</li>
                    <li>Accessibility requirements</li>
                  </ul>
                </div>
              </Card>
            </article>

            <article id="gdpr">
              <Card>
                <div className="flex items-start mb-4">
                  <Globe className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">GDPR Compliance</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We are fully compliant with the General Data Protection Regulation (GDPR), the EU's comprehensive data protection law. Our GDPR compliance measures include:</p>

                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start mb-2">
                        <Lock className="w-4 h-4 text-primary-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">Data Protection by Design</h3>
                      </div>
                      <p className="text-sm">Privacy and data protection are embedded into our platform's architecture from the ground up.</p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start mb-2">
                        <Users className="w-4 h-4 text-primary-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">User Rights</h3>
                      </div>
                      <p className="text-sm">We support all GDPR rights including access, rectification, erasure, and data portability.</p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start mb-2">
                        <FileText className="w-4 h-4 text-primary-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">Legal Basis</h3>
                      </div>
                      <p className="text-sm">We process data only with lawful basis, including consent, legitimate interest, and legal obligation.</p>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start mb-2">
                        <AlertTriangle className="w-4 h-4 text-primary-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">Breach Notification</h3>
                      </div>
                      <p className="text-sm">We have procedures in place to detect, report, and investigate personal data breaches.</p>
                    </div>
                  </div>

                  <p className="mt-4">We maintain comprehensive records of processing activities and conduct Data Protection Impact Assessments (DPIAs) for high-risk processing operations.</p>
                </div>
              </Card>
            </article>

            <article id="eu-directive">
              <Card>
                <div className="flex items-start mb-4">
                  <Scale className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">EU Whistleblowing Directive</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>Our platform is designed to comply with Directive (EU) 2019/1937 on the protection of persons who report breaches of Union law. Key compliance features include:</p>

                  <div className="border-l-4 border-primary-500 pl-4 py-2">
                    <h3 className="font-semibold text-gray-900 mb-2">Secure Reporting Channels</h3>
                    <p>We provide secure internal and external reporting channels that ensure confidentiality and protect the identity of whistleblowers.</p>
                  </div>

                  <div className="border-l-4 border-primary-500 pl-4 py-2">
                    <h3 className="font-semibold text-gray-900 mb-2">Whistleblower Protection</h3>
                    <p>Our system is designed to prevent retaliation and protect whistleblowers from adverse consequences related to their reports.</p>
                  </div>

                  <div className="border-l-4 border-primary-500 pl-4 py-2">
                    <h3 className="font-semibold text-gray-900 mb-2">Acknowledgment & Follow-up</h3>
                    <p>We provide acknowledgment of receipt within 7 days and ensure diligent follow-up on reports, with feedback provided within 3 months when reasonably expected.</p>
                  </div>

                  <div className="border-l-4 border-primary-500 pl-4 py-2">
                    <h3 className="font-semibold text-gray-900 mb-2">Record Keeping</h3>
                    <p>We maintain appropriate records of reports and actions taken while respecting data minimization principles and retention limits.</p>
                  </div>

                  <p className="mt-4">The platform supports both named and anonymous reporting, with robust measures to maintain confidentiality in accordance with the Directive's requirements.</p>
                </div>
              </Card>
            </article>

            <article id="data-protection">
              <Card>
                <div className="flex items-start mb-4">
                  <Lock className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Data Protection & Security</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We implement industry-leading security measures to protect the confidentiality, integrity, and availability of all data processed through our platform:</p>

                  <div className="space-y-3 mt-4">
                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Encryption</h4>
                        <p className="text-sm">End-to-end encryption for data in transit (TLS 1.3) and at rest (AES-256), with encrypted database storage and secure key management.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Access Controls</h4>
                        <p className="text-sm">Role-based access control (RBAC), multi-factor authentication (MFA), and principle of least privilege enforcement.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Network Security</h4>
                        <p className="text-sm">Firewalls, intrusion detection systems (IDS), regular vulnerability scanning, and penetration testing.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Data Minimization</h4>
                        <p className="text-sm">We collect only the minimum data necessary for processing reports and delete data when no longer needed.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Secure Development</h4>
                        <p className="text-sm">Security-by-design approach, code reviews, automated security testing, and regular security updates.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Incident Response</h4>
                        <p className="text-sm">24/7 monitoring, incident response plan, and procedures for breach notification in compliance with applicable laws.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </article>

            <article id="certifications">
              <Card>
                <div className="flex items-start mb-4">
                  <Award className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Certifications & Standards</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We maintain industry-recognized certifications and adhere to international standards to demonstrate our commitment to security and compliance:</p>

                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <div className="bg-linear-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">ISO 27001</h3>
                      <p className="text-sm">Information Security Management System certification ensuring systematic approach to managing sensitive information.</p>
                    </div>

                    <div className="bg-linear-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">ISO 27701</h3>
                      <p className="text-sm">Privacy Information Management System extension demonstrating privacy controls and GDPR alignment.</p>
                    </div>

                    <div className="bg-linear-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">SOC 2 Type II</h3>
                      <p className="text-sm">Independent audit report on security, availability, and confidentiality of our systems and processes.</p>
                    </div>

                    <div className="bg-linear-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">WCAG 2.1 Level AA</h3>
                      <p className="text-sm">Web Content Accessibility Guidelines compliance ensuring platform accessibility for all users.</p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-gray-600">Certification status and audit reports are reviewed and updated annually. Contact us for the most recent certification documentation.</p>
                </div>
              </Card>
            </article>

            <article id="transparency">
              <Card>
                <div className="flex items-start mb-4">
                  <Eye className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Transparency & Accountability</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We believe in transparency and accountability in all aspects of our operations:</p>

                  <ul className="list-disc list-inside space-y-2">
                    <li><strong>Clear policies:</strong> We maintain publicly accessible policies that clearly explain our practices and commitments.</li>
                    <li><strong>Data Processing Records:</strong> We document all data processing activities and make relevant information available to users.</li>
                    <li><strong>Vendor management:</strong> We carefully vet third-party service providers and ensure they meet our security and compliance standards.</li>
                    <li><strong>Transparency reports:</strong> We publish periodic transparency reports detailing platform usage, security incidents, and compliance metrics.</li>
                    <li><strong>Open communication:</strong> We maintain open channels for users to ask questions, report concerns, and provide feedback.</li>
                  </ul>

                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mt-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Data Processing Agreement (DPA)</h4>
                    <p className="text-sm">For organizations using our platform, we provide a comprehensive Data Processing Agreement that outlines our obligations as a data processor and ensures GDPR compliance for joint data processing activities.</p>
                  </div>
                </div>
              </Card>
            </article>

            <article id="audits">
              <Card>
                <div className="flex items-start mb-4">
                  <FileText className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Audits & Continuous Improvement</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We conduct regular audits and assessments to ensure ongoing compliance and continuous improvement:</p>

                  <div className="space-y-2 mt-3">
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 skrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Internal Audits</h4>
                        <p className="text-sm">Quarterly internal security and compliance audits to identify and address potential issues.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 skrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">External Audits</h4>
                        <p className="text-sm">Annual third-party security audits and penetration testing by certified security professionals.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 skrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Compliance Reviews</h4>
                        <p className="text-sm">Regular reviews of regulatory changes and updates to ensure ongoing compliance with evolving requirements.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 skrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">User Feedback</h4>
                        <p className="text-sm">We actively collect and incorporate user feedback to improve security, privacy, and usability.</p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4">All audit findings are documented, and remediation actions are tracked to completion. Critical findings are addressed immediately.</p>
                </div>
              </Card>
            </article>

            <article id="contact">
              <Card>
                <div className="flex items-start mb-4">
                  <Info className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Compliance Contact</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>For questions about our compliance practices, to request documentation, or to report a compliance concern:</p>
                  <p className="text-sm"><strong>General Support:</strong> <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 hover:underline">{SUPPORT_EMAIL}</a></p>
                  <p className="text-sm"><strong>Help Center:</strong> <Link to="/help" className="text-primary-600 hover:underline">Visit Help Center</Link></p>
                  <p className="mt-3">We welcome questions and feedback about our compliance practices and are committed to addressing all inquiries promptly.</p>
                </div>
              </Card>
            </article>

            <Card>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">Last updated: <span className="font-medium text-gray-900">{lastUpdated}</span></p>
                  <p className="text-sm text-gray-600 mt-1">For more information, see our <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link> and <Link to="/terms" className="text-primary-600 hover:underline">Terms of Service</Link>.</p>
                </div>

                <div className="hidden sm:block skrink-0">
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

export default Compliance;