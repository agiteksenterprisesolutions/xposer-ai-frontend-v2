// src/pages/public/Help.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  FileText,
  MessageCircle,
  Shield,
  Users,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Clock,
  Book,
  Eye,
  Settings,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Alert from '../../components/ui/Alert';
import { SUPPORT_EMAIL } from '../../utils/constants';
import useSEO from '../../hooks/useSEO';

const Help = () => {
  useSEO({
    title: 'Help Center',
    description: 'Guides and answers for submitting, tracking, and managing reports on Xposer AI.',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Topics', icon: Book },
    { id: 'getting-started', name: 'Getting Started', icon: FileText },
    { id: 'reporting', name: 'Reporting', icon: MessageCircle },
    { id: 'privacy', name: 'Privacy & Security', icon: Shield },
    { id: 'account', name: 'Account Management', icon: Users },
    { id: 'technical', name: 'Technical Support', icon: Settings }
  ];

  const faqs = [
    {
      id: 1,
      category: 'getting-started',
      question: 'What is this whistleblowing platform?',
      answer: 'Our platform provides a secure, confidential channel for reporting misconduct, unethical behavior, or violations of laws and regulations. It is designed to protect whistleblowers while ensuring reports are properly investigated and addressed.'
    },
    {
      id: 2,
      category: 'getting-started',
      question: 'Who can use this platform?',
      answer: 'The platform is available to employees, contractors, suppliers, customers, and anyone who wishes to report concerns about an organization. Both anonymous and identified reporting options are available.'
    },
    {
      id: 3,
      category: 'reporting',
      question: 'How do I submit a report?',
      answer: 'You can submit a report by clicking "Submit a Report" and filling out the reporting form. You can choose to submit anonymously or provide your contact information. Include as much detail as possible to help investigators understand and address the concern.'
    },
    {
      id: 4,
      category: 'reporting',
      question: 'Can I submit a report anonymously?',
      answer: 'Yes, you can submit reports completely anonymously. When you choose anonymous reporting, we do not collect any identifying information. You will receive a unique tracking code to check the status of your report without revealing your identity.'
    },
    {
      id: 5,
      category: 'reporting',
      question: 'What types of concerns can I report?',
      answer: 'You can report various concerns including fraud, corruption, harassment, discrimination, safety violations, environmental issues, conflicts of interest, data breaches, and violations of company policies or applicable laws.'
    },
    {
      id: 6,
      category: 'reporting',
      question: 'What happens after I submit a report?',
      answer: 'After submission, you will receive an acknowledgment within 7 days. Your report will be reviewed by designated investigators who will assess the concern and take appropriate action. You can track the status of your report using your unique tracking code.'
    },
    {
      id: 7,
      category: 'reporting',
      question: 'How long does the investigation process take?',
      answer: 'Investigation timelines vary depending on the complexity of the concern. In most cases, you can expect feedback within 3 months. For urgent matters, investigations may proceed more quickly. You can check the status of your report at any time using your tracking code.'
    },
    {
      id: 8,
      category: 'reporting',
      question: 'Can I add additional information to my report after submission?',
      answer: 'Yes, you can add supplementary information or respond to investigator questions by accessing your report with your tracking code. This allows for ongoing communication throughout the investigation process.'
    },
    {
      id: 9,
      category: 'privacy',
      question: 'How is my identity protected?',
      answer: 'We use industry-leading security measures including end-to-end encryption, secure data storage, and strict access controls. For anonymous reports, no identifying information is collected. For identified reports, your information is kept strictly confidential and shared only with authorized investigators on a need-to-know basis.'
    },
    {
      id: 10,
      category: 'privacy',
      question: 'Is my data encrypted?',
      answer: 'Yes, all data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. This ensures that your report and any attachments are protected from unauthorized access at all times.'
    },
    {
      id: 11,
      category: 'privacy',
      question: 'Who can see my report?',
      answer: 'Reports are only accessible to authorized investigators and compliance personnel who need to review them. Access is logged and monitored to ensure accountability. Investigators are bound by confidentiality obligations and trained in whistleblower protection.'
    },
    {
      id: 12,
      category: 'privacy',
      question: 'What is your data retention policy?',
      answer: 'We retain report data only as long as necessary for investigation and compliance purposes. Retention periods comply with legal requirements and organizational policies. You can request information about retention periods for your specific report.'
    },
    {
      id: 13,
      category: 'privacy',
      question: 'Am I protected from retaliation?',
      answer: 'Organizations using our platform are committed to protecting whistleblowers from retaliation. If you experience retaliation, you should report it immediately through the platform. Many jurisdictions also provide legal protections for whistleblowers.'
    },
    {
      id: 14,
      category: 'account',
      question: 'Do I need to create an account to submit a report?',
      answer: 'No, you do not need an account to submit a report. Anonymous reporting is available without any registration. However, creating an account can make it easier to track multiple reports and receive notifications.'
    },
    {
      id: 15,
      category: 'account',
      question: 'How do I track my report?',
      answer: 'When you submit a report, you receive a unique tracking code. Use this code on the "Track a Report" page to check the status, view updates, and add additional information. Keep your tracking code secure as it provides access to your report.'
    },
    {
      id: 16,
      category: 'account',
      question: 'I lost my tracking code. What should I do?',
      answer: 'If you provided contact information when submitting your report, contact our support team for assistance. For completely anonymous reports without contact information, tracking codes cannot be recovered for security reasons. We recommend saving your tracking code in a secure location immediately after submission.'
    },
    {
      id: 17,
      category: 'account',
      question: 'How do I reset my password?',
      answer: 'Click the "Forgot Password" link on the login page and enter your email address. You will receive a password reset link via email. Follow the link to create a new password. If you do not receive the email, check your spam folder or contact support.'
    },
    {
      id: 18,
      category: 'technical',
      question: 'What file types can I attach to my report?',
      answer: 'You can attach documents (PDF, DOC, DOCX), images (JPG, PNG, GIF), spreadsheets (XLS, XLSX, CSV), and compressed files (ZIP). Maximum file size is 25MB per file. If you need to submit larger files, contact support for assistance.'
    },
    {
      id: 19,
      category: 'technical',
      question: 'The platform is not working properly. What should I do?',
      answer: 'First, try clearing your browser cache and cookies, or try a different browser. Ensure your browser is up to date. If issues persist, contact our technical support team with details about the problem, your browser version, and operating system.'
    },
    {
      id: 20,
      category: 'technical',
      question: 'Is the platform accessible on mobile devices?',
      answer: 'Yes, the platform is fully responsive and works on smartphones and tablets. We recommend using the latest version of your mobile browser for the best experience. You can submit reports, track status, and communicate with investigators from any device.'
    },
    {
      id: 21,
      category: 'technical',
      question: 'Which browsers are supported?',
      answer: 'We support the latest versions of Chrome, Firefox, Safari, and Edge. For the best experience and security, we recommend keeping your browser updated to the latest version. Internet Explorer is not supported.'
    },
    {
      id: 22,
      category: 'privacy',
      question: 'Do you comply with GDPR?',
      answer: 'Yes, we are fully GDPR compliant. We implement privacy by design, support all GDPR rights (access, rectification, erasure, portability), and maintain comprehensive data processing records. See our Privacy Policy and Compliance pages for detailed information.'
    },
    {
      id: 23,
      category: 'reporting',
      question: 'Can I submit a report on behalf of someone else?',
      answer: 'Yes, you can submit a report about concerns you have witnessed or learned about, even if you are not directly affected. Provide as much detail as possible and indicate in your report that you are reporting on behalf of or about another person.'
    },
    {
      id: 24,
      category: 'reporting',
      question: 'What if my concern involves senior management?',
      answer: 'Reports involving senior management are handled with special protocols to ensure independence and objectivity. These reports may be escalated to the board of directors, audit committee, or external investigators as appropriate.'
    }
  ];

  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFaq = (id) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mx-auto mb-4">
            <HelpCircle className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Help Center</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions, browse resources, and get support for using our whistleblowing platform.
          </p>
        </div>

        {/* Search Bar */}
        <Card className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link to="/submit-anonymous">
            <Card padding="small" className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start">
                <div className="skrink-0">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-gray-900">Submit a Report</h3>
                  <p className="text-xs text-gray-600 mt-1">Report a concern securely</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/track-report">
            <Card padding="small" className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start">
                <div className="skrink-0">
                  <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg">
                    <Eye className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-gray-900">Track a Report</h3>
                  <p className="text-xs text-gray-600 mt-1">Check your report status</p>
                </div>
              </div>
            </Card>
          </Link>

          <a href={`mailto:${SUPPORT_EMAIL}`}>
            <Card padding="small" className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start">
                <div className="skrink-0">
                  <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg">
                    <Mail className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-gray-900">Email Support</h3>
                  <p className="text-xs text-gray-600 mt-1">Get help via email</p>
                </div>
              </div>
            </Card>
          </a>

          <Link to="/security">
            <Card padding="small" className="h-full hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start">
                <div className="skrink-0">
                  <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-lg">
                    <Shield className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-gray-900">Security Info</h3>
                  <p className="text-xs text-gray-600 mt-1">Learn about our security</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <Card padding="small" className="sticky top-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Categories</h3>
              <nav className="space-y-1">
                {categories.map((category) => {
                  const Icon = category.icon;
                  const isActive = selectedCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${isActive
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {category.name}
                    </button>
                  );
                })}
              </nav>
            </Card>

            <Card padding="small" className="mt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Support</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start">
                  <Mail className="w-4 h-4 mr-2 mt-0.5 text-primary-600 skrink-0" />
                  <div>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-600 hover:underline">
                      {SUPPORT_EMAIL}
                    </a>
                  </div>
                </div>
                <div className="flex items-start">
                  <Phone className="w-4 h-4 mr-2 mt-0.5 text-primary-600 skrink-0" />
                  <div>
                    <p>+1 (555) 123-4567</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Clock className="w-4 h-4 mr-2 mt-0.5 text-primary-600 skrink-0" />
                  <div>
                    <p>Mon-Fri: 9AM - 6PM EST</p>
                  </div>
                </div>
              </div>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 space-y-6">
            {/* Alert for no results */}
            {searchQuery && filteredFaqs.length === 0 && (
              <Alert variant="warning">
                <div className="flex items-start">
                  <div>
                    <p className="font-medium">No results found</p>
                    <p className="text-sm mt-1">
                      Try different keywords or browse by category. If you can't find what you're looking for, contact our support team.
                    </p>
                  </div>
                </div>
              </Alert>
            )}

            {/* FAQs Section */}
            <article>
              <Card>
                <div className="flex items-start mb-4">
                  <HelpCircle className="w-5 h-5 text-primary-600 mr-3" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      Frequently Asked Questions
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {filteredFaqs.length} {filteredFaqs.length === 1 ? 'question' : 'questions'} found
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  {filteredFaqs.map((faq) => (
                    <div
                      key={faq.id}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleFaq(faq.id)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="font-medium text-gray-900 text-sm pr-4">
                          {faq.question}
                        </span>
                        {openFaqId === faq.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400 skrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400 skrink-0" />
                        )}
                      </button>
                      {openFaqId === faq.id && (
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                          <p className="text-sm text-gray-700">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </article>

          </main>
        </div>
      </div>
    </div>
  );
};

export default Help;