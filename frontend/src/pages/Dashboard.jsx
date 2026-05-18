import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
    Users, Briefcase, DollarSign, TrendingUp, Clock,
    CheckCircle, ArrowRight, Zap, Target
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DashboardBrand from '../components/DashboardBrand';

const Dashboard = () => {
    const { user } = useAuth();
    const { settings } = useSettings();
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState('user');
    const navigate = useNavigate();

    useEffect(() => {
        verifyRoleAndRedirect();
    }, [navigate]);

    const verifyRoleAndRedirect = async () => {
        try {
            const response = await api.get('users/me/');
            const role = response.data.role;
            localStorage.setItem('userRole', role);
            setUserRole(role);

            if (role === 'admin') {
                navigate('/dashboard/admin', { replace: true });
                return;
            }
            if (role === 'provider') {
                navigate('/dashboard/provider', { replace: true });
                return;
            }
            fetchDashboardData();
        } catch (error) {
            console.error('Role verification failed:', error);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const [requestsRes] = await Promise.all([
                api.get('requests/my_requests/')
            ]);

            setStats({
                total_requests: requestsRes.data.length,
                pending: requestsRes.data.filter(r => r.status === 'pending').length,
                completed: requestsRes.data.filter(r => r.status === 'completed').length,
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
                <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 dark:text-slate-400 text-sm animate-pulse">Loading...</p>
            </div>
        );
    }

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-10 px-1 sm:px-0"
        >
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-3 min-w-0">
                    <DashboardBrand linkTo="/dashboard" unlinked className="mt-0.5" />
                    <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Your requests and quick actions</p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/create-request')}
                    className="flex items-center justify-center gap-2 px-6 sm:px-8 py-4 bg-blue-600 text-white rounded-[2rem] font-bold shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all w-full md:w-auto"
                >
                    <Zap className="w-5 h-5 fill-white" />
                    Book New Service
                </button>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                    { label: 'Total requests', value: stats.total_requests, icon: Target, color: 'blue' },
                    { label: 'Pending', value: stats.pending, icon: Clock, color: 'amber' },
                    { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'emerald' }
                ].map((s, i) => (
                    <motion.div
                        key={i}
                        variants={item}
                        className="glass-card p-6 sm:p-8 rounded-[2.5rem] group relative overflow-hidden"
                    >
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${s.color}-500/10 rounded-full blur-3xl group-hover:bg-${s.color}-500/20 transition-colors`} />
                        <div className="flex items-start justify-between relative z-10">
                            <div>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
                                <p className="text-3xl sm:text-4xl font-semibold text-slate-900 dark:text-white">{s.value || 0}</p>
                            </div>
                            <div className={`p-3 sm:p-4 bg-${s.color}-50 dark:bg-${s.color}-900/20 rounded-2xl`}>
                                <s.icon className={`w-6 h-6 sm:w-8 h-8 text-${s.color}-600 dark:text-${s.color}-400`} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Main Layout Grid */}
            <div className="grid lg:grid-cols-2 gap-8">
                {/* Quick Actions */}
                <motion.div variants={item} className="space-y-6">
                    <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 pl-1">Quick actions</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                        <button
                            onClick={() => navigate('/create-request')}
                            className="p-6 sm:p-8 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-blue-700 text-white text-left shadow-2xl shadow-blue-500/20 group relative overflow-hidden active:scale-[0.98] transition-all"
                        >
                            <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                                    <Zap className="w-8 h-8 fill-white" />
                                </div>
                                <ArrowRight className="w-8 h-8 text-white/50 group-hover:translate-x-2 transition-transform" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-semibold mb-1 relative z-10">New service request</h3>
                            <p className="text-blue-100 relative z-10 text-sm">Describe what you need and get matched with providers</p>
                        </button>

                        <button
                            onClick={() => navigate('/dashboard/my-requests')}
                            className="p-6 sm:p-8 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 text-left group hover:shadow-2xl transition-all"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                                    <Briefcase className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                                </div>
                                <ArrowRight className="w-8 h-8 text-slate-200 dark:text-slate-700 group-hover:translate-x-2 transition-transform" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-1">My requests</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">View open and completed work</p>
                        </button>
                    </div>
                </motion.div>

                {/* System Activity Visualizer */}
                <motion.div variants={item} className="glass-card p-6 sm:p-10 rounded-[3rem] flex flex-col justify-center text-center">
                    <div className="w-20 h-20 sm:w-24 h-24 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <TrendingUp className="w-10 h-10 sm:w-12 h-12 text-blue-600 animate-pulse" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">Recent activity</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">Overview of your request volume</p>
                    <div className="flex gap-2 justify-center">
                        {[40, 70, 45, 90, 65, 80].map((h, i) => (
                            <div key={i} className="w-2.5 sm:w-3 bg-blue-600/20 dark:bg-blue-600/40 rounded-full h-16 sm:h-20 relative overflow-hidden">
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: `${h}%` }}
                                    transition={{ delay: 0.5 + i * 0.1, duration: 1 }}
                                    className="absolute bottom-0 left-0 right-0 bg-blue-600 rounded-full"
                                />
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default Dashboard;
