import { Link } from 'react-router-dom';
import { Zap, Globe, ArrowRight, Twitter, Facebook, Instagram, Linkedin } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';


const PublicFooter = () => {
    const { settings } = useSettings();
    return (
        <footer className="bg-slate-950 pt-20 pb-10 border-t border-slate-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-2xl font-bold text-white">{settings.platform_name}</span>
                        </div>
                        <p className="text-slate-400 max-w-sm mb-8">
                            The world's first AI-powered service aggregation platform. Connecting you with quality professionals instantly.
                        </p>
                        <div className="flex gap-4">
                            {[
                                { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
                                { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' },
                                { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
                                { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' }
                            ].map((social, index) => (
                                <a
                                    key={index}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all hover:-translate-y-1"
                                >
                                    <span className="sr-only">{social.label}</span>
                                    <social.icon className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6">Platform</h4>
                        <ul className="space-y-4 text-slate-400">
                            <li><Link to="/#features" className="hover:text-blue-400 transition-colors">How it Works</Link></li>
                            <li><Link to="/services" className="hover:text-blue-400 transition-colors">Browse Services</Link></li>
                            <li><Link to="/providers" className="hover:text-blue-400 transition-colors">For Providers</Link></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Pricing</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-6">Company</h4>
                        <ul className="space-y-4 text-slate-400">
                            <li><a href="#" className="hover:text-blue-400 transition-colors">About Us</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Careers</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Blog</a></li>
                            <li><a href="#" className="hover:text-blue-400 transition-colors">Contact</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-white mb-4">Legal</h4>
                        <ul className="space-y-2 text-slate-400">
                            <li><Link to="/privacy-policy" className="hover:text-blue-400">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="hover:text-blue-400">Terms of Service</Link></li>
                            <li><Link to="/cookies" className="hover:text-blue-400">Cookie Policy</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="pt-8 border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-sm">
                    <p>© 2025 {settings.platform_name}. All rights reserved.</p>
                    <div className="flex gap-8">
                        <Link to="/privacy-policy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default PublicFooter;
