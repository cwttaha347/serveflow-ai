import { useNavigate } from 'react-router-dom';
import { FileText, AlertCircle, CheckCircle, Scale, ScrollText } from 'lucide-react';

const TermsOfService = () => {
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
                    <div className="bg-slate-900 text-white p-12 text-center relative overflow-hidden">
                        <div className="relative z-10">
                            <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
                            <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                                Please read these terms carefully before using ServeFlow AI.
                            </p>
                        </div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 opacity-10 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500 opacity-10 rounded-full -translate-x-1/3 translate-y-1/3 blur-3xl"></div>
                    </div>

                    <div className="p-8 md:p-12">
                        <div className="prose dark:prose-invert max-w-none">
                            <p className="text-slate-600 dark:text-slate-300 mb-8 border-l-4 border-blue-500 pl-4 italic">
                                Last Updated: December 11, 2025
                            </p>

                            <Section title="Acceptance of Terms" icon={CheckCircle}>
                                <p>
                                    By accessing or using the ServeFlow AI platform, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.
                                </p>
                            </Section>

                            <Section title="Service Description" icon={ScrollText}>
                                <p>
                                    ServeFlow AI acts as an intermediary platform connecting service seekers ("Customers") with service providers ("Providers"). We use AI matching technology to facilitate these connections. We do not directly provide home services and are not responsible for the direct actions of Providers.
                                </p>
                            </Section>

                            <Section title="User Responsibilities" icon={AlertCircle}>
                                <ul className="list-disc space-y-2 ml-4">
                                    <li>You must provide accurate and complete registration information.</li>
                                    <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
                                    <li>You agree not to use the platform for any illegal or unauthorized purpose.</li>
                                    <li>Service Providers must maintain valid licenses and insurance where required by law.</li>
                                </ul>
                            </Section>

                            <Section title="Payments and Fees" icon={Scale}>
                                <p>
                                    ServeFlow AI may charge transaction fees or commissions on completed services. All fees are transparently disclosed before booking. Payments are processed securely through our third-party payment processors.
                                </p>
                            </Section>

                            <Section title="Limitation of Liability" icon={FileText}>
                                <p>
                                    In no event shall ServeFlow AI be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on ServeFlow AI's website.
                                </p>
                            </Section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsOfService;
