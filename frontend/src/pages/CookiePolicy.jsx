import { useNavigate } from 'react-router-dom';
import { Cookie, Info, Settings, Shield } from 'lucide-react';

const CookiePolicy = () => {
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
                    <div className="bg-indigo-600 text-white p-12 text-center relative overflow-hidden">
                        <div className="relative z-10">
                            <h1 className="text-4xl font-bold mb-4">Cookie Policy</h1>
                            <p className="text-indigo-100 text-lg max-w-2xl mx-auto">
                                How we use cookies to improve your experience.
                            </p>
                        </div>
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                    </div>

                    <div className="p-8 md:p-12">
                        <div className="prose dark:prose-invert max-w-none">

                            <Section title="What Are Cookies?" icon={Cookie}>
                                <p>
                                    Cookies are small text files that are stored on your device when you visit our website. They help us remember your preferences, understand how you use our site, and improve your overall experience.
                                </p>
                            </Section>

                            <Section title="How We Use Cookies" icon={Info}>
                                <ul className="list-disc space-y-2 ml-4">
                                    <li><strong>Essential Cookies:</strong> Necessary for the website to function (e.g., login status).</li>
                                    <li><strong>Analytics Cookies:</strong> Help us analyze site traffic and usage patterns.</li>
                                    <li><strong>Functional Cookies:</strong> Remember your choices (e.g., language, location).</li>
                                </ul>
                            </Section>

                            <Section title="Managing Cookies" icon={Settings}>
                                <p>
                                    Most web browsers automatically accept cookies, but you can usually modify your browser settings to decline cookies if you prefer. However, blocking certain cookies may prevent you from taking full advantage of the website.
                                </p>
                            </Section>

                            <Section title="Third-Party Cookies" icon={Shield}>
                                <p>
                                    We may use trusted third-party services (like Google Analytics) that may also set cookies on your device. These cookies are governed by the respective privacy policies of these third parties.
                                </p>
                            </Section>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookiePolicy;
