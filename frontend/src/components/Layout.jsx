import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Users, FileText, Settings, LogOut, Menu, X,
    Briefcase, Shield, ClipboardList, Star, DollarSign, Bell, MessageSquare
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import { useWebSocket } from '../context/WebSocketContext';
import { getNotificationTarget } from '../utils/notificationNavigation';

const Layout = () => {
    const { settings } = useSettings();
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifItems, setNotifItems] = useState([]);
    const userRole = user?.role || 'user';
    const { totalUnread, refreshUnreadSummary, markNotificationRead } = useWebSocket();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        navigate('/login');
    };

    const loadNotifications = async () => {
        try {
            const { default: api } = await import('../api');
            const res = await api.get('notifications/feed/');
            setNotifItems(res.data.items || []);
        } catch (e) {
            console.error('Failed to load notifications', e);
        }
    };

    const NavLink = ({ to, icon: Icon, children }) => {
        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center px-4 py-3 rounded-2xl transition-all duration-300 group ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 font-bold translate-x-1'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:translate-x-1'
                    }`}
            >
                <Icon className={`w-5 h-5 mr-3 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                {children}
            </Link>
        );
    };

    return (
        <div className="sf-dashboard-shell flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
            {/* Animated Background Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-blue-600/5 rounded-full blur-[120px] animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 dark:bg-purple-600/5 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
                <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-pink-500/10 dark:bg-pink-600/5 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
            </div>

            {/* Sidebar - Desktop */}
            <aside className="hidden lg:flex lg:flex-col w-72 m-4 bg-white/70 dark:bg-slate-900/40 backdrop-blur-2xl border border-slate-200 dark:border-white/5 rounded-[2.5rem] shadow-2xl relative z-20 overflow-hidden">
                <div className="p-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <span className="text-white font-black italic">S</span>
                        </div>
                        <div>
                            <h1 className="sf-adaptive-title font-black text-slate-900 dark:text-white tracking-tight">{settings.platform_name}</h1>
                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">Smart Assistant</p>
                        </div>
                    </div>
                </div>

                <nav className="sf-dashboard-sidebar-scroll flex-1 px-6 space-y-2 overflow-y-auto overflow-x-hidden pt-4">
                    <p className="px-4 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Menu</p>
                    {userRole === 'user' && (
                        <>
                            <NavLink to="/dashboard" icon={LayoutDashboard}>Home</NavLink>
                            <NavLink to="/dashboard/my-requests" icon={ClipboardList}>My Requests</NavLink>
                            <NavLink to="/create-request" icon={FileText}>Book a Service</NavLink>
                            <NavLink to="/dashboard/invoices" icon={DollarSign}>My Bills</NavLink>
                            <NavLink to="/dashboard/reviews" icon={Star}>My Reviews</NavLink>
                            <NavLink to="/dashboard/settings" icon={Settings}>My Account</NavLink>
                        </>
                    )}

                    {userRole === 'provider' && (
                        <>
                            <NavLink to="/dashboard/provider" icon={Briefcase}>Job Center</NavLink>
                            <NavLink to="/dashboard/provider/jobs" icon={ClipboardList}>Active Orders</NavLink>
                            <NavLink to="/dashboard/settings" icon={Settings}>My Account</NavLink>
                        </>
                    )}

                    {userRole === 'admin' && (
                        <>
                            <NavLink to="/dashboard/admin" icon={Shield}>Admin Dashboard</NavLink>
                            <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Management</div>
                            <NavLink to="/dashboard/admin/users" icon={Users}>Users</NavLink>
                            <NavLink to="/dashboard/admin/providers" icon={Briefcase}>Providers</NavLink>
                            <NavLink to="/dashboard/admin/categories" icon={FileText}>Categories</NavLink>
                            <div className="pt-6 pb-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quick Access</div>
                            <NavLink to="/dashboard/admin/requests" icon={ClipboardList}>Active Requests</NavLink>
                            <NavLink to="/dashboard/admin/jobs" icon={Briefcase}>All Jobs</NavLink>
                            <NavLink to="/dashboard/admin/settings" icon={Settings}>App Settings</NavLink>
                        </>
                    )}
                </nav>

                <div className="p-6 border-t border-slate-100/50 dark:border-white/5">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-4 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all duration-300 font-bold group"
                    >
                        <LogOut className="w-5 h-5 mr-3 group-hover:rotate-12 transition-transform" />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setMobileMenuOpen(false)}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-40 lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed left-0 top-0 bottom-0 w-[80%] max-w-[320px] bg-white dark:bg-slate-900 z-50 p-6 flex flex-col shadow-2xl lg:hidden overflow-x-hidden"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                        <span className="text-white font-bold italic text-sm">S</span>
                                    </div>
                                    <h1 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{settings.platform_name}</h1>
                                </div>
                                <button onClick={() => setMobileMenuOpen(false)}>
                                    <X className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>
                            <nav className="sf-dashboard-sidebar-scroll flex-1 space-y-2 overflow-y-auto overflow-x-hidden">
                                {userRole === 'user' && (
                                    <>
                                        <NavLink to="/dashboard" icon={LayoutDashboard}>Home</NavLink>
                                        <NavLink to="/dashboard/my-requests" icon={ClipboardList}>My Requests</NavLink>
                                        <NavLink to="/create-request" icon={FileText}>Book a Service</NavLink>
                                        <NavLink to="/dashboard/invoices" icon={DollarSign}>My Bills</NavLink>
                                        <NavLink to="/dashboard/settings" icon={Settings}>My Account</NavLink>
                                    </>
                                )}
                                {userRole === 'provider' && (
                                    <>
                                        <NavLink to="/dashboard/provider" icon={Briefcase}>Job Center</NavLink>
                                        <NavLink to="/dashboard/provider/jobs" icon={ClipboardList}>Active Orders</NavLink>
                                        <NavLink to="/dashboard/settings" icon={Settings}>My Account</NavLink>
                                    </>
                                )}
                                {userRole === 'admin' && (
                                    <>
                                        <NavLink to="/dashboard/admin" icon={Shield}>Admin Dashboard</NavLink>
                                        <NavLink to="/dashboard/admin/users" icon={Users}>Users</NavLink>
                                        <NavLink to="/dashboard/admin/providers" icon={Briefcase}>Providers</NavLink>
                                        <NavLink to="/dashboard/admin/requests" icon={ClipboardList}>Requests</NavLink>
                                        <NavLink to="/dashboard/admin/settings" icon={Settings}>Settings</NavLink>
                                    </>
                                )}
                            </nav>
                            <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                                <button
                                    onClick={handleLogout}
                                    className="flex items-center w-full px-4 py-4 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all font-bold"
                                >
                                    <LogOut className="w-5 h-5 mr-3" />
                                    Logout
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 h-full relative z-10">
                {/* Header */}
                <header className="h-20 lg:h-24 flex items-center justify-between px-6 lg:px-12 relative z-20">
                    <div className="flex items-center gap-4">
                        <button
                            className="lg:hidden p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <Menu className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                        </button>
                        <div className="hidden lg:block">
                            <h2 className="sf-adaptive-title font-black text-slate-900 dark:text-white tracking-tight">
                                {location.pathname.split('/').pop().replace(/-/g, ' ').toUpperCase() || 'HOME'}
                            </h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Everything looks good</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 lg:gap-6">
                        {/* Theme Toggle Added Here */}
                        <ThemeToggle />

                        <button
                            onClick={() => {
                                const next = !notifOpen;
                                setNotifOpen(next);
                                if (next) loadNotifications();
                            }}
                            className="flex relative p-2.5 sm:p-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:scale-110 transition-transform"
                        >
                            <Bell className="w-5 h-5" />
                            {totalUnread > 0 ? (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white rounded-full border-2 border-white dark:border-slate-800 text-[10px] leading-[14px] font-bold flex items-center justify-center">
                                    {totalUnread > 99 ? '99+' : totalUnread}
                                </span>
                            ) : (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600/50 rounded-full border-2 border-white dark:border-slate-800"></span>
                            )}
                        </button>
                        {notifOpen && (
                            <div className="absolute right-6 lg:right-12 top-20 lg:top-24 w-[360px] max-w-[92vw] max-h-[60vh] overflow-y-auto z-30 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-3">
                                <div className="flex items-center justify-between px-2 py-1">
                                    <p className="text-xs font-bold text-slate-500">Notifications</p>
                                    <button
                                        className="text-xs text-blue-600 font-semibold"
                                        onClick={() => {
                                            navigate('/dashboard/notifications');
                                            setNotifOpen(false);
                                        }}
                                    >
                                        Open page
                                    </button>
                                </div>
                                <div className="space-y-2 mt-2">
                                    {notifItems.length === 0 ? (
                                        <p className="text-sm text-slate-500 px-2 py-6 text-center">No notifications yet.</p>
                                    ) : notifItems.slice(0, 10).map((item) => (
                                        <button
                                            key={item.id}
                                            className={`w-full text-left rounded-xl px-3 py-2 border flex items-start gap-3 transition-all hover:scale-[1.02] ${item.is_read ? 'border-slate-200 dark:border-slate-700 opacity-70' : 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 shadow-sm'}`}
                                            onClick={async () => {
                                                await markNotificationRead(item.id);
                                                await loadNotifications();
                                                const target = getNotificationTarget({
                                                    type: item.type,
                                                    payload: item.payload,
                                                    userRole,
                                                });
                                                setNotifOpen(false);
                                                if (target) navigate(target);
                                            }}
                                        >
                                            <div className={`mt-1 p-1.5 rounded-lg shrink-0 ${item.type === 'chat_message' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                {item.type === 'chat_message' ? <MessageSquare className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                    {item.title || (item.type === 'chat_message' ? 'New Message' : 'Notification')}
                                                </p>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                                                    {item.message}
                                                </p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1">
                                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 p-1.5 lg:p-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-[1.5rem] border border-slate-200/50 dark:border-white/5 shadow-sm pr-4 lg:pr-6">
                            <div className="w-9 h-9 lg:w-11 h-11 bg-gradient-to-br from-blue-600 to-purple-600 rounded-[1rem] flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20 text-sm">
                                {userRole[0].toUpperCase()}
                            </div>
                            <div className="hidden sm:block">
                                <p className="text-[11px] font-black text-slate-900 dark:text-white leading-none capitalize mb-0.5">{userRole} Profile</p>
                                <p className="text-[10px] font-bold text-green-500 dark:text-green-400 leading-none">Status: Active</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Dashboard Viewport */}
                <div className="sf-dashboard-scroll flex-1 overflow-y-auto overflow-x-hidden px-6 lg:px-12 pb-12 pt-4 relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={location.pathname}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.4, ease: "circOut" }}
                            className="h-full min-w-0"
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

export default Layout;

