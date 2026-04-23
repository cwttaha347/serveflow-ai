import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, FileText, CheckCircle } from 'lucide-react';

const PrivacyPolicy = () => {
    const navigate = useNavigate();

    const Section = ({ title, icon: Icon, children }) => (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                    <Icon className="w-5 h-5" />
                </div>
                {title}
            </h2>
            <div className="text-slate-600 dark:text-slate-300 leading-relaxed pl-12">
                {children}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => navigate('/')}
                    className="mb-8 text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                    &larr; Back to Home
                </button>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    {/* Header */}
                    <div className="bg-blue-600 text-white p-12 text-center relative overflow-hidden">
                        <div className="relative z-10">
                            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
                            <p className="text-blue-100 text-lg max-w-2xl mx-auto">
                                We are committed to protecting your privacy and ensuring you have a secure experience on our platform.
                            </p>
                        </div>

                        {/* Abstract Background Shapes */}
                        <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-indigo-500 opacity-20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl"></div>
                    </div>

                    <div className="p-8 md:p-12">
                        <div className="prose dark:prose-invert max-w-none">
                            <p className="text-slate-600 dark:text-slate-300 mb-8 border-l-4 border-blue-500 pl-4 italic">
                                Last Updated: December 11, 2025
                            </p>

                            <Section title="Information We Collect" icon={FileText}>
                                <p className="mb-4">We collect information you provide directly to us when you create an account, request a service, or communicate with us.</p>
                                <ul className="list-disc space-y-2 ml-4">
                                    <li>Personal identification information (Name, email address, phone number)</li>
                                    <li>Location data for service matching</li>
                                    <li>Service request details and photos</li>
                                    <li>Review and rating content</li>
                                </ul>
                            </Section>

                            <Section title="How We Use Your Data" icon={Eye}>
                                <p className="mb-4">We use your information to provide, maintain, and improve our services.</p>
                                <ul className="list-disc space-y-2 ml-4">
                                    <li>Matching you with the most suitable service providers</li>
                                    <li>Facilitating communication between customers and providers</li>
                                    <li>Sending transaction notifications and updates</li>
                                    <li>Analyzing usage trends to improve our AI algorithms</li>
                                </ul>
                            </Section>

                            <Section title="Data Security" icon={Lock}>
                                <p>
                                    We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. We use industry-standard encryption for data transmission and storage.
                                </p>
                            </Section>

                            <Section title="Sharing of Information" icon={Shield}>
                                <p>
                                    We do not sell your personal information. We share your information only in the following circumstances:
                                </p>
                                <ul className="list-disc space-y-2 ml-4 mt-2">
                                    <li>With service providers to fulfill your requests (only necessary details)</li>
                                    <li>To comply with legal obligations</li>
                                    <li>To protect the rights and safety of ServeFlow AI and our users</li>
                                </ul>
                            </Section>

                            <Section title="Your Rights" icon={CheckCircle}>
                                <p>
                                    You have the right to access, correct, or delete your personal information. You can manage your account settings directly within the app or contact our support team for assistance.
                                </p>
                            </Section>
                        </div>

                        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700 text-center">
                            <p className="text-slate-500 dark:text-slate-400">
                                Have questions about our privacy practices?
                            </p>
                            <a href="mailto:privacy@serveflow.ai" className="text-blue-600 font-medium hover:underline mt-2 inline-block">
                                Contact Privacy Team
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
