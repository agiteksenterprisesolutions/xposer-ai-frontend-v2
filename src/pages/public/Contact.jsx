import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Mail, Phone, Clock, HelpCircle, MapPin } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { Textarea } from '../../components/ui/Input';
import useSEO from '../../hooks/useSEO';

const Contact = () => {
  useSEO({
    title: 'Contact Us',
    description: 'Get in touch with the Xposer AI team for sales, support, or partnership enquiries.',
  });
    const [formState, setFormState] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFormState((prevState) => ({
            ...prevState,
            [name]: value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);

        await new Promise((resolve) => setTimeout(resolve, 500));

        setIsSubmitting(false);
        setFormState({ name: '', email: '', subject: '', message: '' });
        toast.success('Your message has been sent. We will respond soon.');
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mx-auto mb-4">
                        <HelpCircle className="w-10 h-10 text-primary-600" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Contact Us</h1>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        Need help with your report, account, or compliance question? Send us a message and our support team will get back to you shortly.
                    </p>
                </div>

                <div className="grid gap-8 xl:grid-cols-2">
                    <div className="space-y-6">
                        <Card padding="large" className="space-y-6">
                            <div>
                                <p className="text-sm font-semibold text-primary-600 uppercase tracking-[0.24em] mb-3">Get in touch</p>
                                <h2 className="text-2xl font-semibold text-gray-900">Support built for secure reporting.</h2>
                                <p className="mt-3 text-gray-600">We are available to answer questions about platform access, report status, privacy, or compliance. Choose the option that works best for you.</p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="rounded-3xl border border-gray-200 bg-white p-5">
                                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 mb-4">
                                        <Mail className="w-5 h-5" />
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 mb-1">Email Support</p>
                                    <a href="mailto:support@xposer.ai" className="text-sm text-primary-600 hover:underline">support@xposer.ai</a>
                                </div>

                                <div className="rounded-3xl border border-gray-200 bg-white p-5">
                                    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 mb-4">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 mb-1">Response Time</p>
                                    <p className="text-sm text-gray-600">Most requests are answered within 24 hours.</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <Card padding="large" className="overflow-hidden">
                        <div className="mb-8">
                            <p className="text-sm font-semibold text-primary-600 uppercase tracking-[0.24em] mb-3">Send us a message</p>
                            <h2 className="text-2xl font-semibold text-gray-900 mt-3">Contact form</h2>
                            <p className="mt-3 text-gray-600">Share a few details and our team will get back to you as soon as possible.</p>
                        </div>

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Input
                                    label="Your name"
                                    name="name"
                                    value={formState.name}
                                    onChange={handleChange}
                                    required
                                />
                                <Input
                                    label="Email address"
                                    type="email"
                                    name="email"
                                    value={formState.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <Input
                                label="Subject"
                                name="subject"
                                value={formState.subject}
                                onChange={handleChange}
                                required
                            />

                            <Textarea
                                label="Message"
                                name="message"
                                rows={6}
                                value={formState.message}
                                onChange={handleChange}
                                required
                            />

                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-gray-500">
                                    Need urgent help? <a href="mailto:support@xpose.ai" className="text-primary-600 hover:underline">Email support directly.</a>
                                </div>
                                <Button type="submit" variant="secondary" isLoading={isSubmitting}>
                                    Send message
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Contact;
