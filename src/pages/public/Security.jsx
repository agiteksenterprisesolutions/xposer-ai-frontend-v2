// src/pages/public/Security.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  Key,
  Server,
  Eye,
  AlertTriangle,
  CheckCircle,
  FileText,
  Users,
  ArrowRight,
  Info,
  Zap,
  Database,
  Code,
  ShieldAlert,
  Clock
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Alert from '../../components/ui/Alert';
import useSEO from '../../hooks/useSEO';

const Security = () => {
  useSEO({
    title: 'Security',
    description:
      'Encryption, access controls, and infrastructure practices that keep reports and reporters safe on Xposer AI.',
    keywords: ['data security', 'encryption', 'whistleblower protection'],
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
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Security</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Security and privacy are at the core of our whistleblowing platform. We implement comprehensive security measures to protect your data and maintain confidentiality.
          </p>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar / TOC */}
          <aside className="lg:col-span-1">
            <Card padding="small" className="sticky top-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">On This Page</h3>
              <nav className="text-sm text-gray-600 space-y-2">
                <a href="#overview" className="block hover:text-primary-600">Security Overview</a>
                <a href="#encryption" className="block hover:text-primary-600">Encryption</a>
                <a href="#infrastructure" className="block hover:text-primary-600">Infrastructure</a>
                <a href="#access-control" className="block hover:text-primary-600">Access Control</a>
                <a href="#monitoring" className="block hover:text-primary-600">Monitoring</a>
                <a href="#vulnerability" className="block hover:text-primary-600">Vulnerability Management</a>
                <a href="#incident" className="block hover:text-primary-600">Incident Response</a>
                <a href="#best-practices" className="block hover:text-primary-600">Best Practices</a>
                <a href="#reporting" className="block hover:text-primary-600">Report Security Issues</a>
              </nav>
            </Card>

            <Card padding="small" className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
              <div className="flex flex-col space-y-2">
                <Link to="/compliance" className="text-sm text-primary-600 hover:text-primary-700">Compliance</Link>
                <Link to="/privacy" className="text-sm text-primary-600 hover:text-primary-700">Privacy Policy</Link>
                <Link to="/terms" className="text-sm text-primary-600 hover:text-primary-700">Terms of Service</Link>
                <Link to="/submit-anonymous" className="text-sm text-primary-600 hover:text-primary-700">Submit Anonymous Report</Link>
              </div>
            </Card>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-3 space-y-6">
            <Alert variant="info">
              <div className="flex items-start">
                <div>
                  <p className="font-medium">Our Security Commitment</p>
                  <p className="text-sm mt-1">We take security seriously and continuously work to protect your information with industry-leading security practices and technologies.</p>
                </div>
              </div>
            </Alert>

            <article id="overview">
              <Card>
                <div className="flex items-start mb-4">
                  <Shield className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Security Overview</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>Our security program is designed to protect the confidentiality, integrity, and availability of all data on our platform. We employ a defense-in-depth strategy with multiple layers of security controls.</p>
                  
                  <div className="grid sm:grid-cols-3 gap-4 mt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                      <Lock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">Confidentiality</h3>
                      <p className="text-xs text-gray-600">Data is protected from unauthorized access</p>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">Integrity</h3>
                      <p className="text-xs text-gray-600">Data accuracy and completeness is maintained</p>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                      <Zap className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">Availability</h3>
                      <p className="text-xs text-gray-600">Services are accessible when needed</p>
                    </div>
                  </div>
                </div>
              </Card>
            </article>

            <article id="encryption">
              <Card>
                <div className="flex items-start mb-4">
                  <Lock className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Encryption</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We use industry-standard encryption to protect your data at every stage:</p>
                  
                  <div className="space-y-4 mt-4">
                    <div className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex items-start mb-2">
                        <Key className="w-4 h-4 text-blue-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">Data in Transit</h3>
                      </div>
                      <ul className="list-disc list-inside space-y-1 ml-6 text-sm">
                        <li>TLS 1.3 encryption for all network communications</li>
                        <li>Perfect Forward Secrecy (PFS) to protect past sessions</li>
                        <li>Strong cipher suites only (AES-256-GCM)</li>
                        <li>HSTS (HTTP Strict Transport Security) enforcement</li>
                        <li>Certificate pinning for mobile applications</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4 py-2">
                      <div className="flex items-start mb-2">
                        <Database className="w-4 h-4 text-green-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">Data at Rest</h3>
                      </div>
                      <ul className="list-disc list-inside space-y-1 ml-6 text-sm">
                        <li>AES-256 encryption for all stored data</li>
                        <li>Encrypted database storage with rotating keys</li>
                        <li>Encrypted file storage for attachments</li>
                        <li>Encrypted backups with separate key management</li>
                        <li>Hardware Security Modules (HSMs) for key storage</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-purple-500 pl-4 py-2">
                      <div className="flex items-start mb-2">
                        <Shield className="w-4 h-4 text-purple-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">End-to-End Encryption</h3>
                      </div>
                      <p className="ml-6 text-sm">For maximum security, sensitive report data can be encrypted end-to-end, ensuring that only authorized investigators can decrypt and view the information.</p>
                    </div>
                  </div>
                </div>
              </Card>
            </article>

            <article id="infrastructure">
              <Card>
                <div className="flex items-start mb-4">
                  <Server className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Infrastructure Security</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>Our infrastructure is built on secure, reliable cloud platforms with multiple layers of protection:</p>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start mb-2">
                        <Server className="w-4 h-4 text-primary-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">Cloud Security</h3>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>SOC 2 Type II certified infrastructure</li>
                        <li>Geographically distributed data centers</li>
                        <li>Automated failover and redundancy</li>
                        <li>Regular security patches and updates</li>
                      </ul>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start mb-2">
                        <Shield className="w-4 h-4 text-primary-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">Network Security</h3>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Web Application Firewall (WAF)</li>
                        <li>DDoS protection and mitigation</li>
                        <li>Network segmentation and isolation</li>
                        <li>Intrusion Detection Systems (IDS)</li>
                      </ul>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start mb-2">
                        <Database className="w-4 h-4 text-primary-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">Data Isolation</h3>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Logical data separation per organization</li>
                        <li>Dedicated database instances available</li>
                        <li>Private cloud deployment options</li>
                        <li>Data residency controls</li>
                      </ul>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start mb-2">
                        <CheckCircle className="w-4 h-4 text-primary-600 mr-2 mt-0.5 skrink-0" />
                        <h3 className="font-semibold text-gray-900">Backup & Recovery</h3>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Automated daily encrypted backups</li>
                        <li>Point-in-time recovery capabilities</li>
                        <li>Geographic backup replication</li>
                        <li>Regular disaster recovery testing</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </Card>
            </article>

            <article id="access-control">
              <Card>
                <div className="flex items-start mb-4">
                  <Key className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Access Control & Authentication</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We implement strict access controls to ensure that only authorized users can access data:</p>
                  
                  <div className="space-y-3 mt-4">
                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Multi-Factor Authentication (MFA)</h4>
                        <p className="text-sm">Required for all administrative accounts and available for all users. Supports TOTP, SMS, and hardware security keys.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Role-Based Access Control (RBAC)</h4>
                        <p className="text-sm">Granular permissions system ensures users can only access data relevant to their role and responsibilities.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Principle of Least Privilege</h4>
                        <p className="text-sm">Users and systems are granted the minimum level of access required to perform their functions.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Session Management</h4>
                        <p className="text-sm">Secure session tokens, automatic timeout after inactivity, and the ability to remotely terminate sessions.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Password Security</h4>
                        <p className="text-sm">Strong password requirements, secure hashing (bcrypt), protection against credential stuffing, and support for password managers.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900">Single Sign-On (SSO)</h4>
                        <p className="text-sm">Enterprise SSO support via SAML 2.0 and OAuth 2.0 for seamless and secure authentication.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </article>

            <article id="monitoring">
              <Card>
                <div className="flex items-start mb-4">
                  <Eye className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Security Monitoring & Logging</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We continuously monitor our systems to detect and respond to security threats:</p>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3">
                    <h4 className="font-semibold text-gray-900 mb-3">24/7 Security Operations</h4>
                    <ul className="list-disc list-inside space-y-2 text-sm">
                      <li><strong>Real-time monitoring:</strong> Automated alerting for suspicious activities and security events</li>
                      <li><strong>Security Information and Event Management (SIEM):</strong> Centralized logging and correlation of security events</li>
                      <li><strong>Audit logs:</strong> Comprehensive logging of all access and modifications to sensitive data</li>
                      <li><strong>Anomaly detection:</strong> Machine learning-based detection of unusual patterns and behaviors</li>
                      <li><strong>Threat intelligence:</strong> Integration with threat intelligence feeds to identify known threats</li>
                      <li><strong>Log retention:</strong> Security logs retained for minimum 1 year for forensic analysis</li>
                    </ul>
                  </div>

                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mt-3">
                    <div className="flex items-start">
                      <Info className="w-5 h-5 text-primary-600 mr-3 skrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Transparency</h4>
                        <p className="text-sm">Users with appropriate permissions can access audit logs to review access to their reports and data.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </article>

            <article id="vulnerability">
              <Card>
                <div className="flex items-start mb-4">
                  <ShieldAlert className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Vulnerability Management</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We proactively identify and remediate security vulnerabilities through a comprehensive vulnerability management program:</p>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="border-l-4 border-orange-500 pl-4 py-2">
                      <h3 className="font-semibold text-gray-900 mb-2">Regular Scanning</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Weekly automated vulnerability scans</li>
                        <li>Continuous dependency monitoring</li>
                        <li>Static Application Security Testing (SAST)</li>
                        <li>Dynamic Application Security Testing (DAST)</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-red-500 pl-4 py-2">
                      <h3 className="font-semibold text-gray-900 mb-2">Penetration Testing</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Annual third-party penetration tests</li>
                        <li>Testing of both infrastructure and applications</li>
                        <li>Simulated attack scenarios</li>
                        <li>Detailed remediation reporting</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-yellow-500 pl-4 py-2">
                      <h3 className="font-semibold text-gray-900 mb-2">Bug Bounty Program</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Responsible disclosure program</li>
                        <li>Rewards for valid security findings</li>
                        <li>Collaboration with security researchers</li>
                        <li>Transparent communication process</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4 py-2">
                      <h3 className="font-semibold text-gray-900 mb-2">Patch Management</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Critical patches within 24-48 hours</li>
                        <li>Regular update schedule for all systems</li>
                        <li>Testing in staging before production</li>
                        <li>Zero-downtime deployment processes</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </Card>
            </article>

            <article id="incident">
              <Card>
                <div className="flex items-start mb-4">
                  <AlertTriangle className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Incident Response</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We maintain a comprehensive incident response plan to quickly detect, contain, and remediate security incidents:</p>
                  
                  <div className="space-y-3 mt-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-red-600" />
                        Incident Response Process
                      </h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm">
                        <li><strong>Detection:</strong> Automated alerting and monitoring systems identify potential incidents</li>
                        <li><strong>Analysis:</strong> Security team assesses the scope and severity of the incident</li>
                        <li><strong>Containment:</strong> Immediate action to prevent further damage or data exposure</li>
                        <li><strong>Eradication:</strong> Remove the threat and address the root cause</li>
                        <li><strong>Recovery:</strong> Restore systems and services to normal operation</li>
                        <li><strong>Post-Incident Review:</strong> Document lessons learned and improve processes</li>
                      </ol>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Response Times</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>Critical incidents: Immediate response</li>
                          <li>High severity: Within 1 hour</li>
                          <li>Medium severity: Within 4 hours</li>
                          <li>Low severity: Within 24 hours</li>
                        </ul>
                      </div>

                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Communication</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>Timely notification to affected users</li>
                          <li>Transparent incident reporting</li>
                          <li>Regulatory compliance notifications</li>
                          <li>Post-incident summary reports</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </article>

            <article id="best-practices">
              <Card>
                <div className="flex items-start mb-4">
                  <Code className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Secure Development Practices</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>Security is integrated into every phase of our software development lifecycle:</p>
                  
                  <div className="space-y-2 mt-4">
                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 skrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Security by Design</h4>
                        <p className="text-sm">Security requirements are identified and addressed from the initial design phase.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 skrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Code Review</h4>
                        <p className="text-sm">All code changes undergo peer review with security considerations before deployment.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 skrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Automated Testing</h4>
                        <p className="text-sm">Continuous integration pipelines include security tests, dependency checks, and vulnerability scans.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 skrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Developer Training</h4>
                        <p className="text-sm">Regular security training for all developers on secure coding practices and emerging threats.</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <div className="w-2 h-2 bg-primary-600 rounded-full mt-2 mr-3 skrink-0"></div>
                      <div>
                        <h4 className="font-semibold text-gray-900">Dependency Management</h4>
                        <p className="text-sm">Automated monitoring and updating of third-party dependencies to address known vulnerabilities.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </article>

            <article id="reporting">
              <Card>
                <div className="flex items-start mb-4">
                  <FileText className="w-5 h-5 text-primary-600 mr-3" />
                  <h2 className="text-lg font-semibold text-gray-900">Report Security Issues</h2>
                </div>
                <div className="space-y-3 text-gray-700 text-sm">
                  <p>We take security vulnerabilities seriously and appreciate the security community's help in keeping our platform secure.</p>
                  
                  <Alert variant="warning" className="mt-4">
                    <div className="flex items-start">
                      <div>
                        <p className="font-medium">Responsible Disclosure</p>
                        <p className="text-sm mt-1">If you discover a security vulnerability, please report it responsibly. Do not exploit the vulnerability or access user data beyond what is necessary to demonstrate the issue.</p>
                      </div>
                    </div>
                  </Alert>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Include in Your Report</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Description of the vulnerability</li>
                      <li>Steps to reproduce the issue</li>
                      <li>Potential impact of the vulnerability</li>
                      <li>Any proof-of-concept code (if applicable)</li>
                      <li>Your contact information for follow-up</li>
                    </ul>
                  </div>

                  <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Our Commitment</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>We will acknowledge receipt within 24 hours</li>
                      <li>We will keep you informed of our progress</li>
                      <li>We will credit researchers who report valid vulnerabilities (if desired)</li>
                      <li>We will not pursue legal action against researchers who follow responsible disclosure</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </article>

            <Card>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">Last updated: <span className="font-medium text-gray-900">{lastUpdated}</span></p>
                  <p className="text-sm text-gray-600 mt-1">For more information, see our <Link to="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link> and <Link to="/compliance" className="text-primary-600 hover:underline">Compliance</Link> pages.</p>
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

export default Security;