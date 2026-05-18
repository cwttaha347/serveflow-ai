import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, LayoutDashboard, Zap } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import BrandLogo from './BrandLogo';

const PublicNavbar = ({ transparent = false }) => {
    const { settings } = useSettings();
    const { user } = useAuth();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileMenuOpen]);

    // If not transparent mode (e.g. inner pages), always use dark background style
    // If transparent mode (Landing), use background only when scrolled
    const isTransparentNode = transparent && !scrolled;

    // Helper to determine text color
    // If transparent background (at top of Landing), text is white.
    // If solid background (scrolled OR inner page), text is still white/slate-400 because we use glass-dark style.

    // We'll stick to the "glass-dark" or "slate-900" look for the navbar everywhere for consistency.

    const navClasses = isTransparentNode
        ? 'bg-transparent py-6'
        : 'glass-dark py-3';

    return (
        <nav className={`fixed w-full z-50 transition-all duration-300 ${navClasses}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        {settings.platform_name}
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-8">
                    <Link to="/#features" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hover:scale-105 transform">Features</Link>
                    <Link to="/services" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hover:scale-105 transform">Services</Link>
                    <Link to="/providers" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hover:scale-105 transform">Providers</Link>
                    <div className="flex items-center gap-4 ml-4">
                        {user ? (
                            <>
                                <Link
                                    to={user.role === 'provider' ? '/dashboard/provider' : '/dashboard'}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-500 transition-all hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    <LayoutDashboard className="w-4 h-4" />
                                    Dashboard
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-sm font-medium text-white hover:text-blue-400 transition-colors">
                                    Log In
                                </Link>
                                <Link
                                    to="/register"
                                    className="px-5 py-2.5 bg-white text-slate-900 rounded-full font-semibold hover:bg-blue-50 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95"
                                >
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="md:hidden p-2 text-slate-300 hover:text-white"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.button
                            type="button"
                            aria-label="Close mobile menu"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            onClick={() => setMobileMenuOpen(false)}
                            className="md:hidden fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm"
                        />
                        <motion.aside
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                            className="md:hidden fixed right-0 top-0 h-screen w-[82%] max-w-[340px] z-50 glass-dark border-l border-slate-700/60 shadow-2xl p-6 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-7">
                                <p className="text-sm font-bold text-slate-200">Menu</p>
                                <button
                                    type="button"
                                    className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-2 text-sm">
                                <Link to="/#features" className="px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/50" onClick={() => setMobileMenuOpen(false)}>Features</Link>
                                <Link to="/services" className="px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/50" onClick={() => setMobileMenuOpen(false)}>Services</Link>
                                <Link to="/providers" className="px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/50" onClick={() => setMobileMenuOpen(false)}>Providers</Link>
                            </div>

                            <div className="mt-auto pt-6 border-t border-slate-700/60 flex flex-col gap-3">
                                {user ? (
                                    <>
                                        <Link
                                            to={user.role === 'provider' ? '/dashboard/provider' : '/dashboard'}
                                            className="bg-blue-600 text-white py-2.5 rounded-xl text-center font-bold hover:bg-blue-500 transition-colors"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            Go to Dashboard
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <Link to="/login" className="px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/50 text-center" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
                                        <Link to="/register" className="bg-blue-600 text-white py-2.5 rounded-xl text-center font-semibold hover:bg-blue-500 transition-colors" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
                                    </>
                                )}
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default PublicNavbar;
