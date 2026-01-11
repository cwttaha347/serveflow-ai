import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Zap, Menu, X, ArrowRight, LayoutDashboard, LogOut } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

const PublicNavbar = ({ transparent = false }) => {
    const { settings } = useSettings();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/');
        setMobileMenuOpen(false);
    };

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

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
                                <button onClick={handleLogout} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                                    Log Out
                                </button>
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

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 w-full glass-dark border-t border-slate-800 p-4 flex flex-col gap-4 animate-in slide-in-from-top-5">
                    <Link to="/#features" className="text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Features</Link>
                    <Link to="/services" className="text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Services</Link>
                    <Link to="/providers" className="text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Providers</Link>
                    <Link to="/providers" className="text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Providers</Link>
                    {user ? (
                        <>
                            <Link to={user.role === 'provider' ? '/dashboard/provider' : '/dashboard'} className="bg-blue-600 text-white py-2 rounded-lg text-center font-bold" onClick={() => setMobileMenuOpen(false)}>
                                Go to Dashboard
                            </Link>
                            <button onClick={handleLogout} className="text-slate-400 hover:text-white py-2 text-center">Log Out</button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
                            <Link to="/register" className="bg-blue-600 text-white py-2 rounded-lg text-center" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
                        </>
                    )}
                </div>
            )}
        </nav>
    );
};

export default PublicNavbar;
